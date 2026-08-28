import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  // Run all counts in parallel
  const [
    usersCount,
    instancesCount,
    connectedCount,
    autoResponsesCount,
    logsCount,
    activeAutoResponsesCount,
    appointmentsCount,
    pendingAppointmentsCount,
    groupSettingsCount,
    broadcastsCount,
    completedBroadcastsCount,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("instances").select("id", { count: "exact", head: true }),
    supabase.from("instances").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("auto_responses").select("id", { count: "exact", head: true }),
    supabase.from("response_logs").select("id", { count: "exact", head: true }),
    supabase.from("auto_responses").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("appointments").select("id", { count: "exact", head: true }),
    supabase.from("appointments").select("id", { count: "exact", head: true }).in("status", ["pending", "confirmed"]),
    supabase.from("group_settings").select("id", { count: "exact", head: true }),
    supabase.from("broadcasts").select("id", { count: "exact", head: true }),
    supabase.from("broadcasts").select("id", { count: "exact", head: true }).eq("status", "completed"),
  ]);

  const { data: addons } = await supabase
    .from("instance_addons")
    .select("quantity")
    .eq("status", "active");
  const totalAddonBots = (addons ?? []).reduce((sum, a) => sum + (a.quantity ?? 0), 0);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentLogs } = await supabase
    .from("response_logs")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", oneDayAgo);

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
      totalAppointments: appointmentsCount.count ?? 0,
      pendingAppointments: pendingAppointmentsCount.count ?? 0,
      totalGroupSettings: groupSettingsCount.count ?? 0,
      totalBroadcasts: broadcastsCount.count ?? 0,
      completedBroadcasts: completedBroadcastsCount.count ?? 0,
    },
  });
}
