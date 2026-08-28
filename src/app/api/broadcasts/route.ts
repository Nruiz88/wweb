import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";
import { safeErrorMessage, verifyUserAccess } from "@/lib/api-helpers";
import { mapLimit, sendGroupMessage } from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET: List broadcasts for an instance
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

  // Verify user has access to this instance
  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const { data: broadcasts, error } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("instance_id", instanceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ status: "error", error: "Failed to fetch broadcasts" }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: broadcasts });
}

// POST: Create a broadcast
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "broadcasts", { maxRequests: 10, windowMs: 60_000 });
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

  const { instanceId, title, message, groupJids, sendNow, footer } = (body ?? {}) as {
    instanceId?: string;
    title?: string;
    message?: string;
    groupJids?: string[];
    sendNow?: boolean;
    footer?: string;
  };

  if (!instanceId || !title || !message || !groupJids || groupJids.length === 0) {
    return NextResponse.json(
      { status: "error", error: "instanceId, title, message, and groupJids are required" },
      { status: 400 },
    );
  }

  // Verify admin access
  const { data: instance } = await supabase
    .from("instances")
    .select("id, admin_id, instance_name, evolution_api_url, evolution_api_key")
    .eq("id", instanceId)
    .single();

  if (!instance || instance.admin_id !== user.id) {
    return NextResponse.json({ status: "error", error: "Only instance admin can create broadcasts" }, { status: 403 });
  }

  // Create broadcast record
  const { data: broadcast, error: broadcastError } = await supabase
    .from("broadcasts")
    .insert({
      instance_id: instanceId,
      user_id: user.id,
      title,
      message,
      status: sendNow ? "sending" : "draft",
      total_groups: groupJids.length,
    })
    .select()
    .single();

  if (broadcastError) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(broadcastError) }, { status: 500 });
  }

  // Create recipients
  const recipients = groupJids.map((jid) => ({
    broadcast_id: broadcast.id,
    group_jid: jid,
    status: "pending" as const,
  }));

  await supabase.from("broadcast_recipients").insert(recipients);

  // If sendNow, send immediately
  if (sendNow) {
    // Leyenda configurable (la pone el admin; vacía = sin leyenda).
    const finalText = footer?.trim() ? `${message}\n\n${footer.trim()}` : message;

    // Mentions: `@<número>` (ej @5492995885273) menciona a ese contacto en cada
    // grupo, `@everyone` menciona a todos. El texto se mantiene con los @.
    const mentionedNumbers: string[] = [];
    const mentionRe = /@(\d{6,15})/g;
    let mt: RegExpExecArray | null;
    while ((mt = mentionRe.exec(message))) {
      if (!mentionedNumbers.includes(mt[1])) mentionedNumbers.push(mt[1]);
    }
    const mentionsEveryone = /@everyone/i.test(message);
    const mentions =
      mentionedNumbers.length > 0 || mentionsEveryone
        ? [...mentionedNumbers, ...(mentionsEveryone ? ["everyone"] : [])]
        : undefined;

    // Envío en paralelo (evita que N grupos × timeout supere el límite de Vercel).
    const results = await mapLimit(groupJids, 5, async (jid) => {
      try {
        const result = await sendGroupMessage(
          instance.evolution_api_url,
          instance.evolution_api_key,
          instance.instance_name,
          jid,
          finalText,
          mentions,
          undefined,
        );
        return { jid, ok: result.ok, error: result.ok ? null : result.message };
      } catch {
        return { jid, ok: false, error: "Network error" };
      }
    });

    let sentCount = 0;
    let failedCount = 0;
    for (const r of results) {
      if (r.ok) {
        sentCount++;
        await supabase
          .from("broadcast_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("broadcast_id", broadcast.id)
          .eq("group_jid", r.jid);
      } else {
        failedCount++;
        await supabase
          .from("broadcast_recipients")
          .update({ status: "failed", error: r.error })
          .eq("broadcast_id", broadcast.id)
          .eq("group_jid", r.jid);
      }
    }

    // Update broadcast status
    await supabase
      .from("broadcasts")
      .update({
        status: failedCount === groupJids.length ? "failed" : "completed",
        sent_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
      })
      .eq("id", broadcast.id);

    return NextResponse.json({
      status: "success",
      data: {
        ...broadcast,
        sent_count: sentCount,
        failed_count: failedCount,
        failures: results.filter((r) => !r.ok).map((r) => ({ group_jid: r.jid, error: r.error })),
      },
    });
  }

  return NextResponse.json({ status: "success", data: broadcast });
}

// PATCH: Update broadcast status (e.g., cancel draft)
export async function PATCH(request: Request) {
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

  const { id, status } = (body ?? {}) as { id?: string; status?: string };

  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("broadcasts")
    .select("id, instance_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ status: "error", error: "Not found" }, { status: 404 });
  }

  const { data: instance } = await supabase
    .from("instances")
    .select("admin_id")
    .eq("id", existing.instance_id)
    .single();

  if (!instance || instance.admin_id !== user.id) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  const { error } = await supabase.from("broadcasts").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success" });
}
