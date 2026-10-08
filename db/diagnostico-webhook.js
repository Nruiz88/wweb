/* =========================================================
   Qué está llegando al webhook, de verdad
   ---------------------------------------------------------
   Lee `bots_webhook_logs` y cuenta SOLO el tráfico real: los
   mensajes de las pruebas salen del JID `5491100000000@c.us` y de bots
   que se borran al terminar, así que se pueden separar.

   Útil cuando el bot "no responde": la diferencia entre que no
   llegue nada, llegue sin firma válida, o llegue y no encuentre el
   bot es lo que decide dónde mirar.

     node db/diagnostico-webhook.js [horas]
   ========================================================= */

require("D:/webs/empresa/lib/env").load();
const path = require("path");
const db = require("D:/webs/empresa/lib/supabase").getAdmin();

const JID_PRUEBA = "5491100000000";
const HORAS = Number(process.argv[2] || 72);

(async () => {
  const desde = new Date(Date.now() - HORAS * 3600_000).toISOString();
  console.log(`\n═══ Webhook, últimas ${HORAS} h (desde ${desde}) ═══\n`);

  const { data, error } = await db.rpc("ejecutar_sql", {
    consulta: `
      SELECT event_type, status,
        count(*) AS n,
        max(created_at) AS ultimo,
        count(*) FILTER (WHERE payload->>'from' NOT LIKE '${JID_PRUEBA}%') AS reales
      FROM bots_webhook_logs
      WHERE created_at >= $1
      GROUP BY event_type, status
      ORDER BY ultimo DESC`,
    args: [desde],
  });
  if (error) { console.error("error:", error.message); process.exit(1); }
  console.log("— por tipo de evento —");
  console.dir(data, { depth: null });

  console.log("\n— los últimos 20 mensajes REALES (no de pruebas) —");
  /* Ojo con el filtro: los mensajes que sí procesa el bot loguean
     `payload->>'from'`, pero los que se descartan antes (evento
     desconocido, firma inválida) loguean `auditPayload`, que usa
     `remoteJid`. Buscar solo en `from` mete dentro los descartados y da
     una lista de mensajes reales que nunca llegaron. */
  const { data: reales, error: e2 } = await db.rpc("ejecutar_sql", {
    consulta: `
      SELECT created_at, event_type, status, payload->>'instance' AS instancia,
        coalesce(payload->>'from', payload->>'remoteJid') AS remitente,
        payload->>'text' AS texto, payload->>'matched' AS matcheado,
        payload->>'isLid' AS es_lid
      FROM bots_webhook_logs
      WHERE created_at >= $1
        AND coalesce(payload->>'from', payload->>'remoteJid') NOT LIKE '${JID_PRUEBA}%'
        AND payload->>'instance' NOT LIKE 'prueba-%'
      ORDER BY created_at DESC LIMIT 20`,
    args: [desde],
  });
  if (e2) { console.error("error:", e2.message); process.exit(1); }
  if (!reales || reales.length === 0) console.log("  (ninguno: no llegó NADA desde Evolution)");
  else console.dir(reales, { depth: null });

  console.log("\n— bots y a qué Evolution apuntan —");
  const { data: bots } = await db.rpc("ejecutar_sql", {
    consulta: `SELECT b.id, b.name, b.instance_name, b.slug, s.url AS evolution_url,
        (SELECT count(*) FROM bots_business_hours h WHERE h.bot_id = b.id AND h.is_active) AS dias_activos,
        (SELECT count(*) FROM bots_responses r WHERE r.bot_id = b.id AND r.is_active) AS respuestas
      FROM bots b LEFT JOIN evolution_servers s ON s.id = b.server_id
      ORDER BY b.created_at DESC LIMIT 20`,
    args: [],
  });
  console.dir(bots, { depth: null });

  /* ------------------------------------------------------------
     Qué tiene CONFIGURADO la Evolution, leído del servidor.

     Esto es lo que decide si el bot puede funcionar: si Evolution no
     tiene la URL de este bot apuntando a /api/webhook, o no tiene
     enganchado MESSAGES_UPSERT, entonces NO HAY NADA QUE ARREGLAR
     EN ESTE REPOSITORIO. El mensaje nunca sale de WhatsApp.

     Solo lectura: pide el webhook configurado y las instancias.
     ------------------------------------------------------------ */
  console.log("\n— el webhook que tiene registrado la Evolution (solo lectura) —");

  const env = {};
  for (const l of require("fs").readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  const url = (env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
  const key = env.EVOLUTION_API_KEY || "";

  if (!url || !key) {
    console.log("  · no hay EVOLUTION_API_URL/API_KEY en .env.local, se salta");
  } else {
    const pedir = (ruta) => new Promise((r) => {
      const mod = url.startsWith("https") ? require("https") : require("http");
      const req = mod.request(url + ruta, {
        method: "GET", timeout: 15000,
        headers: { apikey: key, Authorization: "Bearer " + key },
      }, (res) => {
        let c = "";
        res.on("data", (d) => (c += d));
        res.on("end", () => r({ status: res.statusCode, cuerpo: c }));
      });
      req.on("error", (e) => r({ status: 0, cuerpo: e.message }));
      req.on("timeout", function () { this.destroy(); r({ status: 0, cuerpo: "timeout" }); });
      req.end();
    });

    const inst = await pedir("/instance/fetchInstances");
    let lista = [];
    try { lista = JSON.parse(inst.cuerpo); } catch {}
    for (const i of lista) {
      const cfg = await pedir("/webhook/fetchWebhook/" + encodeURIComponent(i.name));
      console.log(`  instancia ${i.name} (${i.connectionStatus}, número ${i.number || "?"})`);
      try {
        const w = JSON.parse(cfg.cuerpo);
        console.log("    url:      " + (w.url || "(SIN URL)"));
        console.log("    webhook:  " + (w.webhook ? "sí" : "NO — Evolution no tiene dónde avisar"));
        console.log("    eventos:  " + (Array.isArray(w.events) ? w.events.join(", ") : "(ninguno)"));
        console.log("    byEvents: " + (w.byEvents ? "sí" : "no (un solo evento)"));
      } catch {
        console.log("    no se pudo leer la config: HTTP " + cfg.status + " " + String(cfg.cuerpo).slice(0, 160));
      }
    }
  }
/* ------------------------------------------------------------
     Columnas de `bots`: sirve para saber dónde guardar una preferencia
     del cliente (por ejemplo la palabra clave de la agenda) sin inventar
     una tabla nueva.
     ------------------------------------------------------------ */
  console.log("\n— columnas de `bots` —");
  const { data: cols } = await db.rpc("ejecutar_sql", {
    consulta: `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'bots' ORDER BY ordinal_position`,
    args: [],
  });
  console.dir(cols, { depth: null });
})();