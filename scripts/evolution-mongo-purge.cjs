#!/usr/bin/env node
/**
 * evolution-mongo-purge.cjs
 * Purga mensajes viejos de la MongoDB de Evolution (versión Node, para correr
 * en el contenedor del server de Evolution, que NO tiene mongosh pero SÍ tiene
 * Node + el paquete `mongodb` instalado).
 *
 * IMPORTANTE: solo borra `Message` viejos. CONSERVA Chats/Contactos (los Chats
 * son los JIDs que nuestra app usa para listar los grupos).
 *
 * Uso (en la consola del server de Evolution, desde la raíz del proyecto donde
 * está node_modules):
 *   node evolution-mongo-purge.cjs
 *   # o con otro connection string / retención:
 *   MONGO_URL="mongodb://..." RETENTION_DAYS=30 node evolution-mongo-purge.cjs
 *
 * Si no se pasa MONGO_URL, intenta leer DATABASE_CONNECTION_URI de las env del
 * server (la variable que usa Evolution).
 */

const { MongoClient } = require("mongodb");

const mongoUrl =
  process.env.MONGO_URL || process.env.DATABASE_CONNECTION_URI || process.env.DATABASE_URL;

if (!mongoUrl) {
  console.error("No encontré connection string. Pasalo como MONGO_URL o DATABASE_CONNECTION_URI");
  process.exit(1);
}

const retentionDays = Number(process.env.RETENTION_DAYS || 30);
const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
const cutoffSeconds = Math.floor(cutoff.getTime() / 1000);

const targetDb = process.env.DB_NAME || null;

async function main() {
  const client = new MongoClient(mongoUrl, { connectTimeoutMS: 20000 });
  await client.connect();
  console.log(`Retención: ${retentionDays} días (corte: ${cutoff.toISOString()})`);

  const admin = client.db().admin();
  let dbNames = targetDb
    ? [targetDb]
    : (await admin.listDatabases()).databases
        .map((d) => d.name)
        .filter((n) => !["admin", "local", "config"].includes(n));

  console.log(`Bases a revisar: ${dbNames.length}`);

  let totalDeleted = 0;
  for (const dbName of dbNames) {
    const d = client.db(dbName);
    const cols = await d.listCollections().toArray().catch(() => []);
    if (!cols.some((c) => c.name === "Message")) {
      console.log(`- ${dbName}: sin colección Message, skip`);
      continue;
    }
    const col = d.collection("Message");
    try {
      await col.createIndex({ messageTimestamp: 1 });
    } catch (_e) {
      /* índice ya existe o no se puede */
    }
    const before = await col.countDocuments();
    const res = await col.deleteMany({
      $or: [
        { messageTimestamp: { $lt: cutoffSeconds } },
        { "message.messageTimestamp": { $lt: cutoffSeconds } },
      ],
    });
    totalDeleted += res.deletedCount;
    console.log(`- ${dbName}: ${before} mensajes → borrados ${res.deletedCount} (antes de ${cutoff.toISOString()})`);
  }

  console.log(`\nTOTAL borrados: ${totalDeleted}`);
  if (totalDeleted > 0) {
    console.log("MongoDB reutiliza el espacio; para compactar: db.runCommand({ compact: 'Message' }) en horario de baja.");
  }
  await client.close();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});