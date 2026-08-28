import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";
import { safeErrorMessage, verifyUserAccess } from "@/lib/api-helpers";
import { fetchInstanceOwnerJid, findGroupInfos } from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET: List group settings for an instance
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

  // Verify access
  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const { data: settings, error } = await supabase
    .from("group_settings")
    .select("*")
    .eq("instance_id", instanceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  // Merge nombre/imagen PERSISTIDOS desde discovered_groups (sin consultar
  // Evolution en cada carga). El nombre/imagen real los mantiene el flujo de
  // "Buscar grupos" (runGroupDiscovery) que persiste por grupo.
  const rows = settings || [];
  if (rows.length > 0) {
    const { data: discovered } = await supabase
      .from("discovered_groups")
      .select("group_jid, group_name, group_picture")
      .eq("instance_id", instanceId)
      .in("group_jid", rows.map((r) => r.group_jid));
    const discMap = new Map((discovered || []).map((g) => [g.group_jid, g]));
    const updates: unknown[] = [];
    for (const r of rows) {
      const d = discMap.get(r.group_jid);
      if (!d) continue;
      if (d.group_name && d.group_name !== r.group_name) {
        r.group_name = d.group_name;
        updates.push(supabase.from("group_settings").update({ group_name: d.group_name }).eq("id", r.id));
      }
      if (d.group_picture && d.group_picture !== r.picture_url) {
        r.picture_url = d.group_picture;
        updates.push(supabase.from("group_settings").update({ picture_url: d.group_picture }).eq("id", r.id));
      }
    }
    if (updates.length) await Promise.all(updates);
  }

  return NextResponse.json({ status: "success", data: rows });
}

// POST: Create or update group settings
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "group-settings", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

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

  const {
    instanceId,
    groupJid,
    pictureUrl,
    welcomeEnabled,
    welcomeMessage,
    spamFilterEnabled,
    blockAllLinks,
    allowedDomains,
    bannedWordsEnabled,
    bannedWords,
    bannedWordsAction,
    bannedWordsReply,
  } = (body ?? {}) as {
    instanceId?: string;
    groupJid?: string;
    groupName?: string;
    pictureUrl?: string;
    welcomeEnabled?: boolean;
    welcomeMessage?: string;
    spamFilterEnabled?: boolean;
    blockAllLinks?: boolean;
    allowedDomains?: string[];
    bannedWordsEnabled?: boolean;
    bannedWords?: string[];
    bannedWordsAction?: "delete" | "delete_and_reply";
    bannedWordsReply?: string;
  };

  if (!instanceId || !groupJid) {
    return NextResponse.json({ status: "error", error: "instanceId and groupJid are required" }, { status: 400 });
  }

  // Normalize banned words: trim, lowercase, dedupe, filter empties
  const cleanBannedWords = Array.from(
    new Set(
      (bannedWords || [])
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 0),
    ),
  );

  const validAction =
    bannedWordsAction === "delete" || bannedWordsAction === "delete_and_reply"
      ? bannedWordsAction
      : "delete_and_reply";

  // Verify admin access + fetch Evolution credentials
  const { data: instance } = await supabase
    .from("instances")
    .select("id, admin_id, instance_name, evolution_api_url, evolution_api_key, owner_jid")
    .eq("id", instanceId)
    .single();

  if (!instance || instance.admin_id !== user.id) {
    return NextResponse.json({ status: "error", error: "Only instance admin can manage group settings" }, { status: 403 });
  }

  // El nombre del grupo SIEMPRE sale de WhatsApp (nunca del cliente).
  let resolvedName: string | null = null;
  if (instance.evolution_api_url && instance.evolution_api_key) {
    let ownerJid = instance.owner_jid || null;
    if (!ownerJid) {
      ownerJid = await fetchInstanceOwnerJid(
        instance.evolution_api_url,
        instance.evolution_api_key,
        instance.instance_name,
      );
      if (ownerJid) {
        await supabase.from("instances").update({ owner_jid: ownerJid }).eq("id", instanceId);
      }
    }
    const info = await findGroupInfos(
      instance.evolution_api_url,
      instance.evolution_api_key,
      instance.instance_name,
      groupJid,
      ownerJid ?? undefined,
    );
    if (info.ok && info.data) {
      resolvedName = info.data.name || null;
      if (info.data.isAdmin === false) {
        return NextResponse.json(
          { status: "error", error: "El bot debe ser administrador del grupo para configurarlo" },
          { status: 403 },
        );
      }
    }
  }

  const settingsPayload: Record<string, unknown> = {
    instance_id: instanceId,
    user_id: user.id,
    group_jid: groupJid,
    welcome_enabled: welcomeEnabled ?? false,
    welcome_message: welcomeMessage || null,
    spam_filter_enabled: spamFilterEnabled ?? false,
    block_all_links: blockAllLinks ?? true,
    allowed_domains: allowedDomains || [],
    banned_words_enabled: bannedWordsEnabled ?? false,
    banned_words: cleanBannedWords,
    banned_words_action: validAction,
    banned_words_reply: bannedWordsReply?.trim() || null,
  };
  // Si resolvimos el nombre en vivo lo guardamos. Si Evolution no respondió,
  // el upsert conserva el nombre existente para grupos ya configurados.
  if (resolvedName) settingsPayload.group_name = resolvedName;
  if (pictureUrl) settingsPayload.picture_url = pictureUrl;

  const { data: settings, error } = await supabase
    .from("group_settings")
    .upsert(settingsPayload, { onConflict: "instance_id,group_jid" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: settings });
}

// DELETE: Remove group settings
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "group-settings", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

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

  const { data: existing } = await supabase
    .from("group_settings")
    .select("id, instance_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  }

  // Verify admin
  const { data: instance } = await supabase
    .from("instances")
    .select("admin_id")
    .eq("id", existing.instance_id)
    .single();

  if (!instance || instance.admin_id !== user.id) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  const { error } = await supabase.from("group_settings").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success" });
}
