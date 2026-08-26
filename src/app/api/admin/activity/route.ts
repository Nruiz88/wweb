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

// GET: Actividad de los ultimos 7 dias (logs por dia) + registro de usuarios
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

  const days = 7;
  const now = new Date();
  const daysAgo = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  daysAgo.setHours(0, 0, 0, 0);

  // Logs por dia (respuestas enviadas)
  const { data: logs } = await supabase
    .from("response_logs")
    .select("sent_at")
    .gte("sent_at", daysAgo.toISOString());

  // Usuarios nuevos por dia
  const { data: newUsers } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", daysAgo.toISOString());

  // Inicializar series con ceros
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

  // Top keywords de la semana
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