import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

// GET: Activity for last 7 days (logs per day) + user registrations
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const days = 7;
  const now = new Date();
  const daysAgo = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  daysAgo.setHours(0, 0, 0, 0);

  const { data: logs } = await supabase
    .from("response_logs")
    .select("sent_at")
    .gte("sent_at", daysAgo.toISOString());

  const { data: newUsers } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", daysAgo.toISOString());

  const series: { date: string; label: string; responses: number; newUsers: number }[] = [];
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
  for (const l of logs ?? []) {
    const date = (l.sent_at as string).slice(0, 10);
    const i = idxByDate.get(date);
    if (i !== undefined) series[i].responses += 1;
  }
  for (const u of newUsers ?? []) {
    const date = (u.created_at as string).slice(0, 10);
    const i = idxByDate.get(date);
    if (i !== undefined) series[i].newUsers += 1;
  }

  const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const { data: kwLogs } = await supabase
    .from("response_logs")
    .select("matched_keyword")
    .gte("sent_at", weekAgo);

  const kwCount = new Map<string, number>();
  for (const l of kwLogs ?? []) {
    const kw = (l.matched_keyword as string) || "otro";
    kwCount.set(kw, (kwCount.get(kw) ?? 0) + 1);
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
