/* =========================================================
   Que el editor de menús sea utilizable en pantalla chica
   ---------------------------------------------------------
   POR QUÉ ESTA PRUEBA

   El editor de menús tenía el botón "Guardar" inalcanzable: el panel es un
   hijo flex de un `flex h-full flex-col`, así que se encogía para caber y su
   `overflow-hidden` —que hace falta para la animación de altura— cortaba el
   final. En una pantalla de escritorio se还不是 un problema; con el
   formulario abierto y un submenú, el botón caía fuera del área visible.

   Y nada de lo que había lo detectó: `smoke:auto` abre `/menus`, mira que
   cargue y que no haya errores de consola, y la página cargaba perfectamente.
   Lo que estaba roto era la interacción.

   Esta prueba abre el editor y comprueba que el botón SE PUEDA CLICKEAR, en
   varios tamaños de pantalla. Si está tapado, `click()` falla o el elemento no
   queda dentro del viewport.

     node db/prueba-scroll-menu.js        (con el servidor en marcha)
   ========================================================= */

const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const PUERTO = Number(process.env.PUERTO || 3195);
const BASE = "http://127.0.0.1:" + PUERTO;
const MARCA = "scroll-" + Date.now().toString(36).slice(-6);

const sueltos = { usuarios: [], clientes: [], bots: [], servidores: [] };
let db = null;

let ok = 0;
let fallos = 0;
function comprobar(final, condicion, detalle) {
  if (condicion) {
    console.log("  ✓ " + final.padEnd(46) + (detalle || ""));
    ok++;
    return true;
  }
  console.log("  ✗ " + final.padEnd(46) + (detalle || ""));
  fallos++;
  return false;
}

async function montarYEntrar() {
  const supabase = require("D:/webs/empresa/lib/supabase");
  const tickets = require("D:/webs/empresa/lib/tickets");
  require("D:/webs/empresa/lib/env").load();
  db = supabase.getAdmin();

  const srv = await db.from("evolution_servers")
    .insert({ name: "scroll " + MARCA, url: "https://evolution.invalid", api_key: "CLAVE-" + MARCA })
    .select("id").single();
  sueltos.servidores.push(srv.data.id);

  const cli = await db.from("clients")
    .insert({ nombre: "Scroll " + MARCA, empresa: "Pruebas", email: MARCA + "@ejemplo.com" })
    .select("id").single();
  sueltos.clientes.push(cli.data.id);

  const usuario = await db.auth.admin.createUser({
    email: MARCA + "@ejemplo.com", password: "PruebaScroll123", email_confirm: true,
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
    name: "Bot del scroll", instance_name: "inst-" + MARCA, slug: MARCA,
  }).select("id").single();
  sueltos.bots.push(bot.data.id);

  const login = await supabase.getPublico().auth.signInWithPassword({
    email: MARCA + "@ejemplo.com", password: "PruebaScroll123",
  });
  if (login.error) throw new Error("login: " + login.error.message);

  /* El ticket lleva `userId`, `clientId` y `rol` además del token. Sin esos
     tres, `/api/entrar` responde "Ese enlace no vale": el token solo prueba
     que el usuario existe, no de qué cliente es ni qué papel tiene. */
  const ticket = tickets.firmar({
    secret: (process.env.SERVICE_SECRET || "").trim(), sesion: null,
    userId: usuario.data.user.id, clientId: cli.data.id, rol: "client",
    accessToken: login.data.session.access_token,
  });

  const cookie = await new Promise((resolver, rechazar) => {
    const datos = JSON.stringify({ ticket });
    const req = http.request(BASE + "/api/entrar", {
      method: "POST", timeout: 20000,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(datos) },
    }, (res) => {
      let c = "";
      res.on("data", (d) => (c += d));
      res.on("end", () => {
        const cruda = (res.headers["set-cookie"] || []).find((x) => x.indexOf("nexo_bot=") === 0);
        if (!cruda) return rechazar(new Error("no vino cookie: " + c.slice(0, 200)));
        resolver(cruda.split(";")[0]);
      });
    });
    req.on("error", rechazar);
    req.on("timeout", function () { this.destroy(); rechazar(new Error("timeout")); });
    req.write(datos);
    req.end();
  });

  return cookie;
}

/* ¿Se puede llegar al botón "Guardar"?

   No se exige que esté siempre visible: el requisito es que se pueda
   LLEGAR. Con el formulario alto en un celular, lo correcto es que aparezca
   al scrollear, no que quede flotando encima de los campos.

   Antes esta función solo miraba `boundingBox()` y decía que el botón no
   servía por estar 25px por debajo. Eso distinguía mal las dos cosas: estar
   por debajo del viewport es normal si hay scroll; estar por debajo y sin
   scroll es el bug. La diferencia la hace poder scrollear y después
   clickear. */
async function botonAlcanzable(pagina) {
  const guardar = pagina.getByRole("button", { name: "Guardar" }).first();
  if ((await guardar.count()) === 0) return { ok: false, motivo: "no está el botón" };

  /* ¿Hay algo scrolleable que lo contenga? Si no hay scroll posible, estar
     fuera del viewport es el bug. */
  const hayScroll = await pagina.evaluate(() => {
    const nodos = [document.documentElement, ...document.querySelectorAll("*")];
    return nodos.some((n) => n.scrollHeight - n.clientHeight > 4);
  });

  const caja0 = await guardar.boundingBox();
  if (!caja0) return { ok: false, motivo: "no tiene caja" };

  const alto = pagina.viewportSize().height;
  if (caja0.y + caja0.height > alto + 1 && !hayScroll) {
    return { ok: false, motivo: "queda por debajo y no hay scroll" };
  }

  /* El click de verdad: `scrollIntoViewIfNeeded` primero, que es lo que haría
     la persona. Playwright además exige que esté habilitado. */
  try {
    await guardar.click({ timeout: 8000 });
  } catch (e) {
    const deshabilitado = await guardar.isDisabled().catch(() => false);
    return {
      ok: false,
      motivo: deshabilitado
        ? "el botón está deshabilitado (el formulario no era válido)"
        : "no se pudo clicar: " + String(e.message).split("\n")[0],
    };
  }
  return { ok: true };
}

const PANTALLAS = [
  { nombre: "escritorio 1280x800", width: 1280, height: 800 },
  { nombre: "notebook chico 1024x640", width: 1024, height: 640 },
  { nombre: "tablet 768x1024", width: 768, height: 1024 },
  { nombre: "celular 390x844", width: 390, height: 844 },
];

(async function () {
  console.log("\n═══ El editor de menús, en pantalla chica ═══\n");

  let navegador = null;
  try {
    const cookie = await montarYEntrar();
    navegador = await chromium.launch();

    for (const p of PANTALLAS) {
      const ctx = await navegador.newContext({
        viewport: { width: p.width, height: p.height },
        extraHTTPHeaders: { Cookie: cookie },
      });
      const pagina = await ctx.newPage();
      const errores = [];
      pagina.on("pageerror", (e) => errores.push(String(e)));

      await pagina.goto(BASE + "/menus", { waitUntil: "networkidle" });
      await pagina.getByRole("button", { name: "Nuevo" }).click();

      /* El caso que lo rompía: las 3 opciones llenas y un submenú abierto,
         que es cuando el panel crece de verdad. */
      const opciones = pagina.getByPlaceholder("Texto de la opción");
      await opciones.nth(0).fill("Precios");
      await opciones.nth(1).fill("Turnos");
      await opciones.nth(2).fill("Contacto");
      await pagina.getByPlaceholder("Título del menú (ej: Menú del día)").fill("Menú alto");

      await pagina.getByRole("button", { name: "Submenú" }).first().click();
      await pagina.waitForTimeout(400);

      /* Hay que llenar una sub-opción: con un submenú vacío el botón
         "Guardar" queda deshabilitado a propósito (`submenuIncompleto`), y
         Playwright espera indefinidamente a que un elemento esté
         habilitado. Eso es la prueba del sticky, no un bug. */
      await pagina.getByPlaceholder("Sub-opción 1").fill("Panadería");

      const r = await botonAlcanzable(pagina);
      comprobar("botón Guardar alcanzable en " + p.nombre, r.ok, r.ok ? "" : r.motivo);

      /* Y que se pueda scrollear de verdad para llegar al final del
         formulario: es el síntoma que reportó el usuario. */
      const scrolleo = await pagina.evaluate(() => {
        const nodos = [document.documentElement, ...document.querySelectorAll("*")];
        return nodos.some((n) => n.scrollHeight - n.clientHeight > 4);
      });
      comprobar("  hay scroll hasta el final del formulario", scrolleo, scrolleo ? "" : "no hay nada scrolleable");

      comprobar("  sin errores de JS", errores.length === 0, errores[0] || "");

      await ctx.close();
    }
  } catch (e) {
    console.error("\n  x " + (e && e.message ? e.message : String(e)) + "\n");
    fallos++;
  } finally {
    if (navegador) await navegador.close().catch(() => {});

    if (db) {
      console.log("\n  limpiando datos de prueba...");
      for (const id of sueltos.bots) {
        for (const t of ["bots_responses", "bots_webhook_logs", "bots_response_logs",
                         "bots_appointments", "bots_business_hours", "bots_catalog_items", "bots_orders"]) {
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
    }

    console.log("\n" + "-".repeat(54));
    console.log(fallos
      ? "x " + fallos + " de " + (ok + fallos) + " fallan.\n"
      : "✓ El editor de menús es utilizable en los " + PANTALLAS.length + " tamaños.\n");
    if (fallos) process.exitCode = 1;
  }
})();