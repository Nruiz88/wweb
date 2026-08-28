import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";
import { isSafeRegex } from "@/lib/regex-guard";
import { safeErrorMessage, verifyUserAccess } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List auto-responses for user's instance
// Optional ?type=text|menu to filter by response_type.
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const type = searchParams.get("type");

  if (!instanceId) {
    return NextResponse.json(
      { status: "error", error: "instanceId is required" },
      { status: 400 }
    );
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  let query = supabase
    .from("auto_responses")
    .select("*")
    .eq("instance_id", instanceId);

  if (type === "text" || type === "menu") {
    query = query.eq("response_type", type);
  }

  const { data: responses, error } = await query.order("priority", { ascending: false });

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: responses });
}

// POST: Create new auto-response
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
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
    keyword,
    regexPattern,
    responseText,
    responseMediaUrl,
    responseType,
    menuConfig,
    isActive,
    priority,
    schedule,
  } = (body ?? {}) as {
    instanceId?: string;
    keyword?: string;
    regexPattern?: string;
    responseText?: string;
    responseMediaUrl?: string;
    responseType?: string;
    menuConfig?: { title?: string; description?: string; footer?: string; buttons?: { id: string; text: string; target_id: string | null }[] } | null;
    isActive?: boolean;
    priority?: number;
    schedule?: { from?: string; to?: string };
  };

  if (!instanceId) {
    return NextResponse.json(
      { status: "error", error: "instanceId is required" },
      { status: 400 }
    );
  }

  // Menu type: menuConfig is required; text response is optional (used as fallback)
  const isMenu = responseType === "menu";

  if (!isMenu && !responseText) {
    return NextResponse.json(
      { status: "error", error: "responseText is required for text responses" },
      { status: 400 }
    );
  }

  if (isMenu && (!menuConfig || !menuConfig.buttons || menuConfig.buttons.length === 0)) {
    return NextResponse.json(
      { status: "error", error: "menuConfig with at least 1 button is required for menu responses" },
      { status: 400 }
    );
  }

  // Text type: keyword or regexPattern required
  if (!isMenu && !keyword && !regexPattern) {
    return NextResponse.json(
      { status: "error", error: "Either keyword or regexPattern is required" },
      { status: 400 }
    );
  }

  if (regexPattern && !isSafeRegex(regexPattern)) {
    return NextResponse.json(
      { status: "error", error: "El patrón regex es inválido, muy largo o potencialmente peligroso" },
      { status: 400 }
    );
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, instanceId);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Instance not found" }, { status: 404 });
  }

  const { data: response, error } = await supabase
    .from("auto_responses")
    .insert({
      instance_id: instanceId,
      user_id: user.id,
      keyword: keyword || null,
      regex_pattern: regexPattern || null,
      response_text: responseText || "",
      response_media_url: responseMediaUrl || null,
      response_type: isMenu ? "menu" : "text",
      menu_config: menuConfig || null,
      is_active: isActive ?? true,
      priority: priority ?? 0,
      schedule: schedule || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: response });
}

// PUT: Update auto-response
export async function PUT(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
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

  const { id, ...updates } = (body ?? {}) as {
    id?: string;
    keyword?: string;
    regexPattern?: string;
    responseText?: string;
    responseMediaUrl?: string;
    responseType?: string;
    menuConfig?: { title?: string; description?: string; footer?: string; buttons?: { id: string; text: string; target_id: string | null }[] } | null;
    isActive?: boolean;
    priority?: number;
    schedule?: { from?: string; to?: string };
  };

  if (!id) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("auto_responses")
    .select("id, instance_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ status: "error", error: "Auto-response not found" }, { status: 404 });
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, existing.instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  // Build update payload — only include fields that were sent
  const updatePayload: Record<string, unknown> = {};
  if (updates.keyword !== undefined) updatePayload.keyword = updates.keyword;
  if (updates.regexPattern !== undefined) updatePayload.regex_pattern = updates.regexPattern;
  if (updates.responseText !== undefined) updatePayload.response_text = updates.responseText;
  if (updates.responseMediaUrl !== undefined) updatePayload.response_media_url = updates.responseMediaUrl;
  if (updates.responseType !== undefined) updatePayload.response_type = updates.responseType;
  if (updates.menuConfig !== undefined) updatePayload.menu_config = updates.menuConfig;
  if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;
  if (updates.priority !== undefined) updatePayload.priority = updates.priority;
  if (updates.schedule !== undefined) updatePayload.schedule = updates.schedule;

  const { data: response, error } = await supabase
    .from("auto_responses")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: response });
}

// DELETE: Delete auto-response
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
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
    .from("auto_responses")
    .select("id, instance_id")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ status: "error", error: "Auto-response not found" }, { status: 404 });
  }

  const hasAccess = await verifyUserAccess(supabase, user.id, existing.instance_id);
  if (!hasAccess) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 403 });
  }

  const { error } = await supabase.from("auto_responses").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success" });
}
