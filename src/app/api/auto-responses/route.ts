import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";
import { isSafeRegex } from "@/lib/regex-guard";
import { verifyUserAccess } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List auto-responses for user's instance
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const type = searchParams.get("type");
  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(session.userId, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  let sql = "SELECT id, keyword, regex_pattern, response_text, response_type, menu_config, is_active, schedule FROM auto_responses WHERE instance_id = ?";
  const params = [instanceId];

  if (type === "text" || type === "menu") {
    sql += " AND response_type = ?";
    params.push(type);
  }

  sql += " ORDER BY priority DESC";
  const responses = await query(sql, params);

  return NextResponse.json({ status: "success", data: responses });
}

// POST: Create new auto-response
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  // La UI envía snake_case (response_text); aceptamos también camelCase (responseText).
  const raw = body as Record<string, unknown>;
  const norm = {
    instanceId: (raw.instanceId as string) ?? (raw.instance_id as string),
    keyword: raw.keyword as string | undefined,
    regexPattern: (raw.regexPattern as string) ?? (raw.regex_pattern as string),
    responseText: (raw.responseText as string) ?? (raw.response_text as string),
    responseMediaUrl: (raw.responseMediaUrl as string) ?? (raw.response_media_url as string),
    responseType: (raw.responseType as string) ?? (raw.response_type as string),
    menuConfig: (raw.menuConfig as any) ?? (raw.menu_config as any),
    isActive: (raw.isActive as boolean) ?? (raw.is_active as boolean),
    priority: raw.priority as number | undefined,
    schedule: raw.schedule as { from?: string; to?: string } | undefined,
  };
  const { instanceId, keyword, regexPattern, responseText, responseMediaUrl, responseType, menuConfig, isActive, priority, schedule } = norm;

  if (!instanceId) {
    return NextResponse.json({ status: "error", error: "instanceId is required" }, { status: 400 });
  }

  const hasAccess = await verifyUserAccess(session.userId, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  if (responseType === "menu" && (!menuConfig || !menuConfig.buttons || menuConfig.buttons.length === 0)) {
    return NextResponse.json({ status: "error", error: "menuConfig with at least 1 button is required for menu responses" }, { status: 400 });
  }

  if ((responseType ?? "text") !== "menu" && !responseText?.trim()) {
    return NextResponse.json({ status: "error", error: "responseText is required for text responses" }, { status: 400 });
  }

  if (regexPattern && !isSafeRegex(regexPattern)) {
    return NextResponse.json({ status: "error", error: "El patrón regex es inválido, muy largo o potencialmente peligroso" }, { status: 400 });
  }

  const id = Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15);
  await query(
    `INSERT INTO auto_responses (id, instance_id, user_id, keyword, regex_pattern, response_text, response_media_url, response_type, menu_config, is_active, priority, schedule, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [id, instanceId, session.userId, keyword || null, regexPattern || null, responseText || "", responseMediaUrl || null, responseType || "text", menuConfig || null, isActive ?? true, priority ?? 0, schedule || null]
  );

  return NextResponse.json({ status: "success", data: { id, instance_id: instanceId, user_id: session.userId, keyword: keyword || null, regex_pattern: regexPattern || null, response_text: responseText || "", response_media_url: responseMediaUrl || null, response_type: responseType || "text", menu_config: menuConfig || null, is_active: isActive ?? true, priority: priority ?? 0, schedule: schedule || null, created_at: new Date().toISOString() } });
}

// PUT: Update auto-response
export async function PUT(request: Request) {
  return updateAutoResponse(request);
}

// La UI usa PATCH (edición y toggle activo) — mismo handler que PUT.
export async function PATCH(request: Request) {
  return updateAutoResponse(request);
}

async function updateAutoResponse(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const rawU = body as Record<string, unknown>;
  const { id, keyword, regexPattern, responseText, responseMediaUrl, responseType, menuConfig, isActive, priority, schedule } = {
    id: rawU.id as string | undefined,
    keyword: (rawU.keyword as string) ?? undefined,
    regexPattern: (rawU.regexPattern as string) ?? (rawU.regex_pattern as string | undefined),
    responseText: (rawU.responseText as string) ?? (rawU.response_text as string | undefined),
    responseMediaUrl: (rawU.responseMediaUrl as string) ?? (rawU.response_media_url as string | undefined),
    responseType: (rawU.responseType as string) ?? (rawU.response_type as string | undefined),
    menuConfig: (rawU.menuConfig as any) ?? (rawU.menu_config as any),
    isActive: (rawU.isActive as boolean) ?? (rawU.is_active as boolean | undefined),
    priority: rawU.priority as number | undefined,
    schedule: rawU.schedule as { from?: string; to?: string } | undefined,
  };
  // El toggle de la UI manda { id, active } — mapear a isActive.
  const isActiveFinal = isActive ?? (rawU.active as boolean | undefined);

  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  // Verify access
  const existing = await query<{ id: string; instance_id: string }>(
    "SELECT id, instance_id FROM auto_responses WHERE id = ? LIMIT 1",
    [id]
  );
  if (!existing.length) {
    return NextResponse.json({ status: "error", error: "Auto-response not found" }, { status: 404 });
  }

  const hasAccess = await verifyUserAccess(session.userId, existing[0].instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  const updates = {};
  if (keyword !== undefined) updates.keyword = keyword;
  if (regexPattern !== undefined) updates.regex_pattern = regexPattern;
  if (responseText !== undefined) updates.response_text = responseText;
  if (responseMediaUrl !== undefined) updates.response_media_url = responseMediaUrl;
  if (responseType !== undefined) updates.response_type = responseType;
  if (menuConfig !== undefined) updates.menu_config = menuConfig;
  if (isActiveFinal !== undefined) updates.is_active = isActiveFinal;
  if (priority !== undefined) updates.priority = priority;
  if (schedule !== undefined) updates.schedule = schedule;

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`);
  const values = [...Object.values(updates), id];

  await query(`UPDATE auto_responses SET ${setClauses.join(", ")} WHERE id = ?`, values);

  return NextResponse.json({ status: "success", data: { id, ...updates } });
}

// DELETE: Delete auto-response
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const existing = await query<{ id: string; instance_id: string }>(
    "SELECT id, instance_id FROM auto_responses WHERE id = ? LIMIT 1",
    [id]
  );
  if (!existing.length) {
    return NextResponse.json({ status: "error", error: "Auto-response not found" }, { status: 404 });
  }

  const hasAccess = await verifyUserAccess(session.userId, existing[0].instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  await query("DELETE FROM auto_responses WHERE id = ?", [id]);
  return NextResponse.json({ status: "success" });
}
