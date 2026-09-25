const crypto = require("crypto");
const mysql = require("mysql2/promise");
const SECRET = process.env.WEBHOOK_SECRET;
const APP = "http://localhost:3000";
const INSTANCE = "Boti 1";
const PHONE = "5499999999999";
(async () => {
  // ── Preparar: keyword activa temporal en la instancia real ──
  const c = await mysql.createConnection({host: "gshf0yoslctmxtsjam0jflja", user: "mariadb", password: "mIn0AC6V2mWf2nnYa3SFbv8eDCtClul9y3Q0mAElpCRtxGfFlxV55LWHvy3k0h4I", database: "default"});
  const [inst] = await c.query("SELECT id FROM instances WHERE instance_name = ?", [INSTANCE]);
  const instanceId = inst[0].id;
  const arId = "qa_e2e_" + Date.now();
  await c.query("INSERT INTO auto_responses (id, instance_id, user_id, response_type, keyword, response_text, is_active, priority) VALUES (?, ?, (SELECT admin_id FROM instances WHERE id = ?), 'text', 'qa-e2e-test', 'RESPUESTA E2E OK', 1, 999)", [arId, instanceId, instanceId]);
  console.log("auto_respuesta de prueba creada:", arId);

  // ── 1) Logout (antes 404) ──
  let r = await fetch(APP + "/api/auth/logout", {method: "POST"});
  console.log("logout:", r.status, await r.text());

  // ── 2) Health ──
  r = await fetch(APP + "/api/health");
  console.log("health:", r.status);

  // ── 3) Webhook E2E: mensaje real firmado con la keyword ──
  const payload = JSON.stringify({event: "messages.upsert", instance: INSTANCE, data: {key: {remoteJid: PHONE + "@s.whatsapp.net", fromMe: false, id: "QA" + Date.now()}, message: {conversation: "qa-e2e-test"}, pushName: "QA E2E", messageTimestamp: Math.floor(Date.now() / 1000)}});
  const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  r = await fetch(APP + "/api/webhook", {method: "POST", headers: {"Content-Type": "application/json", "x-webhook-secret": sig}, body: payload});
  const wb = await r.json().catch(() => null);
  console.log("webhook:", r.status, JSON.stringify(wb).slice(0, 200));

  // ── 4) Verificar en DB: response_logs debe registrar el match ──
  const [logs] = await c.query("SELECT id, incoming_message, matched_keyword FROM response_logs WHERE instance_id = ? AND incoming_phone LIKE ? ORDER BY sent_at DESC LIMIT 1", [instanceId, PHONE.slice(-4) + "%"]);
  console.log("response_log:", JSON.stringify(logs));
  await c.query("DELETE FROM auto_responses WHERE id = ?", [arId]);
  await c.end();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
