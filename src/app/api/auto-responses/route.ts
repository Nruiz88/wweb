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

  const { instanceId, keyword, regexPattern, responseText, responseMediaUrl, responseType, menuConfig, isActive, priority, schedule } = body as {
    instanceId?: string;
    keyword?: string;
    regexPattern?: string;
    responseText?: string;
    responseMediaUrl?: string;
    responseType?: string;
    menuConfig?: any;
    isActive?: boolean;
    priority?: number;
    schedule?: { from?: string; to?: string };
  };

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

  if (responseType !== "menu" && !responseText) {
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
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 }); }

  const { id, keyword, regexPattern, responseText, responseMediaUrl, responseType, menuConfig, isActive, priority, schedule } = body as {
    id?: string;
    keyword?: string;
    regexPattern?: string;
    responseText?: string;
    responseMediaUrl?: string;
    responseType?: string;
    menuConfig?: any;
    isActive?: boolean;
    priority?: number;
    schedule?: { from?: string; to?: string };
  };

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
  if (isActive !== undefined) updates.is_active = isActive;
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
