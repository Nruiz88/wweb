import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { getConnectionState } from "@/lib/evolution-multi";
import { validateEvolutionUrl, sanitizeString } from "@/lib/validation";
import { safeErrorMessage } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

interface InstanceRow {
  id: string;
  instance_name: string;
  status: string;
  created_at: string;
  evolution_api_url?: string;
  evolution_api_key?: string;
}

function sanitizeInstance(instance: InstanceRow) {
  return {
    id: instance.id,
    instance_name: instance.instance_name,
    status: instance.status,
    created_at: instance.created_at,
  };
}

// Caché del estado en vivo: evita llamar a Evolution API en cada request.
// Solo se refresca si el dato tiene mas de TTL_MS de antiguedad.
const statusCache = new Map<string, { status: string; at: number }>();
const STATUS_TTL_MS = 10_000;

async function withLiveStatus(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  instances: InstanceRow[]
) {
  const now = Date.now();

  return Promise.all(
    instances.map(async (instance) => {
      if (!instance.evolution_api_url || !instance.evolution_api_key) {
        return sanitizeInstance(instance);
      }

      const cacheKey = `${instance.evolution_api_url}|${instance.instance_name}`;
      const cached = statusCache.get(cacheKey);

      if (cached && now - cached.at < STATUS_TTL_MS) {
        return sanitizeInstance({ ...instance, status: cached.status });
      }

      const state = await getConnectionState(
        instance.evolution_api_url,
        instance.evolution_api_key,
        instance.instance_name
      );

      if (state.ok && state.data) {
        statusCache.set(cacheKey, { status: state.data, at: Date.now() });
        try {
          await supabase
            .from("instances")
            .update({ status: state.data })
            .eq("id", instance.id);
        } catch {
          // Non-critical: keep serving even if DB update fails
        }
        return sanitizeInstance({ ...instance, status: state.data });
      }

      return sanitizeInstance(instance);
    })
  );
}

// GET: List instances
export async function GET() {
  // Use SSR client to read session from request cookies
  const { createServerClient: createSSRClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const sessionClient = createSSRClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await sessionClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  // Use service role for DB queries
  const supabase = await createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    const { data: instances, error } = await supabase
      .from("instances")
      .select("id, instance_name, status, created_at, evolution_api_url, evolution_api_key")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
    }

    const live = await withLiveStatus(supabase, instances as InstanceRow[]);
    return NextResponse.json({ status: "success", data: live, role: "admin" });
  }

  const { data: assignments } = await supabase
    .from("user_instances")
    .select("instance_id")
    .eq("user_id", user.id);

  if (!assignments || assignments.length === 0) {
    return NextResponse.json({ status: "success", data: [], role: "user" });
  }

  const { data: instances, error } = await supabase
    .from("instances")
    .select("id, instance_name, status, created_at, evolution_api_url, evolution_api_key")
    .in("id", assignments.map((a) => a.instance_id));

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  const live = await withLiveStatus(supabase, instances as InstanceRow[]);
  return NextResponse.json({ status: "success", data: live, role: "user" });
}

// POST: Create new instance (admin only)
export async function POST(request: Request) {
  const { createServerClient: createSSRClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const sessionClient = createSSRClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await sessionClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ status: "error", error: "Only admins can create instances" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { instanceName, evolutionApiUrl, evolutionApiKey } = (body ?? {}) as {
    instanceName?: string;
    evolutionApiUrl?: string;
    evolutionApiKey?: string;
  };

  const cleanName = sanitizeString(instanceName, 50);
  if (!cleanName) {
    return NextResponse.json({ status: "error", error: "Instance name is required" }, { status: 400 });
  }

  if (!evolutionApiUrl || !evolutionApiKey) {
    return NextResponse.json({ status: "error", error: "All fields are required" }, { status: 400 });
  }

  const urlCheck = validateEvolutionUrl(evolutionApiUrl);
  if (!urlCheck.valid) {
    return NextResponse.json({ status: "error", error: urlCheck.error }, { status: 400 });
  }

  const { data: instance, error } = await supabase
    .from("instances")
    .insert({ admin_id: user.id, instance_name: cleanName, evolution_api_url: evolutionApiUrl.trim(), evolution_api_key: evolutionApiKey })
    .select("id, instance_name, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: instance });
}

// DELETE: Delete instance (admin only)
export async function DELETE(request: Request) {
  const { createServerClient: createSSRClient } = await import("@supabase/ssr");
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  const sessionClient = createSSRClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  const { data: { user } } = await sessionClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const { data: instance } = await supabase.from("instances").select("id, admin_id").eq("id", id).single();

  if (!instance || instance.admin_id !== user.id) {
    return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase.from("instances").delete().eq("id", id);
  if (error) return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });

  return NextResponse.json({ status: "success" });
}
