import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { safeErrorMessage } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      usersResult,
      instancesResult,
      activeInstancesResult,
      autoResponsesResult,
      appointmentsResult,
      completedBroadcastsResult,
      pendingAppointmentsResult,
      groupSettingsResult,
      totalBroadcastsResult,
      messagesLastDayResult,
      activeKeywordsResult,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("instances").select("id", { count: "exact", head: true }),
      supabase.from("instances").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("auto_responses").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("appointments").select("id", { count: "exact", head: true }).in("status", ["pending", "confirmed"]),
      supabase.from("broadcasts").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("group_settings").select("id", { count: "exact", head: true }),
      supabase.from("broadcasts").select("id", { count: "exact", head: true }),
      supabase.from("response_logs").select("id", { count: "exact", head: true }).gte("sent_at", oneDayAgo),
      supabase.from("response_logs").select("matched_keyword", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    ]);

    // Top keywords
    const { data: recentKeywords } = await supabase
      .from("response_logs")
      .select("matched_keyword")
      .gte("sent_at", sevenDaysAgo)
      .limit(500);

    const keywordCounts: Record<string, number> = {};
    (recentKeywords || []).forEach((r) => {
      const kw = r.matched_keyword || "(sin keyword)";
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    });
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    return NextResponse.json({
      status: "success",
      data: {
        totalUsers: usersResult.count || 0,
        totalInstances: instancesResult.count || 0,
        activeInstances: activeInstancesResult.count || 0,
        totalAutoResponses: autoResponsesResult.count || 0,
        totalAppointments: appointmentsResult.count || 0,
        pendingAppointments: pendingAppointmentsResult.count || 0,
        completedBroadcasts: completedBroadcastsResult.count || 0,
        totalBroadcasts: totalBroadcastsResult.count || 0,
        totalGroupSettings: groupSettingsResult.count || 0,
        messagesLastDay: messagesLastDayResult.count || 0,
        topKeywords,
      },
    });
  } catch (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }
}
