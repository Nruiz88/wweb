import { NextResponse } from "next/server";
import { createServerClient, getCurrentUser } from "@/lib/supabase/server";
import { rateLimitResponse } from "@/lib/rate-limit";
import { isSafeRegex } from "@/lib/regex-guard";

export const dynamic = "force-dynamic";

async function verifyUserAccess(supabase: Awaited<ReturnType<typeof createServerClient>>, userId: string, instanceId: string) {
  // Check if user is admin (owns the instance)
  const { data: adminInstance } = await supabase
    .from("instances")
    .select("id")
    .eq("id", instanceId)
    .eq("admin_id", userId)
    .single();

  if (adminInstance) return true;

  // Check if user is assigned to the instance
  const { data: assignment } = await supabase
    .from("user_instances")
    .select("id")
    .eq("instance_id", instanceId)
    .eq("user_id", userId)
    .single();

  return !!assignment;
}

// GET: List auto-responses for user's instance
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerClient();

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");

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

  const { data: responses, error } = await supabase
    .from("auto_responses")
    .select("*")
    .eq("instance_id", instanceId)
    .order("priority", { ascending: false });

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: responses });
}

// POST: Create new auto-response
export async function POST(request: Request) {
  const rateLimitErr = rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
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
    isActive,
    priority,
    schedule,
  } = (body ?? {}) as {
    instanceId?: string;
    keyword?: string;
    regexPattern?: string;
    responseText?: string;
    responseMediaUrl?: string;
    isActive?: boolean;
    priority?: number;
    schedule?: { from?: string; to?: string };
  };

  if (!instanceId || !responseText) {
    return NextResponse.json(
      { status: "error", error: "instanceId and responseText are required" },
      { status: 400 }
    );
  }

  if (!keyword && !regexPattern) {
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
      response_text: responseText,
      response_media_url: responseMediaUrl || null,
      is_active: isActive ?? true,
      priority: priority ?? 0,
      schedule: schedule || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: response });
}

// PUT: Update auto-response
export async function PUT(request: Request) {
  const rateLimitErr = rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
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

  const { data: response, error } = await supabase
    .from("auto_responses")
    .update({
      keyword: updates.keyword,
      regex_pattern: updates.regexPattern,
      response_text: updates.responseText,
      response_media_url: updates.responseMediaUrl,
      is_active: updates.isActive,
      priority: updates.priority,
      schedule: updates.schedule,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: response });
}

// DELETE: Delete auto-response
export async function DELETE(request: Request) {
  const rateLimitErr = rateLimitResponse(request, "auto-responses", { maxRequests: 30, windowMs: 60_000 });
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
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success" });
}
