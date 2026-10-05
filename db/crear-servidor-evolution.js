/* =========================================================
   Crea (o reutiliza) el servidor de Evolution real
   =========================================================
   POR QUÉ ESTE SCRIPT

   Al probar el webhook contra la Evolution de verdad apareció que la tabla
   `evolution_servers` NO TIENE NINGUNA fila que apunte al servidor real.
   Las 11 que había eran de pruebas, con url `https://x` y `evolution.example`.

   O sea: la cadena estaba rota en el punto más básico. El bot resuelve su
   servidor con un JOIN desde `bots.server_id`, y no había a qué apuntar.
   Aunque un cliente tuviera bot, no habría forma de Mandar un WhatsApp.

   QUÉ HACE

     · Busca si ya hay una fila con la misma url. Si existe, no toca nada:
      reusarla es lo correcto, porque los bots la pueden estar usando.
     · Si no, inserta una con la url y la clave de `.env.local`.
     · No imprime la clave. Nunca.

   POR QUÉ ESTO ES UNA DECISIÓN TUYA Y NO MÍA

   El nombre de la instancia y el teléfono los pones tú. Este script solo
   crea el servidor; no crea bots ni toca instancias de Evolution. Luego,
   cuando me digas a qué cliente corresponde "Boti 1", se crea su bot con
   `instance_name = "Boti 1"`.

     node db/crear-servidor-evolution.js            informe
     node db/crear-servidor-evolution.js --aplicar   lo crea
   ========================================================= */

const fs = require("fs");

function leerEnv(ruta) {
  const out = {};
  for (const l of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const APLICAR = process.argv.includes("--aplicar");

(async function () {
  const env = leerEnv("D:/webs/wweb/.env.local");
  const url = (env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
  const clave = env.EVOLUTION_API_KEY || "";

  console.log("\n═══ Servidor de Evolution ═══\n");

  if (!url || !clave) {
    console.log("  x EVOLUTION_API_URL o EVOLUTION_API_KEY no están en .env.local\n");
    process.exitCode = 1;
    return;
  }

  console.log("  url:  " + url);
  console.log("  clave: " + clave.length + " caracteres (no se imprime)\n");

  require("D:/webs/empresa/lib/env").load();
  const db = require("D:/webs/empresa/lib/supabase").getAdmin();

  const { data: existentes } = await db.from("evolution_servers").select("id, name, url, created_at");
  const misma = (existentes || []).filter((s) => String(s.url).replace(/\/+$/, "") === url);

  if (misma.length) {
    console.log("  Ya existe una fila con esa url. No se toca nada:");
    for (const s of misma) console.log("    " + String(s.id).slice(0, 8) + "  " + s.name);
    console.log("\n  Los bots la pueden estar usando; duplicarla dejaría dos filas\n");
    console.log("  parecidas y el servidor elegido dependería del orden.\n");
    return;
  }

  console.log("  No hay ninguna fila con esa url. Las que hay:");
  if (!(existentes || []).length) console.log("    (la tabla está vacía)");
  for (const s of existentes || []) console.log("    " + String(s.id).slice(0, 8) + "  " + s.name + "  " + s.url);

  if (!APLICAR) {
    console.log("\n  Para crearla:");
    console.log("    node db/crear-servidor-evolution.js --aplicar\n");
    return;
  }

  const nombre = "Evolution principal";
  const { data: creado, error } = await db.from("evolution_servers")
    .insert({ name: nombre, url, api_key: clave })
    .select("id, name, url").single();

  if (error) {
    console.log("\n  x no se pudo crear: " + error.message + "\n");
    process.exitCode = 1;
    return;
  }

  console.log("\n  ✓ creada: " + String(creado.id).slice(0, 8) + "  " + creado.name);
  console.log("\n  Ahora falta el bot: hay que darle `instance_name` con el nombre EXACTO");
  console.log("  de la instancia en Evolution (ahora mismo hay una sola, 'Boti 1').");
  console.log("  Dime a qué cliente es y lo creo.\n");
})().catch((e) => {
  console.error("\n  x " + (e && e.message ? e.message : String(e)) + "\n");
  process.exitCode = 1;
});