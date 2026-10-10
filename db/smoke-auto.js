/* =========================================================
   Arranca el bot, pasa la prueba de humo y lo para
   =========================================================
   Existe por un motivo concreto: si lanzas `npm run start` a mano y
   luego la prueba falla, el servidor se queda vivo ocupando un puerto
   y nadie se acuerda de pararlo. Es la forma más fácil de dejar un
   proceso huérfano.

   Aquí el servidor es un PROCESO HIJO de este script, en su propio
   grupo, y se mata en el `finally` con taskkill /T /F, que mata el
   árbol entero (cmd.exe deja nietos si solo se le mata a él).

   Si este script muere a cualquier punto, el `finally` se ejecuta
   igual. Y si aun así quedara algo, el `finally` comprueba el puerto y
   avisa en vez de callarse.

     npm run smoke:auto
   ========================================================= */

const { spawn, spawnSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PUERTO = Number(process.env.PUERTO || 3194);
const BASE = "http://127.0.0.1:" + PUERTO;
const RAIZ = path.join(__dirname, "..");

let hijo = null;

function waiterPuerto(intentos) {
  return new Promise((resolver) => {
    let i = 0;
    (function comprobar() {
      const req = http.get(BASE + "/api/health", { timeout: 4000 }, (res) => {
        res.resume();
        resolver(res.statusCode === 200);
      });
      req.on("error", () => seguir());
      req.on("timeout", () => { req.destroy(); seguir(); });

      function seguir() {
        if (++i >= intentos) return resolver(false);
        setTimeout(comprobar, 800);
      }
    })();
  });
}

function parar() {
  return new Promise((resolver) => {
    if (!hijo || hijo.exitCode !== null) return resolver();

    console.log("\n  parando el servidor (pid " + hijo.pid + ")...");

    /* Si no muere en 8 s, se le dice. */
    const plazo = setTimeout(() => {
      console.log("  no respondió al SIGTERM, mandando el árbol entero a la guillotina");
      spawnSync("taskkill", ["/PID", String(hijo.pid), "/T", "/F"], { stdio: "ignore" });
      resolver();
    }, 8000);

    hijo.on("exit", () => {
      clearTimeout(plazo);
      resolver();
    });

    try {
      /* /T mata el árbol. Sin esto, cmd.exe muere pero next-server sigue. */
      spawnSync("taskkill", ["/PID", String(hijo.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {}
  });
}

function puertoLibre() {
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command",
     "(Get-NetTCPConnection -LocalPort " + PUERTO + " -State Listen -ErrorAction SilentlyContinue | " +
     "Select-Object -ExpandProperty OwningProcess) -join ','"],
    { encoding: "utf8" }
  );
  return !String(r.stdout || "").trim();
}

(async function principal() {
  console.log("\n═══ Prueba de humo, automática ═══\n");
  console.log("  puerto: " + PUERTO);

  /* Si ya hay algo en el puerto, se dice en vez de reventar: casi
     siempre es un servidor de una ejecución anterior. */
  if (!puertoLibre()) {
    console.error("  ✗ El puerto " + PUERTO + " ya está ocupado.");
    console.error("    Puede ser un servidor de una prueba anterior. Se puede parar con:");
    console.error("      $p = (Get-NetTCPConnection -LocalPort " + PUERTO + " -State Listen).OwningProcess");
    console.error("      taskkill /PID $p /T /F");
    process.exitCode = 1;
    return;
  }

  const log = path.join(RAIZ, "logs", "smoke.log");
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const flujo = fs.openSync(log, "w");

  /* El build va aparte, para que su salida no se mezcle con la del
     servidor y se pueda leer `logs/smoke-build.log` si algo falla. */
  console.log("  compilando...");
  const compilacion = spawnSync("npm", ["run", "smoke:build"], {
    cwd: RAIZ,
    env: Object.assign({}, process.env, { PORT: String(PUERTO) }),
    shell: process.platform === "win32",
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (compilacion.status !== 0) {
    try {
      fs.writeFileSync(path.join(RAIZ, "logs", "smoke-build.log"),
        (compilacion.stdout || "") + (compilacion.stderr || ""));
    } catch {}
    console.error((compilacion.stdout || "") + (compilacion.stderr || ""));
    throw new Error("el build falló (mira logs/smoke-build.log)");
  }

  console.log("  arrancando (build + start)...");

  /* PORT va en el entorno del hijo, no en la línea de comandos.

     Con `shell: true`, Node concatena los argumentos sin escaparlos, y
     ahí el `set PORT=... &&` no llega a PowerShell como se espera: el
     build pasaba (no necesita el puerto) pero `next start` arrancaba en
     el 3000, que es justo donde está el panel de empresa. El script
     esperaba en el 3194 y no recibía nada.

     En el entorno no hay ese problema: `next start` lo lee igual. */
  hijo = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "smoke:server"],
    {
      cwd: RAIZ,
      env: Object.assign({}, process.env, { PORT: String(PUERTO) }),
      shell: process.platform === "win32",
      stdio: ["ignore", flujo, flujo],
    }
  );

  /* El build tarda. 300 intentos x 800 ms = 4 minutos de margen. */
  const listo = await waiterPuerto(300);
  if (!listo) {
    console.error("\n  ✗ El servidor no llegó a responder.");
    try {
      console.error("--- logs/smoke.log ---");
      console.error(fs.readFileSync(log, "utf8").split("\n").slice(-20).join("\n"));
    } catch {}
    throw new Error("el servidor no arrancó (mira logs/smoke.log)");
  }

  console.log("  en marcha\n");

  const r = spawnSync(process.execPath, [path.join(RAIZ, "db", "smoke.js")], {
    stdio: "inherit",
    env: Object.assign({}, process.env, { PORT: String(PUERTO) }),
  });
  process.exitCode = r.status === null ? 1 : r.status;
})()
  .catch(function (e) {
    console.error("\n  ✗ " + (e && e.message ? e.message : String(e)) + "\n");
    process.exitCode = 1;
  })
  .then(async function () {
    await parar();

    /* Comprobación final: si el puerto sigue ocupado, se dice con nombre
       y owning PID. Callarse aquí es lo que deja procesos huérfanos. */
    if (!puertoLibre()) {
      const r = spawnSync(
        "powershell.exe",
        ["-NoProfile", "-Command",
         "Get-NetTCPConnection -LocalPort " + PUERTO + " -State Listen -ErrorAction SilentlyContinue | " +
         "Select-Object -ExpandProperty OwningProcess"],
        { encoding: "utf8" }
      );
      const pid = String(r.stdout || "").trim();
      console.error("\n  ✗ El puerto " + PUERTO + " SIGUE ocupado (pid " + pid + ").");
      console.error("    Para liberarlo:");
      console.error("      taskkill /PID " + pid + " /T /F");
      process.exitCode = 1;
      return;
    }

    console.log("  puerto " + PUERTO + " libre. Nada quedó vivo.\n");
  });