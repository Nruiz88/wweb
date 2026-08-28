import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendButtonMessage } from "@/lib/evolution-multi";
import type { ButtonItem } from "@/lib/evolution-multi";
import { safeErrorMessage } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatDate(dateStr: string, timeStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = DAYS_ES[d.getDay()];
  const dayNum = d.getDate();
  const month = MONTHS_ES[d.getMonth()];
  const [h, m] = timeStr.split(":");
  return `${day} ${dayNum} ${month} a las ${h}:${m}`;
}

/** Process reminders: find appointments ~24h away and send WhatsApp reminders */
async function processReminders() {
  const supabase = await createServerClient();

  const now = new Date();
  // Wider window since Vercel Hobby runs once per day
  const in30h = new Date(now.getTime() + 30 * 60 * 60 * 1000);

  const dateStrNow = now.toISOString().slice(0, 10);
  const dateStr30h = in30h.toISOString().slice(0, 10);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(`
      id, instance_id, customer_phone, customer_name,
      appointment_date, appointment_time, status,
      reminder_24h_sent
    `)
    .in("status", ["pending", "confirmed"])
    .eq("reminder_24h_sent", false)
    .gte("appointment_date", dateStrNow)
    .lte("appointment_date", dateStr30h);

  if (error) {
    return { status: "error" as const, error: safeErrorMessage(error) };
  }

  if (!appointments || appointments.length === 0) {
    return { status: "success" as const, processed: 0, failed: 0, total: 0, message: "No reminders to send" };
  }

  const instanceIds = [...new Set(appointments.map((a) => a.instance_id))];
  const { data: instances } = await supabase
    .from("instances")
    .select("id, instance_name, evolution_api_url, evolution_api_key")
    .in("id", instanceIds);

  const instanceMap = new Map((instances || []).map((i) => [i.id, i]));

  let processed = 0;
  let failed = 0;

  for (const appt of appointments) {
    const instance = instanceMap.get(appt.instance_id);
    if (!instance) { failed++; continue; }

    const apptDateTime = new Date(`${appt.appointment_date}T${appt.appointment_time}`);
    const hoursUntil = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    // Wider window (18-30h) since we run once per day
    if (hoursUntil < 18 || hoursUntil > 30) continue;

    const phone = appt.customer_phone.replace("@s.whatsapp.net", "").replace("@lid", "");
    const dateDisplay = formatDate(appt.appointment_date, appt.appointment_time);
    const name = appt.customer_name || "";

    const title = `⏰ Recordatorio${name ? ` para ${name}` : ""}`;
    const description = `Tu turno es ${dateDisplay}. ¿Confirmás?`;

    const buttons: ButtonItem[] = [
      { type: "reply", displayText: "✅ Confirmar", id: `confirm_${appt.id}` },
      { type: "reply", displayText: "❌ Cancelar", id: `cancel_${appt.id}` },
    ];

    const result = await sendButtonMessage(
      instance.evolution_api_url,
      instance.evolution_api_key,
      instance.instance_name,
      phone,
      title,
      description,
      buttons,
      "Boti Recordatorios",
      1500,
    );

    await supabase
      .from("appointments")
      .update({ reminder_24h_sent: true })
      .eq("id", appt.id);

    if (result.ok) { processed++; }
    else { failed++; }
  }

  return { status: "success" as const, processed, failed, total: appointments.length };
}

/** Preview upcoming reminders for a specific instance */
async function previewReminders(instanceId: string) {
  const supabase = await createServerClient();
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("id, customer_phone, customer_name, appointment_date, appointment_time, status, reminder_24h_sent")
    .eq("instance_id", instanceId)
    .in("status", ["pending", "confirmed"])
    .gte("appointment_date", now.toISOString().slice(0, 10))
    .lte("appointment_date", in7days.toISOString().slice(0, 10))
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true });

  if (error) {
    return NextResponse.json({ status: "error", error: safeErrorMessage(error) }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data: appointments });
}

// GET: Vercel cron calls this every hour (with CRON_SECRET)
// GET with ?instanceId=... returns preview instead
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");

  // If instanceId provided, return preview (dashboard use)
  if (instanceId) {
    return previewReminders(instanceId);
  }

  // Otherwise, treat as cron trigger
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const result = await processReminders();
  if (result.status === "error") {
    return NextResponse.json({ status: "error", error: result.error }, { status: 500 });
  }
  return NextResponse.json({ status: "success", data: result });
}

// POST: Manual trigger or legacy cron (with CRON_SECRET)
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  const result = await processReminders();
  if (result.status === "error") {
    return NextResponse.json({ status: "error", error: result.error }, { status: 500 });
  }
  return NextResponse.json({ status: "success", data: result });
}
