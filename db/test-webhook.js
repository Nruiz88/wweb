/* =========================================================
   Prueba del webhook, de punta a punta
   =========================================================
   POR QUÉ ESTA PRUEBA

   Todo lo anterior comprobaba que el bot se VE bien. Esta comprueba que
   hace lo único para lo que existe: recibir un mensaje de WhatsApp y
   responder.

   Es la parte que más se ha tocado y menos se ha probado. `tsc` no dice
   nada de un `INSERT` a una tabla que no existe, ni de un `query()` que
   solo admite SELECT. Eso no falla al compilar: falla calladito dentro de
   un `catch`, y el webhook sigue contestando como si nada.

   Y ya encontró uno: `logWebhook` apuntaba a `webhook_logs` (la tabla
   real es `bots_webhook_logs`) y escribía por `query()`, que rechaza
   escrituras. El resultado era que `bots_webhook_logs` estaba siempre
   vacía.

   CÓMO SE PRUEBA SIN MOLESTAR A NADIE

   Un Evolution FALSO en un puerto propio, que graba cada llamada en vez
   de enviar WhatsApp de verdad. Así se puede afirmar exactamente qué
   habría salido por el cable, sin que ese texto llegue a ninguna parte.

   El JID del remitente es inventado (`5491100000000@c.us`, un rango que
   no existe). Aunque la prueba usara la Evolution real, ese número no
   pertenece a nadie y no se entrega a nadie.

   Al final hay una comprobación contra la Evolution de verdad
   ( Railway, instancia `Boti 1`) que solo lee estado. Verifica que las
   URLs, la clave y el nombre de instancia que usa el código coinciden con
   los del servidor, sin enviar mensajes.

   ------------------------------------------------------------
   USO

     node db/test-webhook.js          (con el servidor en marcha)
     npm run smoke:webhook            (arranca, prueba y para)
   ========================================================= */

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

/* ---- Configuración ---- */
const PUERTO = Number(process.env.PUERTO || 3193);
const PUERTO_FALSO = Number(process.env.PUERTO_FALSO || 3192);
const BASE = "http://127.0.0.1:" + PUERTO;
const MARCA = "wh-" + Date.now().toString(36).slice(-6);
const NOMBRE_INSTANCIA = "prueba-" + MARCA;

/* El remitente no existe. Un 549 11 es un rango asignado a Capital
   Federal, pero ni 1100000000 ni este JID están dados de alta. */
const JID_FALSO = "5491100000000@c.us";

function leerEnv(ruta) {
  const out = {};
  for (const l of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = leerEnv("D:/webs/wweb/.env.local");
const SECRET = env.WEBHOOK_SECRET || "";
if (!SECRET) {
  console.error("  x WEBHOOK_SECRET no está en .env.local");
  process.exit(1);
}

/* ------------------------------------------------------------
   El Evolution falso
   ------------------------------------------------------------ */
const llamadas = [];
let servidorFalso = null;

function arrancarFalso() {
  return new Promise((resolver) => {
    servidorFalso = http.createServer((req, res) => {
      let cuerpo = "";
      req.on("data", (d) => (cuerpo += d));
      req.on("end", () => {
        let json = null;
        try { json = JSON.parse(cuerpo); } catch {}
        llamadas.push({
          metodo: req.method,
          ruta: req.url,
          cuerpo: json,
          apikey: req.headers["apikey"] || null,
          authorization: req.headers["authorization"] || null,
        });

        /* evolutionRequest() espera JSON con `key`. */
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          key: { id: "FAKE-" + llamadas.length, remoteJid: JID_FALSO, fromMe: true },
          status: "PGR",
        }));
      });
    });
    servidorFalso.listen(PUERTO_FALSO, "127.0.0.1", resolver);
  });
}

function pararFalso() {
  return new Promise((r) => (servidorFalso ? servidorFalso.close(r) : r()));
}

/* ------------------------------------------------------------
   Cliente HTTP para pegarle al webhook
   ------------------------------------------------------------ */
function webhook(cuerpo, cabeceras) {
  return new Promise((resolver) => {
    const datos = JSON.stringify(cuerpo);
    const req = http.request(
      BASE + "/api/webhook",
      {
        method: "POST",
        timeout: 40000,
        headers: Object.assign(
          { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(datos) },
          cabeceras || {}
        ),
      },
      (res) => {
        let c = "";
        res.on("data", (d) => (c += d));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(c); } catch {}
          resolver({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", (e) => resolver({ status: 0, error: e.message }));
    req.on("timeout", function () { this.destroy(); resolver({ status: 0, error: "timeout" }); });
    req.write(datos);
    req.end();
  });
}

/** Payload de Evolution 2.3.7 con un mensaje de texto. */
function mensaje(texto, opciones) {
  const o = opciones || {};
  return {
    event: o.event || "messages.upsert",
    instance: o.instance || NOMBRE_INSTANCIA,
    data: {
      key: {
        remoteJid: o.jid || JID_FALSO,
        fromMe: o.fromMe || false,
        id: "MSG" + crypto.randomUUID().slice(0, 12),
      },
      pushName: o.pushName || "Alguien de prueba",
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: { conversation: texto },
    },
  };
}

function firmar(body, secreto) {
  return "sha256=" + crypto.createHmac("sha256", secreto || SECRET).update(body).digest("hex");
}

/** Firma un payload y devuelve cuerpo + cabeceras listas. */
function conFirma(body, opciones) {
  const o = opciones || {};
  const datos = JSON.stringify(body);
  const firma = firmar(datos, o.secreto);
  return {
    cuerpo: body,
    cabeceras: o.sinFirma ? {} : { "x-hub-signature-256": firma },
    datos,
  };
}

/* ------------------------------------------------------------
   Datos
   ------------------------------------------------------------ */
const sueltos = { usuarios: [], clientes: [], bots: [], servidores: [] };
let db = null;

function comprobar(final, condicion, detalle) {
  if (condicion) {
    console.log("  ✓ " + final.padEnd(52) + (detalle || ""));
    return true;
  }
  console.log("  ✗ " + final.padEnd(52) + (detalle || ""));
  return false;
}

/* ------------------------------------------------------------
   Programa
   ------------------------------------------------------------ */
(async function () {
  let ok = 0;
  let fallos = 0;
  const suma = (v) => (v ? ok++ : fallos++);

  console.log("\n═══ El webhook, de punta a punta ═══\n");

  const salud = await new Promise((r) => {
    http.get(BASE + "/api/health", { timeout: 4000 }, (res) => {
      res.resume();
      r(res.statusCode === 200);
    }).on("error", () => r(false));
  });
  if (!salud) {
    console.error("  x no hay servidor en " + BASE + ". Usa `npm run smoke:webhook`.");
    process.exitCode = 1;
    return;
  }

  await arrancarFalso();
  require("D:/webs/empresa/lib/env").load();
  db = require("D:/webs/empresa/lib/supabase").getAdmin();

  /* ---- Montaje ---- */
  const srv = await db.from("evolution_servers")
    .insert({ name: "wh-falso " + MARCA, url: "http://127.0.0.1:" + PUERTO_FALSO, api_key: "CLAVE-FALSA-" + MARCA })
    .select("id").single();
  sueltos.servidores.push(srv.data.id);

  const cli = await db.from("clients")
    .insert({ nombre: "Webhook " + MARCA, empresa: "Pruebas", email: MARCA + "@ejemplo.com" })
    .select("id").single();
  sueltos.clientes.push(cli.data.id);

  const usuario = await db.auth.admin.createUser({
    email: MARCA + "@ejemplo.com", password: "PruebaWebhook123", email_confirm: true,
  });
  if (usuario.error) throw new Error("auth: " + usuario.error.message);
  sueltos.usuarios.push(usuario.data.user.id);

  await db.from("profiles").insert({
    id: usuario.data.user.id, rol: "client", client_id: cli.data.id,
    nombre: "Dueño de prueba", activo: true,
  });
  await db.from("suscripciones").insert({
    client_id: cli.data.id, module_id: "bot_whatsapp", estado: "activo", inicia_en: "2026-01-01",
  });

  const bot = await db.from("bots").insert({
    client_id: cli.data.id, server_id: srv.data.id,
    name: "Bot del webhook", instance_name: NOMBRE_INSTANCIA, slug: MARCA,
  }).select("id").single();
  sueltos.bots.push(bot.data.id);

  await db.from("bots_responses").insert([
    { bot_id: bot.data.id, keyword: "hola", response_text: "¡Hola! Soy el bot de pruebas.", response_type: "text", is_active: true, priority: 50 },
    { bot_id: bot.data.id, keyword: "precio", response_text: "Cargamos $2500 la docena.", response_type: "text", is_active: true, priority: 50 },
  ]);
  /* Horario abierto todos los días, para que el bot no responda "fuera de
     horario" y tape el matching. */
  await db.from("bots_business_hours").insert(
    [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      bot_id: bot.data.id, day_of_week: d,
      start_time: "00:00", end_time: "23:59", slot_duration_min: 30, is_active: true,
    }))
  );

  console.log("  bot '" + NOMBRE_INSTANCIA + "' apuntando al Evolution falso\n");

  /* ---- 1. La puerta: sin firma no entra nadie ---- */
  console.log("── la firma ──");
  {
    const p = mensaje("hola");
    suma(comprobar("sin firma -> 401", (await webhook(p)).status === 401));

    suma(comprobar("firma manipulada -> 401",
      (await webhook(p, { "x-hub-signature-256": "sha256=" + "0".repeat(64) })).status === 401));

    /* Firma bien formada pero hecha con otro secreto: es el caso de cuando
       el WEBHOOK_SECRET del contenedor y el de Evolution no coinciden. */
    const ajeno = conFirma(mensaje("hola"), { secreto: "secreto-distinto" });
    suma(comprobar("firma de otro secreto -> 401",
      (await webhook(ajeno.cuerpo, ajeno.cabeceras)).status === 401));

    const ok1 = conFirma(mensaje("hola"));
    suma(comprobar("firma válida -> pasa", (await webhook(ok1.cuerpo, ok1.cabeceras)).status === 200));
  }

  /* ---- 2. Instancia desconocida ---- */
  console.log("\n── resolver la instancia ──");
  {
    const p = conFirma(mensaje("hola", { instance: "no-existe-" + MARCA }));
    const r = await webhook(p.cuerpo, p.cabeceras);
    suma(comprobar("instancia inexistente -> 404", r.status === 404, "HTTP " + r.status));
  }

  /* ---- 2b. El nombre del evento, que es como estaba el bot mudo ----
     Evolution 2.3.7 manda `MESSAGES_UPSERT` en SCREAMING_SNAKE. El
     dispatcher solo aceptaba `messages.upsert`, así que TODOS los mensajes
     reales caían en la rama de "ignorado" y el bot no respondía nada. Las
     pruebas no lo veían porque este mismo archivo fabricaba el payload con el
     evento en minúsculas: la prueba se mandaba a sí misma lo que la realidad
     no manda.

     Estos dos casos son la razón de que esta prueba exista. */
  console.log("\n── cómo nombra Evolution los eventos ──");
  {
    /* El que manda el server de verdad. Tiene que disparatear el bot. */
    llamadas.length = 0;
    const p = conFirma(mensaje("hola", { event: "MESSAGES_UPSERT" }));
    const r = await webhook(p.cuerpo, p.cabeceras);
    const envio = llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1);
    suma(comprobar("'MESSAGES_UPSERT' responde como 'messages.upsert'",
      r.status === 200 && envio.length === 1,
      envio.length ? "salió el mensaje" : "HTTP " + r.status + ", no envió nada (evento descartado)"));

    /* Las otras grafías que se han visto en los logs. */
    for (const variante of ["messages.upsert", "messages-upsert", "MESSAGES.UPSERT"]) {
      llamadas.length = 0;
      const q = conFirma(mensaje("hola", { event: variante }));
      await webhook(q.cuerpo, q.cabeceras);
      suma(comprobar("grafía '" + variante + "' también", llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1).length === 1));
    }

    /* Y lo contrario: lo que NO es un mensaje de entrada se ignora igual. */
    for (const otro of ["CONNECTION_UPDATE", "connection.update", "MESSAGES_DELETE"]) {
      llamadas.length = 0;
      const q = conFirma(mensaje("hola", { event: otro }));
      const r = await webhook(q.cuerpo, q.cabeceras);
      suma(comprobar("'" + otro + "' se ignora sin responder",
        r.status === 200 && llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1).length === 0));
    }
  }

  /* ---- 3. El matching y la respuesta ---- */
  console.log("\n── matchear y responder ──");
  {
    llamadas.length = 0;
    const p = conFirma(mensaje("hola"));
    const r = await webhook(p.cuerpo, p.cabeceras);
    suma(comprobar("keyword 'hola' -> 200", r.status === 200, "HTTP " + r.status));

    const envio = llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1);
    suma(comprobar("salió un sendText a Evolution", envio.length === 1,
      envio.length ? envio[0].ruta : "no salió ninguna llamada (" + llamadas.length + " llamadas en total)"));

    if (envio.length) {
      const c = envio[0].cuerpo || {};
      const texto = JSON.stringify(c).includes("¡Hola! Soy el bot de pruebas.");
      suma(comprobar("lleva el texto de la respuesta", texto));
      suma(comprobar("va dirigido al JID del remitente", JSON.stringify(c).includes(JID_FALSO)));
      suma(comprobar("con la clave del servidor, no otra",
        envio[0].apikey === "CLAVE-FALSA-" + MARCA || envio[0].authorization === "Bearer CLAVE-FALSA-" + MARCA));
    }
  }

  /* ---- 3b. La palabra "turno": el flujo de la agenda ----
     Esta parte faltaba y es la que estaba rota en producción: el cliente
     escribía "turno" y no pasaba nada. Como la agenda es de varios pasos
     (palabra clave -> menú -> número de horario -> confirmación), comprobar
     solo el primer paso deja pasar el resto del bug. */
  console.log("\n── la agenda con la palabra \"turno\" ──");
  {
    llamadas.length = 0;
    const p = conFirma(mensaje("turno"));
    const r = await webhook(p.cuerpo, p.cabeceras);
    suma(comprobar("keyword 'turno' -> 200", r.status === 200, "HTTP " + r.status));

    const envio = llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1);
    suma(comprobar("responde con un mensaje", envio.length > 0,
      envio.length ? envio[0].ruta : "no salió ninguna llamada (" + llamadas.length + " llamadas en total)"));

    /* Ojo: `cuerpo` es un objeto ya parseado. `Array.join` lo convierte a
       "[object Object]" y estas aserciones dababan un resultado sin sentido.
       Hay que serializar el array entero. */
    const menu = JSON.stringify(envio.map((c) => c.cuerpo));
    /* Se comprueban las etiquetas, no el dibujo: el menú usa 1️⃣/2️⃣/3️⃣ con
       selectores de variación y el formato cambia entre versiones. */
    suma(comprobar("y es el menú de la agenda (1/2/3)",
      /libre hoy/i.test(menu) && /pr[oó]ximo/i.test(menu) && /completa/i.test(menu),
      envio.length ? menu.slice(0, 120) : ""));
  }

  /* Elegir "1" = libre hoy: tiene que ofrecer horarios numerados. */
  {
    llamadas.length = 0;
    const p = conFirma(mensaje("1"));
    await webhook(p.cuerpo, p.cabeceras);
    const envio = llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1);
    suma(comprobar("responder '1' lista horarios", envio.length > 0,
      envio.length ? envio[0].ruta : "no respondió a '1'"));

    const cuerpo = JSON.stringify(envio.map((c) => c.cuerpo));
    suma(comprobar("con horarios en formato HH:MM", /\d{2}:\d{2}\*?\s*hs/.test(cuerpo),
      envio.length ? cuerpo.slice(0, 120) : ""));
  }

  /* Y el paso final: elegir un horario tiene que CREAR el turno. Este es el
     que importa: si el INSERT falla (columna que no existe, tabla mal), el
     bot contesta "agendado" sin guardar nada. */
  {
    llamadas.length = 0;
    const p = conFirma(mensaje("1"));
    const r = await webhook(p.cuerpo, p.cabeceras);

    const { data: turnos } = await db.from("bots_appointments")
      .select("id, appointment_date, appointment_time, status")
      .eq("bot_id", bot.data.id);
    suma(comprobar("elegir un horario crea el turno", (turnos || []).length === 1,
      (turnos || []).length + " turno(s) en bots_appointments"));

    if (turnos && turnos[0]) {
      /* La columna es `time` y Postgres la devuelve como "HH:MM:SS". El
         código la recorta a "HH:MM" para compararla con los slots que
         genera, así que acá se acepta cualquiera de las dos formas. */
      suma(comprobar("con fecha y hora válidas",
        /^\d{4}-\d{2}-\d{2}$/.test(turnos[0].appointment_date) && /^\d{2}:\d{2}(:\d{2})?$/.test(turnos[0].appointment_time),
        turnos[0].appointment_date + " " + turnos[0].appointment_time));
      suma(comprobar("y queda confirmado", turnos[0].status === "confirmed", turnos[0].status));
    }

    const cuerpo = JSON.stringify(llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1).map((c) => c.cuerpo));
    suma(comprobar("y el cliente recibe la confirmación", /AGENDADO/i.test(cuerpo),
      cuerpo.slice(0, 120)));
    suma(comprobar("el turno no se repite al elegir otra vez",
      llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1).length === 1));
    void r;
  }

  /* Un horario YA reservado tiene que desaparecer del listado. Este chequeo
     nació de un bug real: `appointment_time` volvía de Postgres como
     "11:00:00" y el `Set` de reservados se armaba con ese formato, así que
     `has("11:00")` era false y los turnos tomados se volvían a ofrecer.

     Por eso no alcanza con "no crear un segundo turno" (eso ya lo impedía
     `clearAgendaActive`): hay que volver a pedir la agenda y mirar que el
     horario tomado no esté en la lista. */
  {
    const { data: yaReservado } = await db.from("bots_appointments")
      .select("appointment_date, appointment_time").eq("bot_id", bot.data.id).limit(1);
    const hhmm = yaReservado && yaReservado[0]
      ? String(yaReservado[0].appointment_time).slice(0, 5)
      : null;

    const p1 = conFirma(mensaje("turno"));
    await webhook(p1.cuerpo, p1.cabeceras);

    llamadas.length = 0;
    const p2 = conFirma(mensaje("1"));
    await webhook(p2.cuerpo, p2.cabeceras);

    const listado = JSON.stringify(llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1).map((c) => c.cuerpo));
    suma(comprobar("el horario reservado desaparece del listado",
      !!hhmm && listado.indexOf(hhmm) === -1,
      hhmm ? (listado.indexOf(hhmm) === -1 ? "ya no está" : "SIGO OFRECIENDO " + hhmm) : "no hay turno"));
  }

  /* ---- 4. Un mensaje que no matchea: no debe contestar ---- */
  console.log("\n── un mensaje sin respuesta configurada ──");
  {
    llamadas.length = 0;
    const p = conFirma(mensaje("xyzqwerty improbable"));
    const r = await webhook(p.cuerpo, p.cabeceras);
    suma(comprobar("contesta 200 igualmente", r.status === 200, "HTTP " + r.status));
    const envio = llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1);
    suma(comprobar("pero no manda nada", envio.length === 0,
      envio.length ? "mandó " + envio.length : "correcto, silencio"));
  }

  /* ---- 5. La auditoría, que estaba muerta ---- */
  console.log("\n── la auditoría ──");
  {
    const { data: logs } = await db.from("bots_webhook_logs")
      .select("event_type, status, bot_id, payload")
      .eq("bot_id", bot.data.id)
      .order("created_at", { ascending: false })
      .limit(20);

    suma(comprobar("bots_webhook_logs tiene filas", (logs || []).length > 0,
      (logs || []).length + " filas"));

    const procesado = (logs || []).some((l) => l.status === "processed");
    suma(comprobar("con status 'processed'", procesado));

    /* Lo que se guarda es el mensaje ENTRANTE y qué handler matcheó, no el
       texto de salida (ese lo manda Evolution). La primera versión de esta
       comprobación buscaba el texto de la respuesta y fallaba por eso: la
       aserción estaba mal, no el código. */
    const conTexto = (logs || []).some((l) =>
      l.payload && JSON.stringify(l.payload).indexOf("hola") !== -1);
    suma(comprobar("y con el texto que llegó", conTexto));

    /* Y que la auditoría distingue un acierto de un silencio: el mensaje
       "xyzqwerty" no matcheó, y su log debe decirlo. */
    const silencios = (logs || []).filter((l) =>
      l.payload && JSON.stringify(l.payload).indexOf("xyzqwerty") !== -1);
    suma(comprobar("y distingue el mensaje sin respuesta",
      silencios.some((l) => l.status === "no_handler_matched" || JSON.stringify(l.payload).indexOf("null") !== -1),
      silencios.length ? silencios[0].event_type : "no está el mensaje sin respuesta"));
  }

  /* ---- 6. El propio bot que mandó el mensaje no se contesta a sí mismo ---- */
  console.log("\n── no hablarse a sí mismo ──");
  {
    llamadas.length = 0;
    const p = conFirma(mensaje("hola", { fromMe: true }));
    await webhook(p.cuerpo, p.cabeceras);
    const envio = llamadas.filter((c) => c.ruta.indexOf("sendText") !== -1);
    suma(comprobar("fromMe -> no se responde", envio.length === 0,
      envio.length ? "se respondió a sí mismo" : "correcto"));
  }

  /* ---- 7. Contra la Evolution de verdad, solo leyendo ---- */
  console.log("\n── contra la Evolution real (solo lectura) ──");
  {
    const url = (env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
    const key = env.EVOLUTION_API_KEY || "";

    if (!url || !key) {
      console.log("  · no hay EVOLUTION_API_URL/API_KEY en .env.local, se salta");
    } else {
      const mod = url.startsWith("https") ? require("https") : require("http");
      const u = new URL(url);

      const pedir = (ruta) => new Promise((r) => {
        const req = mod.request(url + ruta, {
          method: "GET", timeout: 15000,
          headers: { apikey: key, Authorization: "Bearer " + key },
        }, (res) => {
          let c = "";
          res.on("data", (d) => (c += d));
          res.on("end", () => r({ status: res.statusCode, cuerpo: c }));
        });
        req.on("error", (e) => r({ status: 0, error: e.message }));
        req.on("timeout", function () { this.destroy(); r({ status: 0, error: "timeout" }); });
        req.end();
      });

      const version = await pedir("/");
      let v = "?";
      try { v = JSON.parse(version.cuerpo).version; } catch {}
      suma(comprobar("responde la Evolution configurada", version.status === 200,
        u.host + " version " + v));

      const inst = await pedir("/instance/fetchInstances");
      let lista = [];
      try { lista = JSON.parse(inst.cuerpo); } catch {}

      suma(comprobar("la instancia existe y está conectada", inst.status === 200 && lista.length > 0,
        inst.status === 200 ? lista.length + " instancia(s)" : "HTTP " + inst.status));

      if (lista.length) {
        const nombres = lista.map((i) => i.name);
        suma(comprobar("nombres: " + nombres.join(", "), true,
          lista.map((i) => i.name + " (" + i.connectionStatus + ")").join(", ")));

        /* Esto es lo que hay que mirar de verdad: el bot busca el bot por
           `instance_name` y luego usa ESA fila como nombre de instancia en
           las llamadas a Evolution. Si el nombre no está en la Evolution,
           /api/whatsapp y el webhook devuelven 404 y no hay forma de
           arreglarlo desde la base: Evolution tiene que tener esa instancia. */
        const nombresBot = await db.from("bots").select("instance_name, name").neq("id", bot.data.id);
        const huerfanos = (nombresBot.data || []).filter((b) => !nombres.includes(b.instance_name));
        suma(comprobar("todos los bots apuntan a una instancia real", huerfanos.length === 0,
          huerfanos.length
            ? "sin instancia en Evolution: " + huerfanos.map((b) => JSON.stringify(b.instance_name)).join(", ")
            : "cuadran"));
      }
    }
  }

  console.log("\n" + "-".repeat(58));
  console.log(
    fallos
      ? "x " + fallos + " de " + (ok + fallos) + " fallan.\n"
      : "✓ Las " + ok + " comprobaciones del webhook pasan.\n"
  );
  if (fallos) process.exitCode = 1;
})()
  .catch((e) => {
    console.error("\n  x " + (e && e.message ? e.message : String(e)) + "\n");
    process.exitCode = 1;
  })
  .then(async () => {
    await pararFalso();

    console.log("\n  limpiando datos de prueba...");
    for (const id of sueltos.bots) {
      for (const t of ["bots_appointments", "bots_responses", "bots_business_hours",
                       "bots_catalog_items", "bots_orders", "bots_response_logs",
                       "bots_webhook_logs"]) {
        await db.from(t).delete().eq("bot_id", id);
      }
      await db.from("bots").delete().eq("id", id);
    }
    for (const id of sueltos.usuarios) { try { await db.auth.admin.deleteUser(id); } catch {} }
    for (const id of sueltos.clientes) {
      await db.from("suscripciones").delete().eq("client_id", id);
      await db.from("profiles").delete().eq("client_id", id);
      await db.from("clients").delete().eq("id", id);
    }
    for (const id of sueltos.servidores) await db.from("evolution_servers").delete().eq("id", id);

    const { data: quedan } = await db.from("bots").select("id").like("slug", MARCA + "%");
    console.log("  datos fuera" + (quedan && quedan.length ? " (QUEDAN " + quedan.length + ")" : ""));
    if (quedan && quedan.length) process.exitCode = 1;
  });