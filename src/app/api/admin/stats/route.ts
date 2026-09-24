import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin/auth";
import { query } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      usersResult, instancesResult, activeInstancesResult, autoResponsesResult,
      appointmentsResult, pendingAppointmentsResult, messagesLastDayResult
    ] = await Promise.all([
      query("SELECT COUNT(*) as count FROM profiles"),
      query("SELECT COUNT(*) as count FROM instances"),
      query("SELECT COUNT(*) as count FROM instances WHERE status = 'open'"),
      query("SELECT COUNT(*) as count FROM auto_responses WHERE is_active = true"),
      query("SELECT COUNT(*) as count FROM appointments WHERE status IN ('pending','confirmed')"),
      query("SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'"),
      query("SELECT COUNT(*) as count FROM response_logs WHERE sent_at >= ?", [oneDayAgo]),
    ]);

    const [{ rows: recentKeywords }] = await query<{ matched_keyword: string }>(
      "SELECT matched_keyword FROM response_logs WHERE sent_at >= ? LIMIT 500",
      [sevenDaysAgo]
    );

    const keywordCounts = {};
    for (const r of recentKeywords) {
      const kw = r.matched_keyword || "(sin keyword)";
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    }
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    return NextResponse.json({
      status: "success",
      data: {
        totalUsers: usersResult[0]?.count || 0,
        totalInstances: instancesResult[0]?.count || 0,
        activeInstances: activeInstancesResult[0]?.count || 0,
        totalAutoResponses: autoResponsesResult[0]?.count || 0,
        totalAppointments: appointmentsResult[0]?.count || 0,
        pendingAppointments: pendingAppointmentsResult[0]?.count || 0,
        messagesLastDay: messagesLastDayResult[0]?.count || 0,
        topKeywords,
      },
    });
  } catch (error) {
    return NextResponse.json({ status: "error", error: String(error) }, { status: 500 });
  }
}
