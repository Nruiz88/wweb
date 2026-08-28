import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/api-helpers";
import { runGroupDiscovery } from "@/lib/group-discovery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// TTL del caché: el resultado de "Buscar grupos" se guarda temporalmente en
// group_discovery_cache y expira a los pocos minutos (no se acumula).
const CACHE_TTL_MS = 5 * 60 * 1000;

// GET: lee el caché temporal (sin consultar Evolution).
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");

  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: cached } = await supabase
    .from("group_discovery_cache")
    .select("data")
    .eq("instance_id", instanceId)
    .gte("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({ status: "success", data: cached.data, source: "cache" });
  }

  // Limpieza de entradas vencidas (temporal, no se acumulan).
  await supabase.from("group_discovery_cache").delete().eq("instance_id", instanceId);
  return NextResponse.json({ status: "success", data: [], source: "none" });
}

// POST: ejecuta "Buscar grupos" en Evolution, guarda el JSON temporal en la DB
// y lo devuelve. El resultado se consume desde el caché durante unos minutos.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }
  const { instanceId } = (body ?? {}) as { instanceId?: string };

  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const listed = await runGroupDiscovery(supabase, instanceId);

  // Guardar temporalmente (un solo registro por instancia) y limpiar vencidos.
  await supabase.from("group_discovery_cache").delete().eq("instance_id", instanceId);
  await supabase.from("group_discovery_cache").insert({
    instance_id: instanceId,
    data: listed,
    expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  });

  return NextResponse.json({ status: "success", data: listed, source: "live" });
}

// DELETE: Remove a saved group config (kept for backward compat / dismissal)
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  // Only allow deleting group_settings rows the user owns (not discovered rows,
  // since discovery is now live). Fall back to discovered_groups if present.
  const { data: group } = await supabase
    .from("group_settings")
    .select("id, instance_id")
    .eq("id", id)
    .single();

  if (group) {
    const hasAccess = await verifyUserAccess(supabase, user.id, group.instance_id);
    if (!hasAccess) {
      return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
    }
    const { error } = await supabase.from("group_settings").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ status: "error", error: "Failed to delete group" }, { status: 500 });
    }
    return NextResponse.json({ status: "success" });
  }

  // Legacy: discovered_groups row
  const { data: discovered } = await supabase
    .from("discovered_groups")
    .select("id, instance_id")
    .eq("id", id)
    .single();
  if (!discovered) {
    return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  }
  const hasAccess = await verifyUserAccess(supabase, user.id, discovered.instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }
  await supabase.from("discovered_groups").delete().eq("id", id);
  return NextResponse.json({ status: "success" });
}