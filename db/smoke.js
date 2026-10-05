/* =========================================================
   Prueba de humo con navegador real
   =========================================================
   POR QUÉ EXISTE
   ---------------
   Un HTTP 200 con 40 KB de HTML NO dice que la página funcione. Dice
   que el servidor respondió. Si el JavaScript revienta al ejecutarse —
   un `undefined.map()` en un efecto, un error de hidratación — el
   HTML sigue siendo correcto y la persona ve una pantalla en blanco.

   Eso no lo ve `tsc` (que solo comprueba tipos), ni `npm test` (que no
   renderiza), ni un `Invoke-WebRequest` (que no ejecuta JavaScript).

   Solo lo ve un navegador de verdad. Eso hace esta prueba.

   QUÉ MIRA
   --------
     · errores de `console.error` mientras carga la página
     · excepciones no capturadas (`pageerror`)
     · peticiones fallidas a /api/*
     · que el body tenga texto visible y no solo el esqueleto del HTML

   Solo都是 errores de CONSOLA y de PETICIONES. No comprueba que un
   botón funcione ni los formularios: eso necesita pruebas de
   interacción, que son otro trabajo.

   ------------------------------------------------------------
   USO

     node db/smoke.js

   Requiere el servidor en marcha. En local:
     $env:PORT=3200; npm run start
     node db/smoke.js
     (en otra terminal)

   Y para el arranque automático, `npm run smoke` lo hace todo y
   guarantee que no queda ningún proceso vivo.
   ========================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PUERTO = Number(process.env.PUERTO || 3194);
const BASE = "http://127.0.0.1:" + PUERTO;
const MARCA = "smoke-" + Date.now().toString(36).slice(-5);
const CAPTURAS = path.join(__dirname, "..", "capturas");

/* Las que se comprueban. La agenda va aparte porque es pública y la
   prueba de /agendar/[slug].tsx. */
const PAGINAS = [
  ["/dashboard", "inicio"],
  ["/whatsapp", "conectar WhatsApp"],
  ["/auto-responses", "respuestas automáticas"],
  ["/menus", "menús"],
  ["/catalog", "catálogo"],
  ["/orders", "pedidos"],
  ["/calendar", "calendario"],
  ["/logs", "actividad"],
  ["/profile", "mi perfil"],
  ["/settings", "configuración"],
];

/* Lo que hay que borrar pase lo que pase. */
const sueltos = { usuarios: [], clientes: [], bots: [], servidores: [] };

/* Cliente de servicio, para las comprobaciones que van a la base. Se
   rellena en montarYEntrar(); el enlace de /profile se comprueba contra
   `bots`, no contra lo que dice la página: si el slug que enseña no está
   en la tabla, está inventado aunque la página parezca correcta. */
let db = null;

function pedir(metodo, ruta, opciones) {
  const o = opciones || {};
  return new Promise((resolver) => {
    const datos = o.cuerpo ? JSON.stringify(o.cuerpo) : null;
    const req = http.request(
      BASE + ruta,
      {
        method: metodo,
        timeout: 40000,
        headers: Object.assign(
          {},
          datos ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(datos) } : {},
          o.cookie ? { Cookie: o.cookie } : {}
        ),
      },
      (res) => {
        let cuerpo = "";
        res.on("data", (d) => (cuerpo += d));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(cuerpo); } catch {}
          resolver({ status: res.statusCode, headers: res.headers, json: json });
        });
      }
    );
    req.on("error", (e) => resolver({ status: 0, error: e.message, json: null }));
    req.on("timeout", function () { this.destroy(); resolver({ status: 0, error: "timeout", json: null }); });
    if (datos) req.write(datos);
    req.end();
  });
}

/* ------------------------------------------------------------
   Montar los datos y sacar la sesión, igual que el panel haría.
   ------------------------------------------------------------ */
async function montarYEntrar() {
  const supabase = require("D:/webs/empresa/lib/supabase");
  const tickets = require("D:/webs/empresa/lib/tickets");
  require("D:/webs/empresa/lib/env").load();
  db = supabase.getAdmin();

  const srv = await db.from("evolution_servers")
    .insert({ name: "smoke " + MARCA, url: "https://evolution.invalid", api_key: "CLAVE-" + MARCA })
    .select("id").single();
  sueltos.servidores.push(srv.data.id);

  const cli = await db.from("clients")
    .insert({ nombre: "Horno de prueba " + MARCA, empresa: "Horno", email: MARCA + "@ejemplo.com" })
    .select("id").single();
  sueltos.clientes.push(cli.data.id);

  const usuario = await db.auth.admin.createUser({
    email: MARCA + "@ejemplo.com", password: "PruebaSmoke123", email_confirm: true,
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
    name: "Bot del Horno", instance_name: "inst-" + MARCA, slug: MARCA,
  }).select("id").single();
  sueltos.bots.push(bot.data.id);

  await db.from("bots_business_hours").insert(
    [1, 2, 3, 4, 5].map((d) => ({
      bot_id: bot.data.id, day_of_week: d,
      start_time: "09:00", end_time: "18:00", slot_duration_min: 30, is_active: true,
    }))
  );
  await db.from("bots_responses").insert({
    bot_id: bot.data.id, keyword: "hola", response_text: "¡Hola! ¿En qué te ayudo?",
    response_type: "text", is_active: true, priority: 50,
  });
  await db.from("bots_responses").insert({
    bot_id: bot.data.id, keyword: "menu", response_text: "[menú base]",
    response_type: "menu", is_active: true, priority: 15,
    menu_config: {
      title: "Horno",
      description: "Elegí",
      buttons: [{ id: "b1", text: "Turnos", target_id: null }],
    },
  });
  await db.from("bots_catalog_items").insert([
    { bot_id: bot.data.id, label: "Croissant", price_cents: 250, active: true, sort_order: 0, category: "Panadería" },
    { bot_id: bot.data.id, label: "Tostado", price_cents: 180, active: true, sort_order: 1, category: "Panadería" },
  ]);

  /* Sesión por ticket: es el camino de verdad, no un atajo. */
  const login = await supabase.getPublico().auth.signInWithPassword({
    email: MARCA + "@ejemplo.com", password: "PruebaSmoke123",
  });
  if (login.error) throw new Error("login: " + login.error.message);

  const ticket = tickets.firmar({
    secret: (process.env.SERVICE_SECRET || "").trim(), sesion: null,
    userId: usuario.data.user.id, clientId: cli.data.id, rol: "client",
    accessToken: login.data.session.access_token,
  });

  const entrada = await pedir("POST", "/api/entrar", { cuerpo: { ticket: ticket } });
  if (entrada.status !== 200) throw new Error("no se pudo entrar: HTTP " + entrada.status);

  const cruda = (entrada.headers["set-cookie"] || []).find((c) => c.indexOf("nexo_bot=") === 0);
  if (!cruda) throw new Error("no vino cookie");
  return cruda.split(";")[0];
}

/* ------------------------------------------------------------
   Los errores quedslacos IN ignored cuando vienen del propio
   Chromium (favicon, DevTools) o de React en desarrollo.
   ------------------------------------------------------------ */
const RUIDOS = [
  /favicon/i,
  /Download the React DevTools/i,
  /React DevTools/i,
  /\[Fast Refresh\]/i,
  /webpack-dev-middleware/i,
  /_next\/static\/.*\.map/i,
  /third-party cookie/i,
];

function esRuido(texto) {
  return RUIDOS.some((re) => re.test(texto));
}

(async function principal() {
  console.log("\n═══ Prueba de humo (navegador real) ═══\n");

  const salud = await pedir("GET", "/api/health");
  if (salud.status !== 200) {
    console.error("  ✗ No hay servidor en " + BASE + ". Arráncalo antes (npm run smoke lo hace).");
    process.exitCode = 1;
    return;
  }

  const cookie = await montarYEntrar();
  console.log("  sesión obtenida por ticket\n");

  fs.mkdirSync(CAPTURAS, { recursive: true });

  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({
    /* La cookie va por el contexto, para no tener que escribir un
       storageState a mano. */
    extraHTTPHeaders: { Cookie: cookie },
    viewport: { width: 1280, height: 900 },
    locale: "es-ES",
  });

  let ok = 0;
  let fallos = 0;
  const resumen = [];

  for (const par of PAGINAS) {
    const ruta = par[0];
    const nombre = par[1];

    const pagina = await contexto.newPage();
    const consola = [];
    const excepciones = [];
    const peticionesFallidas = [];

    pagina.on("console", (m) => {
      if (m.type() === "error") consola.push(m.text());
    });
    pagina.on("pageerror", (e) => excepciones.push(String(e && e.message ? e.message : e)));
    pagina.on("requestfailed", (r) => {
      const f = r.failure();
      peticionesFallidas.push(r.url() + " (" + (f ? f.errorText : "?") + ")");
    });
    pagina.on("response", (r) => {
      if (r.status() >= 400) peticionesFallidas.push(r.url() + " (HTTP " + r.status() + ")");
    });

    const problemas = [];
    let estado = "?";
    let textoVisible = 0;

    try {
      const respuesta = await pagina.goto(BASE + ruta, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      estado = respuesta ? respuesta.status() : "?";

      /* Un momento para que los efectos y las peticiones terminen: con
         networkidle casi está, pero un fetch en un useEffect encadenado
         puede llegar después. */
      await pagina.waitForTimeout(1200);

      textoVisible = await pagina.evaluate(
        () => (document.body ? document.body.innerText.trim().length : 0)
      );

      if (estado !== 200) problemas.push("HTTP " + estado);
      if (textoVisible < 40) problemas.push("casi sin texto visible (" + textoVisible + " chars)");

      const consolaLimpia = consola.filter((t) => !esRuido(t));
      if (consolaLimpia.length) {
        problemas.push("consola: " + consolaLimpia.slice(0, 2).map((t) => t.slice(0, 70)).join(" | "));
      }
      if (excepciones.length) {
        problemas.push("excepción: " + excepciones[0].slice(0, 70));
      }

      const pFallidas = peticionesFallidas.filter((u) => !esRuido(u) && u.indexOf(BASE + "/api/health") === -1);
      if (pFallidas.length) {
        problemas.push("petición: " + pFallidas[0].slice(0, 70));
      }
    } catch (e) {
      problemas.push("no cargó: " + String(e.message).split("\n")[0].slice(0, 60));
    }

    const archivo = path.join(CAPTURAS, ruta.replace(/\//g, "_").replace(/^_/, "") + ".png");
    try {
      await pagina.screenshot({ path: archivo, fullPage: true });
    } catch {}

    if (problemas.length) {
      console.log("  ✗ " + ruta.padEnd(17) + nombre.padEnd(21) + problemas[0]);
      fallos++;
    } else {
      console.log("  ✓ " + ruta.padEnd(17) + nombre.padEnd(21) + "HTTP " + estado + ", " + textoVisible + " chars, 0 errores");
      ok++;
    }
    resumen.push({ ruta, estado, textoVisible, problemas, consola, excepciones, peticionesFallidas });

    await pagina.close();
  }

  /* ---- El enlace de la agenda pública que se copia desde /profile ----
        Esto ya falló una vez: la página se armaba el slug con
        `slugify(nombre del negocio)` y la ruta era `/agendar?business=`.
        El enlace se veía bien en el campo de texto y llevaba a un 404.
        Un campo de texto no demuestra nada, así que se abre de verdad. */
  console.log("\n── el enlace que el cliente copia ──");
  {
    const pagina = await contexto.newPage();
    const problemas = [];
    let enlace = null;
    try {
      await pagina.goto(BASE + "/profile", { waitUntil: "networkidle", timeout: 30000 });
      await pagina.waitForTimeout(1500);

      enlace = await pagina.evaluate(() => {
        /* El campo de texto de la tarjeta de agenda pública. */
        const inputs = Array.from(document.querySelectorAll("input"));
        const campo = inputs.find((i) => i.value && i.value.indexOf("/agendar") !== -1);
        return campo ? campo.value : null;
      });

      if (!enlace) {
        problemas.push("no hay ningún enlace de agenda en /profile (ni siquiera roto)");
      } else {
        /* 1. La forma de la ruta: /agendar/<slug>, sin query. */
        if (!/\/agendar\/[^/?]+$/.test(enlace)) {
          problemas.push("forma incorrecta: " + enlace);
        } else {
          /* 2. Que el slug sea el del bot de verdad, no uno inventado. */
          const slug = enlace.split("/agendar/")[1];
          const { data: enBase } = await db.from("bots").select("slug").eq("slug", slug).maybeSingle();
          if (!enBase) problemas.push("el slug '" + slug + "' no está en la tabla bots: es inventado");
        }

        /* 3. Y sobre todo: que responda 200. */
        const abierta = await pagina.request.get(enlace);
        const status = abierta.status();
        if (status !== 200) problemas.push("al abrirlo responde HTTP " + status);
      }
    } catch (e) {
      problemas.push("no se pudo comprobar: " + String(e.message).split("\n")[0].slice(0, 50));
    }

    if (problemas.length) {
      console.log("  ✗ enlace de /profile".padEnd(26) + problemas[0]);
      fallos++;
    } else {
      console.log("  ✓ enlace de /profile".padEnd(26) + "abre bien y el slug existe en bots");
      ok++;
    }
    await pagina.close();
  }

  /* ---- La agenda pública, sin sesión y en otro contexto ---- */
  console.log("");
  {
    const limpio = await navegador.newContext({ viewport: { width: 480, height: 900 } });
    const pagina = await limpio.newPage();
    const errores = [];
    pagina.on("pageerror", (e) => errores.push(String(e.message)));
    pagina.on("console", (m) => { if (m.type() === "error" && !esRuido(m.text())) errores.push(m.text()); });

    const problemas = [];
    try {
      const r = await pagina.goto(BASE + "/agendar/" + MARCA, { waitUntil: "networkidle", timeout: 30000 });
      await pagina.waitForTimeout(1500);

      const texto = await pagina.evaluate(() => document.body.innerText);
      if (!r || r.status() !== 200) problemas.push("HTTP " + (r ? r.status() : "?"));
      /* El nombre del negocio solo aparece si el fetch a la API fue bien:
         sin él, la página muestra "Agendá tu turno" a secas. */
      if (texto.indexOf("Horno") === -1) {
        problemas.push("no llegó el nombre del negocio: la API no respondió o no se pintó");
      }
      if (errores.length) problemas.push(errores[0].slice(0, 70));

      await pagina.screenshot({ path: path.join(CAPTURAS, "agendar_publico.png"), fullPage: true });

      if (problemas.length) {
        console.log("  ✗ /agendar/<slug>   agenda pública       " + problemas[0]);
        fallos++;
      } else {
        console.log("  ✓ /agendar/<slug>   agenda pública       cargó con los datos del bot");
        ok++;
      }
    } catch (e) {
      console.log("  ✗ /agendar/<slug>   agenda pública       " + String(e.message).split("\n")[0]);
      fallos++;
    }
    await limpio.close();
  }

  await navegador.close();

  console.log("\n" + "-".repeat(56));
  console.log(
    fallos
      ? "✗ " + fallos + " de " + (ok + fallos) + " fallan. Capturas en capturas/\n"
      : "✓ Las " + ok + " páginas cargan en un navegador real, sin errores de consola.\n"
  );
  console.log("  Capturas en: capturas/");

  if (fallos) {
    console.log("\n  Detalle de lo que falló:");
    for (const p of resumen) {
      if (p.problemas.length) {
        console.log("\n  " + p.ruta);
        for (const x of p.problemas) console.log("      - " + x);
        if (p.consola.length) {
          console.log("      consola:");
          for (const c of p.consola.filter((t) => !esRuido(t)).slice(0, 5)) {
            console.log("        " + c.slice(0, 140));
          }
        }
        if (p.excepciones.length) {
          console.log("      excepciones:");
          for (const e of p.excepciones.slice(0, 5)) console.log("        " + e.slice(0, 140));
        }
        if (p.peticionesFallidas.length) {
          console.log("      peticiones:");
          for (const u of p.peticionesFallidas.slice(0, 5)) console.log("        " + u.slice(0, 140));
        }
      }
    }
  }
  if (fallos) process.exitCode = 1;
})()
  .catch(function (e) {
    console.error("\n  ✗ " + (e && e.message ? e.message : String(e)) + "\n");
    process.exitCode = 1;
  })
  .then(async function () {
    console.log("\n  limpiando datos de prueba...");
    const supabase = require("D:/webs/empresa/lib/supabase");
    require("D:/webs/empresa/lib/env").load();
    const db = supabase.getAdmin();

    for (const id of sueltos.bots) {
      for (const t of ["bots_appointments", "bots_responses", "bots_business_hours",
                       "bots_catalog_items", "bots_orders", "bots_response_logs", "bot_sesiones"]) {
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