# Contexto y Estructura del Proyecto

## 1. Vision General

**Panel WhatsApp** — Plataforma multi-usuario para gestionar instancias de WhatsApp via Evolution API v2, con auto-respuestas automaticas por palabras clave.

### Stack
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Backend API:** Next.js Route Handlers
- **Base de Datos:** Supabase (PostgreSQL + Auth + RLS)
- **WhatsApp API:** Evolution API v2 en Railway
- **Auth:** Supabase Auth (email/password)

### Modelo multi-usuario
```
ADMIN (tu)                          USUARIOS
──────────                          ────────
Crea instancias en Supabase         Conectan su WhatsApp (QR)
Asigna usuarios a instancias        Configuran auto-respuestas
Gestiona API keys (ocultas)         Ven solo su instancia asignada
Ve todos los datos                  No ven credenciales
```

### Modelo de planes
```
starter    -> 1 instancia base
pro        -> 1 instancia base
community  -> 1 instancia base
```
Todos los planes incluyen **exactamente 1 bot/instancia** por defecto (`max_instances = 1`).
Los bots adicionales se contratan como **add-ons** (tabla `instance_addons`, campo `quantity`).
Limite efectivo = `max_instances` (base, siempre 1) + suma de add-ons activos
(via funcion `get_effective_max_instances(user_id)`).

Cada usuario nace con suscripcion `starter`/`active`/`1` automaticamente via trigger en `auth.users`.

---

## 2. Estructura de Archivos

```
src/
  app/
    (auth)/
      login/page.tsx                # Login
      register/page.tsx             # Registro
    (dashboard)/
      layout.tsx                    # Layout con sidebar (detecta rol admin/user)
      page.tsx                      # Dashboard principal (stats + primeros pasos)
      whatsapp/page.tsx             # Conexion WhatsApp (QR + estado)
      auto-responses/page.tsx       # CRUD auto-respuestas
      logs/page.tsx                 # Logs de actividad
      settings/page.tsx             # Gestionar instancias (admin crea, usuario ve)
      admin/page.tsx                # Panel admin: lista usuarios + asignar instancias
    api/
      instances/route.ts            # CRUD instancias
      auto-responses/route.ts       # CRUD auto-respuestas
      logs/route.ts                 # Logs de actividad
      webhook/route.ts              # Webhook Evolution API (recibe mensajes)
      whatsapp/route.ts             # Conexion WhatsApp (QR, status, logout)
      admin/
        assign/route.ts             # Asignar/desasignar usuarios
        users/route.ts              # Listar usuarios (admin)
    globals.css                     # Estilos WhatsApp Web
    layout.tsx                      # Layout raiz
  components/
    icons.tsx                       # Iconos SVG
  lib/
    supabase/
      client.ts                     # Cliente browser (createBrowserClient)
      server.ts                     # Cliente server (service role)
      config.ts                     # Config de env vars
      types.ts                      # Tipos TypeScript
    evolution-multi.ts              # Helper Evolution API multi-tenant
  middleware.ts                     # Auth middleware (Supabase SSR)
supabase/
  schema.sql                        # Schema BASE completo (tablas + enums + triggers + RLS) - se re-aplica solo en DB nueva
  update.sql                        # Script INCREMENTAL para aplicar cambios sobre DB ya creada (se pisa en cada cambio)
```

---

## 3. Base de Datos

### Tablas
```sql
profiles         -- Usuarios (id, email, role: admin|user, business_name, phone, address)
subscriptions    -- Planes (plan_type: starter|pro|community, status, max_instances)
instance_addons  -- Add-ons: bots extra contratados (quantity, status: active|canceled)
instances        -- Instancias WhatsApp (admin_id, evolution_api_url, evolution_api_key, status)
user_instances   -- Asignacion usuario <-> instancia
auto_responses   -- Reglas de auto-respuesta (keyword/regex -> respuesta)
response_logs    -- Historial de respuestas ejecutadas
```

### Enums
```sql
plan_type           -- ('starter', 'pro', 'community')
subscription_status -- ('active', 'past_due', 'canceled')
instance_status     -- ('disconnected', 'qr_ready', 'connected')
addon_status        -- ('active', 'canceled')
```

### Trigger automatico
Al registrarse un usuario se crean su perfil y su suscripcion starter automaticamente:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Al crearse un perfil de tipo `user`, se auto-asigna una instancia propia
(server Railway menos cargado, max 10 conexiones por server):
```sql
CREATE TRIGGER trg_auto_assign_instance
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_instance();
```
Logica reutilizable en `public.assign_instance_for_user(user_id)`
(tambien usada para backfill de usuarios existentes sin instancia).

### RLS (Row Level Security)
- profiles: cada usuario ve/edita el suyo (`role` solo via service_role)
- subscriptions: cada usuario ve/actualiza la suya
- instances: admin ve las suyas, usuarios ven asignadas (`evolution_api_key`/`url` no legibles por clientes)
- user_instances: admin gestiona, usuario ve las suyas
- auto_responses: usuario gestiona solo sobre instancias propias o asignadas
- response_logs: usuario ve los suyos

---

## 4. Variables de Entorno

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # Browser (segura con RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # Solo servidor

# Evolution API (NO exponer al browser)
EVOLUTION_API_URL=https://xxx.up.railway.app
EVOLUTION_API_KEY=xxx
INSTANCE_NAME=xxx
```

---

## 5. API Endpoints

### Publicos
- POST /api/webhook            # Webhook Evolution API (sin auth)

### Autenticados (usuario)
- GET /api/instances           # Ver instancias asignadas
- GET/POST/PUT/DELETE /api/auto-responses  # CRUD auto-respuestas
- GET /api/logs                # Ver logs
- GET/POST/DELETE /api/whatsapp  # Conexion WhatsApp (QR, status, logout)

### Solo Admin
- POST /api/instances          # Crear instancia
- DELETE /api/instances?id=    # Eliminar instancia
- GET /api/admin/users         # Listar usuarios
- POST /api/admin/assign       # Asignar usuario a instancia
- DELETE /api/admin/assign?id= # Desasignar usuario

---

## 6. Auto-Respuestas

### Flujo
```
Mensaje entra via webhook
  -> Busca instancia por nombre
  -> Match contra auto_responses activas (keyword o regex)
  -> Verifica horario si tiene schedule
  -> Respeta prioridad (mayor prioridad primero)
  -> Envia respuesta via Evolution API
  -> Registra en response_logs
```

### Tipos de match
- **Keyword:** "precio" responde si el mensaje contiene "precio" (case-insensitive)
- **Regex:** `/horario.*/` responde si el mensaje matchea el patron

### Funcionalidades
- Prioridad (mayor = primero)
- Horario de activacion (ej: 9am-6pm)
- Respuesta con texto y/o media URL
- Activar/desactivar reglas
- Logs de cada respuesta

---

## 7. Webhook Evolution API

URL: `POST /api/webhook`

Evolution API envia eventos. Solo procesamos `messages.upsert`:
- Ignora mensajes propios (fromMe)
- Ignora grupos (@g.us)
- Busca instancia por nombre
- Matchea auto-respuestas activas
- Envia respuesta con delay de 1.5s
- Registra en response_logs

Para configurar en Evolution API:
- Webhook URL: `https://tu-dominio.vercel.app/api/webhook`
- Eventos: messages.upsert

---

## 8. Convenciones

- TypeScript estricto
- Tailwind CSS inline
- Functional components
- async/await
- Try/catch en operaciones async

---

## 9. Gestion de Scripts SQL (IMPORTANTE)

Existen **dos** archivos SQL y se usan de forma distinta:

### `supabase/schema.sql` — Schema BASE
- Contiene el esquema COMPLETO (tablas + enums + triggers + RLS + helpers).
- Se ejecuta **solo en una base nueva** (o reset).
- NO se toca en cambios incrementales; debe reflejar el estado final deseado.

### `supabase/update.sql` — Script INCREMENTAL
- Es el que se ejecuta en el **SQL Editor de Supabase sobre la DB ya creada**.
- Cuando se agrega una funcion, tabla, columna, trigger, politica RLS o se modifica algo:

1. **Escribir SOLO el cambio incremental** en `supabase/update.sql`,
   **pisando/REEMPLAZANDO por completo el contenido anterior** (no acumular).
   Ejemplos de lo que va ahi:
   ```sql
   -- Nueva funcion/trigger
   CREATE OR REPLACE FUNCTION ...
   -- Nueva columna
   ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
   -- Nueva politica RLS
   DROP POLICY IF EXISTS ...; CREATE POLICY ...
   -- Nuevo indice
   CREATE INDEX IF NOT EXISTS ...
   ```
2. **Sincronizar `supabase/schema.sql`** con el mismo cambio (para que refleje el
   estado final y sirva para una DB nueva).
3. Si el cambio es de datos/backfill, agregar el `UPDATE ...` en `update.sql`.
4. Siempre usar `IF NOT EXISTS` / `IF EXISTS` y `DROP POLICY IF EXISTS` antes de
   recrear, para que sea idempotente y se pueda ejecutar mas de una vez.

### Regla de oro
> `schema.sql` = estado deseado final de la DB (base nueva).
> `update.sql` = el ultimo delta aplicable (DB existente). Ambos deben quedar
> sincronizados tras cada cambio.
