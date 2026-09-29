import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendTextMessage } from "@/lib/evolution-multi";
import { safeErrorMessage, verifyUserAccess } from "@/lib/api-helpers";
import { getSession } from "@/lib/auth";

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
  const now = new Date();
  // Wider window since runs once per day
  const in30h = new Date(now.getTime() + 30 * 60 * 60 * 1000);

  const dateStrNow = now.toISOString().slice(0, 10);
  const dateStr30h = in30h.toISOString().slice(0, 10);

  const appointments = await query<{
    id: string;
    instance_id: string;
    customer_phone: string;
    customer_name: string | null;
    appointment_date: string;
    appointment_time: string;
    status: string;
    reminder_24h_sent: boolean;
  }>(
    `SELECT id, instance_id, customer_phone, customer_name,
            appointment_date, appointment_time, status, reminder_24h_sent
     FROM appointments
     WHERE status IN ('pending','confirmed')
       AND reminder_24h_sent = false
       AND appointment_date >= ? AND appointment_date <= ?
     ORDER BY appointment_date ASC, appointment_time ASC`,
    [dateStrNow, dateStr30h]
  );

  if (!appointments || appointments.length === 0) {
    return { status: "success" as const, processed: 0, failed: 0, total: 0, message: "No reminders to send" };
  }

  const instanceIds = [...new Set(appointments.map((a) => a.instance_id))];
  const instances = await query<{
    id: string;
    instance_name: string;
    evolution_api_url: string;
    evolution_api_key: string;
    status: string;
    status_checked_at: string | null;
  }>(
    "SELECT id, instance_name, evolution_api_url, evolution_api_key FROM instances WHERE id IN (" + instanceIds.map(() => "?").join(", ") + ")",
    instanceIds
  );

  const instanceMap = new Map((instances || []).map((i) => [i.id, i]));

  let processed = 0;
  let failed = 0;

  for (const appt of appointments) {
    const instance = instanceMap.get(appt.instance_id);
    if (!instance) { failed++; continue; }

    // `appointment_date` (DATE) y `appointment_time` (TIME) llegan como
    // "YYYY-MM-DD" y "HH:MM:SS" (pool con dateStrings). Con Timezone se
    // interpreta como hora local del navegador, que no es la del negocio.
    const apptDateTime = new Date(`${appt.appointment_date}T${(appt.appointment_time || "").slice(0, 5)}:00Z`);
    const hoursUntil = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    // Wider window (18-30h) since we run once per day
    if (Number.isNaN(hoursUntil) || hoursUntil < 18 || hoursUntil > 30) continue;

    // `customer_phone` es NULLABLE (el booking por link público no lo exige).
    // El `.replace()` original reventaba con TypeError y, sin try/catch por
    // turno, abortaba el LOTE ENTERO: un solo turno sin teléfono impedía
    // recordar todos los demás.
    if (!appt.customer_phone) { failed++; continue; }
    const phone = appt.customer_phone.replace("@s.whatsapp.net", "").replace("@lid", "");
    const dateDisplay = formatDate(appt.appointment_date, appt.appointment_time);
    const name = appt.customer_name || "";

    // TEXTO, no botones: se comprobó que `sendButtonMessage` devuelve 200 pero
    // Evolution envuelve el interactiveMessage en un `viewOnceMessage`, así que
    // el recordatorio NO le llegaba al cliente (era invisible, no fallaba).
    // El cliente confirma respondiendo con el número, que el webhook ya sabe
    // interpretar.
    const result = await sendTextMessage(
      instance.evolution_api_url,
      instance.evolution_api_key,
      instance.instance_name,
      phone,
      "╭━━━━━━━━━━━━━━━━━━━━━╮\n" +
        `  ⏰  *RECORDATORIO DE TURNO*${name ? `\n  para ${name}` : ""}\n` +
        "╰━━━━━━━━━━━━━━━━━━━━━╯\n\n" +
        `📅  *${dateDisplay}*\n\n` +
        "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n" +
        "  Respondé con un número:\n" +
        "  *1*  ✅ Confirmo que voy\n" +
        "  *2*  ❌ Necesito cancelarlo",
      1200,
    );

    // Solo se marca como enviado si Evolution lo entregó: antes el UPDATE iba
    // ANTES de mirar `result.ok`, así que un fallo nunca se reintentaba.
    if (result.ok) {
      await query("UPDATE appointments SET reminder_24h_sent = true WHERE id = ?", [appt.id]);
      processed++;
    } else {
      failed++;
    }
  }

  return { status: "success" as const, processed, failed, total: appointments.length };
}

/** Preview upcoming reminders for a specific instance */
async function previewReminders(instanceId: string) {
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const appointments = await query<{
    id: string;
    customer_phone: string;
    customer_name: string | null;
    appointment_date: string;
    appointment_time: string;
    status: string;
    reminder_24h_sent: boolean;
  }>(
    `SELECT id, customer_phone, customer_name, appointment_date, appointment_time, status, reminder_24h_sent
     FROM appointments
     WHERE instance_id = ? AND status IN ('pending','confirmed')
       AND appointment_date >= ? AND appointment_date <= ?
     ORDER BY appointment_date ASC, appointment_time ASC`,
    [instanceId, now.toISOString().slice(0, 10), in7days.toISOString().slice(0, 10)]
  );

  return NextResponse.json({ status: "success", data: appointments });
}

/**
 * Autorización del disparo de recordatorios.
 *
 * Dos caminos válidos:
 *  1. `Authorization: Bearer <CRON_SECRET>` — lo usan las Schedule Tasks.
 *  2. Sesión de admin — para disparar a mano desde el panel, sin depender de
 *     que CRON_SECRET esté configurado en Coolify (que hoy no lo está, y por
 *     eso el cron automático no corría).
 *
 * Fail-CLOSED: sin ninguno de los dos, se rechaza. Con la versión anterior
 * (sin secret seteado el chequeo se saltaba) cualquier POST anónimo disparaba
 * WhatsApp a todos los clientes.
 */
async function isAuthorizedCron(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const session = await getSession();
  if (session?.role === "admin") return true;

  console.warn("[reminder] trigger rechazado (sin CRON_SECRET válido y sin sesión admin)");
  return false;
}

// GET: Vercel cron calls this every day (with CRON_SECRET)
// GET with ?instanceId=... returns a preview (requires session + instance access)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");

  // La rama de preview devolvía customer_phone y customer_name de TODOS los
  // turnos de cualquier instancia sin sesión, sin CRON_SECRET y sin
  // verifyUserAccess(): fuga de PII trivial desde fuera.
  if (instanceId) {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    }
    if (!(await verifyUserAccess(session.userId, instanceId))) {
      return NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
    }
    return previewReminders(instanceId);
  }

  if (!(await isAuthorizedCron(request))) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  // processReminders() siempre devuelve status "success" (contadores), asi que
  // la rama de error era inalcanzable y TypeScript lo senalaba.
  const result = await processReminders();
  return NextResponse.json({ status: "success", data: result });
}

// POST: Manual trigger or legacy cron (with CRON_SECRET)
export async function POST(request: Request) {
  if (!(await isAuthorizedCron(request))) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  // processReminders() siempre devuelve status "success" (contadores), asi que
  // la rama de error era inalcanzable y TypeScript lo senalaba.
  const result = await processReminders();
  return NextResponse.json({ status: "success", data: result });
}
