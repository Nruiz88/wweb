import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: Activity for last 7 days (logs per day) + user registrations
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const days = 7;
  const now = new Date();
  const daysAgo = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  daysAgo.setHours(0, 0, 0, 0);

  const logs = await query<{ sent_at: string }>(
    "SELECT sent_at FROM response_logs WHERE sent_at >= ?",
    [daysAgo.toISOString()]
  );
  const newUsers = await query<{ created_at: string }>(
    "SELECT created_at FROM profiles WHERE created_at >= ?",
    [daysAgo.toISOString()]
  );

  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(daysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    series.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("es-AR", { weekday: "short" }),
      responses: 0,
      newUsers: 0,
    });
  }

  const idxByDate = new Map(series.map((s, i) => [s.date, i]));
  for (const l of logs) {
    const date = (l.sent_at as string).slice(0, 10);
    const i = idxByDate.get(date);
    if (i !== undefined) series[i].responses += 1;
  }
  for (const u of newUsers) {
    const date = (u.created_at as string).slice(0, 10);
    const i = idxByDate.get(date);
    if (i !== undefined) series[i].newUsers += 1;
  }

  const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const kwLogs = await query<{ matched_keyword: string }>(
    "SELECT matched_keyword FROM response_logs WHERE sent_at >= ?",
    [weekAgo]
  );

  const kwCount = new Map();
  for (const l of kwLogs) {
    const kw = (l.matched_keyword as string) || "otro";
    kwCount.set(kw, (kwCount.get(kw) || 0) + 1);
  }
  const topKeywords = [...kwCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([keyword, count]) => ({ keyword, count }));

  return NextResponse.json({
    status: "success",
    data: { series, topKeywords },
  });
}
