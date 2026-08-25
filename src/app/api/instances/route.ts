import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

// GET: List instances
export async function GET(request: Request) {
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
      .select("id, instance_name, status, created_at")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "success", data: instances, role: "admin" });
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
    .select("id, instance_name, status, created_at")
    .in("id", assignments.map((a) => a.instance_id));

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: instances, role: "user" });
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

  if (!instanceName || !evolutionApiUrl || !evolutionApiKey) {
    return NextResponse.json({ status: "error", error: "All fields are required" }, { status: 400 });
  }

  const { data: instance, error } = await supabase
    .from("instances")
    .insert({ admin_id: user.id, instance_name: instanceName, evolution_api_url: evolutionApiUrl, evolution_api_key: evolutionApiKey })
    .select("id, instance_name, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ status: "error", error: error.message }, { status: 500 });
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
  if (error) return NextResponse.json({ status: "error", error: error.message }, { status: 500 });

  return NextResponse.json({ status: "success" });
}
