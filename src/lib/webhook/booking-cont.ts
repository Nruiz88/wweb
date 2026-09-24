import { query } from "../db";
import type { WebhookContext } from "./context";
import { sendTextMessage, sendButtonMessage } from "../evolution-multi";
import { slugify } from "../slug";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

async function sendText(ctx: WebhookContext, text: string, delay?: number) {
  return sendTextMessage(ctx.instance.evolution_api_url, ctx.instance.evolution_api_key, ctx.instance.instance_name, ctx.phoneNumber, text, delay);
}

async function sendButton(ctx: WebhookContext, title: string, description: string, buttons: ButtonItem[], delay?: number) {
  return sendButtonMessage(ctx.instance.evolution_api_url, ctx.instance.evolution_api_key, ctx.instance.instance_name, ctx.phoneNumber, title, description, buttons, undefined, delay);
}

/** Agenda menu dispatcher */
export async function handleAgendaMenu(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  await markAgendaActive(ctx);
  const { effectiveText } = ctx;
  if (effectiveText === "agenda_hoy") return handleAgendaHoy(ctx);
  if (effectiveText === "agenda_proximo") return handleAgendaProximo(ctx);
  if (effectiveText === "agenda_completa") return handleAgendaCompleta(ctx);
  await sendText(ctx, "🗓️ *¿Qué querés ver?*\n\n1️⃣ 🕐 *Libre hoy*\n2️⃣ ⏭️ *Libre más próximo*\n3️⃣ 📅 *Agenda completa*\n\nRespondé con el número o la opción 👇", 1500);
  return { status: "success", matched: "turno menú agenda" };
}

async function handleAgendaHoy(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber } = ctx;
  const today = localDateStr(new Date());
  const { slots, hours } = await getAvailableSlots(ctx, today);
  if (!hours) {
    await sendText(ctx, "❌ *Hoy no hay horarios configurados.*\n\nRespondé 2️⃣ para ver el próximo día o 3️⃣ para la agenda completa.", 1500);
    return { status: "success", matched: "turno hoy sin agenda" };
  }
  if (slots.length === 0) {
    await sendText(ctx, "❌ *Hoy no quedan horarios libres.*\n\nRespondé 2️⃣ para ver el próximo día o 3️⃣ para la agenda completa.", 1500);
    return { status: "success", matched: "turno hoy sin slots" };
  }
  const dateStr = formatDateStr(today);
  const list = slots.map((t, i) => `   ${i + 1}.  🕐  ${t} hs`).join("\n");
  await sendText(ctx, `🕐 *Horarios libres HOY* — ${dateStr}\n\n_Elegí un horario y respondé con su número:_\n\n${list}\n\n0️⃣  🔙 Volver atrás`, 1500);
  await rememberDate(ctx, today);
  return { status: "success", matched: "turno hoy" };
}

async function handleAgendaProximo(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { instance, phoneNumber } = ctx;
  const now = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = localDateStr(d);
    const { slots } = await getAvailableSlots(ctx, dateStr);
    if (slots.length > 0) {
      const dateStr2 = formatDateStr(dateStr);
      const list = slots.map((t, idx) => `   ${idx + 1}.  🕐  ${t} hs`).join("\n");
      await sendText(ctx, `⏭️ *Próximo día con horarios libres* — ${dateStr2}\n\n_Elegí un horario y respondé con su número:_\n\n${list}\n\n0️⃣  🔙 Volver atrás`, 1500);
      await rememberDate(ctx, dateStr);
      return { status: "success", matched: "turno próximo" };
    }
  }
  await sendText(ctx, "❌ No encontré disponibilidad en los próximos 14 días. Escribí más tarde.", 1500);
  return { status: "success", matched: "turno sin disponibilidad" };
}

async function handleAgendaCompleta(ctx: WebhookContext): Promise<{ status: string; matched: string } | null> {
  const { supabase, instance, phoneNumber } = ctx;
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    await sendText(ctx, "Lo siento, la agenda completa aún no está disponible. Escribí 'turno' para ver horarios.", 1500);
    return { status: "success", matched: "turno sin link" };
  }
  const [{ rows: inst }] = await query<{ admin_id: string }>("SELECT admin_id FROM instances WHERE id = ? LIMIT 1", [instance.id]);
  if (!inst?.length || !inst[0].admin_id) {
    await sendText(ctx, "Lo siento, no pudimos generar el link de agenda. Escribí 'turno' para ver horarios.", 1500);
    return { status: "success", matched: "turno sin link" };
  }
  const [{ rows: owner }] = await query<{ business_name: string | null; email: string }>("SELECT business_name, email FROM profiles WHERE id = ? LIMIT 1", [inst[0].admin_id]);
  const businessName = owner?.[0]?.business_name?.trim() || "";
  if (!owner || (!businessName && !owner[0].email)) {
    await sendText(ctx, "Lo siento, no pudimos generar el link de agenda. Escribí 'turno' para ver horarios.", 1500);
    return { status: "success", matched: "turno sin link" };
  }
  const identifier = businessName ? slugify(businessName) : slugify(owner[0].email!);
  const link = `${baseUrl}/agendar?business=${encodeURIComponent(identifier)}`;
  console.log("[agenda] link generado", { link, appUrl: baseUrl, identifier });
  await sendText(ctx, `📅 Mirá toda la disponibilidad y reservá acá:\n\n${link}`, 1500);
  return { status: "success", matched: "turno agenda completa" };
}
