/* =========================================================
   Arranca el bot, pasa la prueba del webhook y lo para
   =========================================================
   Igual que `smoke-auto.js` pero para `db/test-webhook.js`.

   Aquí hay un detalle que `smoke-auto.js` no tiene: la prueba levanta
   ADEMÁS un Evolution falso en otro puerto (3192). Si este script muere,
   hay dos procesos que dejar limpios, no uno. Por eso el `finally`
   comprueba los dos puertos.

     npm run smoke:webhook
   ========================================================= */

const { spawn, spawnSync } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PUERTO = Number(process.env.PUERTO || 3193);
const PUERTO_FALSO = Number(process.env.PUERTO_FALSO || 3192);
const BASE = "http://127.0.0.1:" + PUERTO;
const RAIZ = path.join(__dirname, "..");

let hijo = null;

function esperarPuerto(intentos) {
  return new Promise((resolver) => {
    let i = 0;
    (function intento() {
      const req = http.get(BASE + "/api/health", { timeout: 4000 }, (res) => {
        res.resume();
        resolver(res.statusCode === 200);
      });
      req.on("error", () => seguir());
      req.on("timeout", () => { req.destroy(); seguir(); });
      function seguir() {
        if (++i >= intentos) return resolver(false);
        setTimeout(intento, 800);
      }
    })();
  });
}

function pidsDe(puerto) {
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command",
     "Get-NetTCPConnection -LocalPort " + puerto + " -State Listen -ErrorAction SilentlyContinue | " +
     "Select-Object -ExpandProperty OwningProcess"],
    { encoding: "utf8" }
  );
  return String(r.stdout || "").split(",").map((x) => x.trim()).filter(Boolean);
}

function parar() {
  return new Promise((resolver) => {
    if (!hijo || hijo.exitCode !== null) return resolver();
    console.log("\n  parando el servidor (pid " + hijo.pid + ")...");
    const plazo = setTimeout(() => {
      spawnSync("taskkill", ["/PID", String(hijo.pid), "/T", "/F"], { stdio: "ignore" });
      resolver();
    }, 8000);
    hijo.on("exit", () => { clearTimeout(plazo); resolver(); });
    try { spawnSync("taskkill", ["/PID", String(hijo.pid), "/T", "/F"], { stdio: "ignore" }); } catch {}
  });
}

(async function principal() {
  console.log("\n═══ Prueba del webhook, automática ═══\n");
  console.log("  bot en el puerto: " + PUERTO);
  console.log("  Evolution falso:  " + PUERTO_FALSO);

  for (const p of [PUERTO, PUERTO_FALSO]) {
    const pids = pidsDe(p);
    if (pids.length) {
      console.error("  x el puerto " + p + " ya está ocupado (pid " + pids.join(", ") + ").");
      console.error("    taskkill /PID " + pids[0] + " /T /F");
      process.exitCode = 1;
      return;
    }
  }

  fs.mkdirSync(path.join(RAIZ, "logs"), { recursive: true });

  console.log("  compilando...");
  const build = spawnSync("npm", ["run", "smoke:build"], {
    cwd: RAIZ, shell: process.platform === "win32", encoding: "utf8",
    env: Object.assign({}, process.env, { PORT: String(PUERTO) }),
  });
  if (build.status !== 0) {
    fs.writeFileSync(path.join(RAIZ, "logs", "smoke-build.log"),
      (build.stdout || "") + (build.stderr || ""));
    console.error((build.stdout || "") + (build.stderr || ""));
    throw new Error("el build falló (logs/smoke-build.log)");
  }

  console.log("  arrancando...");
  /* PORT va en el entorno, no en la línea de comandos: con `shell: true`
     los argumentos se concatenan sin escapar y el puerto no llega. */
  hijo = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "smoke:server"], {
    cwd: RAIZ,
    env: Object.assign({}, process.env, { PORT: String(PUERTO) }),
    shell: process.platform === "win32",
    stdio: ["ignore", fs.openSync(path.join(RAIZ, "logs", "webhook.log"), "w"),
                  fs.openSync(path.join(RAIZ, "logs", "webhook.log"), "a")],
  });

  if (!(await esperarPuerto(300))) {
    try {
      console.error(fs.readFileSync(path.join(RAIZ, "logs", "webhook.log"), "utf8").split("\n").slice(-20).join("\n"));
    } catch {}
    throw new Error("el servidor no arrancó (logs/webhook.log)");
  }
  console.log("  en marcha\n");

  const r = spawnSync(process.execPath, [path.join(RAIZ, "db", "test-webhook.js")], {
    stdio: "inherit",
    env: Object.assign({}, process.env, { PORT: String(PUERTO), PUERTO_FALSO: String(PUERTO_FALSO) }),
  });
  process.exitCode = r.status === null ? 1 : r.status;
})()
  .catch((e) => {
    console.error("\n  x " + (e && e.message ? e.message : String(e)) + "\n");
    process.exitCode = 1;
  })
  .then(async () => {
    await parar();
    /* Los dos puertos, no solo el del servidor: la prueba también deja
       un Evolution falso, y ese se lo lleva ella al salir. */
    for (const p of [PUERTO, PUERTO_FALSO]) {
      const pids = pidsDe(p);
      if (pids.length) {
        console.error("\n  x el puerto " + p + " SIGUE ocupado (pid " + pids.join(", ") + ").");
        console.error("    taskkill /PID " + pids[0] + " /T /F");
        process.exitCode = 1;
      }
    }
    if (!process.exitCode) console.log("  puertos " + PUERTO + " y " + PUERTO_FALSO + " libres. Nada quedó vivo.\n");
  });