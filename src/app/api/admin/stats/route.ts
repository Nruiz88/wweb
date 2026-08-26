import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

async function getAuthUser() {
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
  return user;
}

export async function GET() {
  const user = await getAuthUser();
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
    return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
  }

  // Run all counts in parallel
  const [
    usersCount,
    instancesCount,
    connectedCount,
    autoResponsesCount,
    logsCount,
    activeAutoResponsesCount,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("instances").select("id", { count: "exact", head: true }),
    supabase.from("instances").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("auto_responses").select("id", { count: "exact", head: true }),
    supabase.from("response_logs").select("id", { count: "exact", head: true }),
    supabase.from("auto_responses").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  // Total de bots extra (suma de quantity de add-ons activos)
  const { data: addons } = await supabase
    .from("instance_addons")
    .select("quantity")
    .eq("status", "active");
  const totalAddonBots = (addons ?? []).reduce((sum, a) => sum + (a.quantity ?? 0), 0);

  // Recent activity (last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentLogs } = await supabase
    .from("response_logs")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", oneDayAgo);

  // Recent users (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentUsers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);

  return NextResponse.json({
    status: "success",
    data: {
      totalUsers: usersCount.count ?? 0,
      totalInstances: instancesCount.count ?? 0,
      connectedInstances: connectedCount.count ?? 0,
      totalAutoResponses: autoResponsesCount.count ?? 0,
      activeAutoResponses: activeAutoResponsesCount.count ?? 0,
      totalLogs: logsCount.count ?? 0,
      recentLogs24h: recentLogs ?? 0,
      recentUsers7d: recentUsers ?? 0,
      totalAddonBots,
    },
  });
}
