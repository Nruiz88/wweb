/* =========================================================
   Limpia lo que dejaron las pruebas
   =========================================================
   ESTO EXISTE PORQUE LA PRUEBA DEL WEBHOOK LO ENCONTRÓ

   Al conectar con la Evolution real，el resultado fue:

     · 2 filas en `bots` con `instance_name = "p"` y slugs `probemut8db34`.
       Ninguna corresponde a una instancia de Evolution, así que el webhook
       devolvía 404 para ellas y el panel no tenía nada que enseñar. Restos
       de una ejecución antigua: `limpiar-pruebas.js` no cubre `bots`.

     · 10 filas en `evolution_servers`: dos llamadas `probe`/`probe2` con url
       `https://x` y clave de 1 carácter, y ocho "Servidor de pruebas
       -test-bot-". La ruta de WhatsApp elegía servidor con
       `ORDER BY created_at DESC LIMIT 1`, o sea que podía agregar justo
       una de estas y fallar al conectar.

   ESTE SCRIPT ES CONSERVADOR A PROPÓSITO

     · No toca `evolution_servers` cuya url no sea de prueba. Para llegar al
       servidor real hay que estar de acuerdo en escribirlo, no lo deduce
       un script por su cuenta.
     · Borra solo los bots que están claramente huérfanos: sin servidor, o
       con un servidor de url que no es real, o con un `instance_name` de
       menos de tres caracteres (los de prueba son "p").

     node db/limpiar-basura-bot.js            muestra lo que haría
     node db/limpiar-basura-bot.js --aplicar   lo borra
   ========================================================= */

require("D:/webs/empresa/lib/env").load();
const db = require("D:/webs/empresa/lib/supabase").getAdmin();

const APLICAR = process.argv.includes("--aplicar");

/** Una url de Evolution real es https y un dominio, no `https://x`. */
function urlFalsa(url) {
  if (!url) return true;
  const u = String(url).trim();
  if (/\bexample\b|\.invalid\b|\.test\b|localhost|127\.0\.0\.1/.test(u)) return true;
  /* `https://x` no tiene punto: no puede ser un dominio. */
  try {
    const parsed = new URL(u);
    if (!parsed.hostname.includes(".")) return true;
  } catch {
    return true;
  }
  return false;
}

(async function () {
  console.log("\n═══ Basura de pruebas en la base ═══\n");

  const { data: servidores } = await db.from("evolution_servers")
    .select("id, name, url, created_at").order("created_at", { ascending: false });

  const chromosomal = (servidores || []).filter((s) => urlFalsa(s.url));

  console.log("  evolution_servers: " + (servidores || []).length + " filas, " +
    chromosomal.length + " de pruebas\n");
  for (const s of chromosomal) {
    console.log("    " + String(s.id).slice(0, 8) + "  " + String(s.name).padEnd(34) + s.url);
  }

  const { data: bots } = await db.from("bots")
    .select("id, name, instance_name, slug, server_id, status");
  const porId = Object.fromEntries((servidores || []).map((s) => [s.id, s]));

  const huerfanos = (bots || []).filter((b) => {
    const srv = porId[b.server_id];
    if (!srv) return true;                      /* sin servidor */
    if (urlFalsa(srv.url)) return true;         /* servidor de mentira */
    if (!b.instance_name || b.instance_name.trim().length < 3) return true;
    return false;
  });

  console.log("\n  bots: " + (bots || []).length + " filas, " + huerfanos.length + " de pruebas\n");
  for (const b of huerfanos) {
    console.log("    " + String(b.id).slice(0, 8) + "  " + String(b.name).padEnd(20) +
      "instance_name=" + JSON.stringify(b.instance_name) + "  slug=" + JSON.stringify(b.slug));
  }

  const vivos = (bots || []).filter((b) => !huerfanos.includes(b));
  if (vivos.length) {
    console.log("\n  se quedan (tienen servidor real):");
    for (const b of vivos) console.log("    " + String(b.name).padEnd(20) + "instance_name=" + JSON.stringify(b.instance_name));
  }

  if (!chromosomal.length && !huerfanos.length) {
    console.log("\n  ✓ no hay nada que limpiar\n");
    return;
  }

  if (!APLICAR) {
    console.log("\n  Esto es solo el informe. Para borrarlo:");
    console.log("    node db/limpiar-basura-bot.js --aplicar\n");
    return;
  }

  console.log("\n  borrando...");
  let n = 0;

  for (const b of huerfanos) {
    for (const t of ["bots_appointments", "bots_responses", "bots_business_hours",
                     "bots_catalog_items", "bots_orders", "bots_response_logs",
                     "bots_webhook_logs"]) {
      await db.from(t).delete().eq("bot_id", b.id);
    }
    await db.from("bots").delete().eq("id", b.id);
    n++;
  }

  for (const s of chromosomal) {
    const { error } = await db.from("evolution_servers").delete().eq("id", s.id);
    if (error) console.log("    x no se pudo borrar el servidor " + String(s.id).slice(0, 8) + ": " + error.message);
    else n++;
  }

  console.log("  " + n + " filas borradas");

  /* Comprobación: que no quede nada. */
  const { data: quedanBots } = await db.from("bots").select("id, slug");
  const { data: quedanSrv } = await db.from("evolution_servers").select("id, url");
  const sucios = (quedanBots || []).filter((b) => huerfanos.some((x) => x.id === b.id)).length
    + (quedanSrv || []).filter((s) => chromosomal.some((x) => x.id === s.id)).length;
  console.log("  quedan " + (quedanBots || []).length + " bots y " + (quedanSrv || []).length + " servidores"
    + (sucios ? "  (x aún quedan " + sucios + ")" : "  ✓ limpio"));
  console.log("");
})().catch((e) => {
  console.error("\n  x " + (e && e.message ? e.message : String(e)) + "\n");
  process.exitCode = 1;
});