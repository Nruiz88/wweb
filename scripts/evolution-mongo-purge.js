/**
 * evolution-mongo-purge.js
 * Purga mensajes viejos de la MongoDB de Evolution para liberar peso.
 *
 * IMPORTANTE: solo borra documentos de la colección `Message` anteriores a
 * RETENTION_DAYS. CONSERVA los `Chat` y `Contact` (los Chats son los JIDs que
 * nuestra app usa para listar los grupos — NO borrarlos).
 *
 * Uso:
 *   mongosh "mongodb://usuario:pass@host:27017/evolution" \
 *     --quiet \
 *     --eval 'const RETENTION_DAYS = 30;' \
 *     --file evolution-mongo-purge.js
 *
 * Con per-instance DBs (VARIAS bases de Evolution), se recorre cada base que
 * tenga la colección `Message`. Para apuntar a UNA sola base:
 *   --eval 'const DB_NAME = "instancia1";'
 *
 * Dónde está el connection string: variables de Railway del server de
 * Evolution (DATABASE_CONNECTION_URI o similar), o el .env del server.
 */

const retentionDays = typeof RETENTION_DAYS !== "undefined" ? RETENTION_DAYS : 30;
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - retentionDays);
const cutoffSeconds = Math.floor(cutoff.getTime() / 1000);

const targetDb = typeof DB_NAME !== "undefined" ? DB_NAME : null;

const dbNames = targetDb
  ? [targetDb]
  : db.getMongo()
      .getDBNames()
      .filter((n) => !["admin", "local", "config"].includes(n));

print(`Retención: ${retentionDays} días (corte: ${cutoff.toISOString()})`);
print(`Bases a revisar: ${dbNames.length}`);

let totalDeleted = 0;

for (const dbName of dbNames) {
  const d = db.getMongo().getDB(dbName);
  const collections = d.getCollectionNames();
  if (!collections.includes("Message")) {
    print(`- ${dbName}: sin colección Message, skip`);
    continue;
  }

  const col = d.getCollection("Message");

  // Índice recomendado para que el borrado no escanee todo (best-effort).
  try {
    col.createIndex({ messageTimestamp: 1 });
  } catch (_e) {
    // si ya existe o no se puede, seguimos
  }

  const before = col.countDocuments();
  const res = col.deleteMany({
    $or: [
      { messageTimestamp: { $lt: cutoffSeconds } },
      { "message.messageTimestamp": { $lt: cutoffSeconds } },
    ],
  });

  totalDeleted += res.deletedCount;
  print(
    `- ${dbName}: ${before} mensajes → borrados ${res.deletedCount} anteriores a ${cutoff.toISOString()}`,
  );
}

print(`\nTOTAL borrados: ${totalDeleted}`);

if (totalDeleted > 0) {
  print(
    "Nota: MongoDB reutiliza el espacio liberado (el tamaño en disco no baja solo).",
  );
  print(
    "Para compactar: en la base correspondiente, `db.runCommand({ compact: 'Message' })`",
  );
}