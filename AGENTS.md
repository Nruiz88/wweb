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
  schema-v2.sql                     # Schema completo (tablas + trigger + RLS)
```

---

## 3. Base de Datos

### Tablas
```sql
profiles         -- Usuarios (id, email, role: admin|user)
instances        -- Instancias WhatsApp (admin_id, evolution_api_url, evolution_api_key)
user_instances   -- Asignacion usuario <-> instancia
auto_responses   -- Reglas de auto-respuesta (keyword/regex -> respuesta)
response_logs    -- Historial de respuestas ejecutadas
```

### Trigger automatico
Al registrarse un usuario, se crea su perfil automaticamente:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### RLS (Row Level Security)
- profiles: cada usuario ve/edita el suyo
- instances: admin ve las suyas, usuarios ven asignadas
- user_instances: admin gestiona, usuario ve las suyas
- auto_responses: usuario gestiona las suyas
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
