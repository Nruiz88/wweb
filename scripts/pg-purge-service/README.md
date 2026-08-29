# pg-purge-service

Servicio de limpieza diaria para la **Postgres de Evolution** (borra mensajes
viejos de la tabla `Message`, conserva Chats/Contactos).

## Deploy en Railway (como servicio aparte)

1. En Railway → **New Project** → **Deploy from GitHub repo** → seleccioná el repo de la app (`wweb`).
2. En el servicio creado, en **Settings**:
   - **Root Directory**: `scripts/pg-purge-service`
   - **Start Command**: `node index.js` (build: `npm install`)
3. En **Variables** agregá:
   - `DATABASE_URL` → el connection string del Postgres de Evolution (el que termina en `postgres.railway.internal:5432/railway`)
   - Opcional: `RETENTION_DAYS` (default 30), `PURGE_CRON` (default `0 3 * * *`)
4. Deploy.

Como corre en la red interna de Railway, alcanza el hostname `postgres.railway.internal`
sin túnel ni exposición pública.

## Corrida manual (sin deploy)

Instalar y correr una vez:

```bash
npm install
DATABASE_URL="postgresql://..." RETENTION_DAYS=30 node index.js
```

o borrar directo con el script one-shot `../evolution-mongo-purge.cjs` (versión Node
para correr dentro del contenedor de Evolution).