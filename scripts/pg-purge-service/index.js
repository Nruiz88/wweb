#!/usr/bin/env node
/**
 * pg-purge-service — Servicio de limpieza diaria para la Postgres de Evolution.
 * Corre dentro de la red de Railway para alcanzar el hostname interno
 * (postgres.railway.internal). Borra mensajes viejos de la tabla "Message"
 * (conserva Chats/Contactos) y luego hace VACUUM.
 *
 * Variables:
 *   DATABASE_URL / DATABASE_CONNECTION_URI  → connection string del Postgres
 *   PURGE_CRON     → expresión cron (default "0 3 * * *" = 03:00 UTC)
 *   RETENTION_DAYS → retención en días (default 30)
 */
const cron = require("node-cron");
const { Client } = require("pg");

const url = process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_URI;
if (!url) {
  console.error("Falta DATABASE_URL (o DATABASE_CONNECTION_URI)");
  process.exit(1);
}

const retentionDays = Number(process.env.RETENTION_DAYS || 30);
const schedule = process.env.PURGE_CRON || "0 3 * * *";

async function purge() {
  console.log(`[purge] borrando mensajes con más de ${retentionDays} días...`);
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 20000 });
  await client.connect();
  try {
    const cutoff = `EXTRACT(EPOCH FROM (NOW() - INTERVAL '${retentionDays} days'))`;
    const res = await client.query(`DELETE FROM "Message" WHERE "messageTimestamp" < ${cutoff}`);
    console.log(`[purge] borrados: ${res.rowCount}`);
    try {
      await client.query('VACUUM "Message"');
      console.log("[purge] vacuum ok");
    } catch (e) {
      console.log("[purge] vacuum skip:", e.message);
    }
  } finally {
    await client.end();
  }
}

// Corrida inicial al arrancar (para verificar conexión) y luego en el cron.
purge().catch((e) => console.error("[purge] error inicial:", e.message));

cron.schedule(schedule, () => {
  purge().catch((e) => console.error("[purge] error:", e.message));
});

console.log(`[purge] servicio listo. Cron: "${schedule}" | retención: ${retentionDays} días`);