# Panel WhatsApp Bot

SaaS multi-usuario para automatizar respuestas de WhatsApp. Los usuarios registran su cuenta, escanean un QR para conectar WhatsApp y configuran auto-respuestas por palabras clave.

## Características

- **Multi-usuario** — Cada usuario tiene su propia instancia de WhatsApp
- **Panel admin** — Gestión de usuarios y asignación de instancias
- **Auto-respuestas** — Respuestas automáticas por keyword o regex
- **Wizard de onboarding** — Guía paso a paso para usuarios nuevos
- **Webhook handler** — Recibe y responde mensajes en tiempo real
- **Diseño responsive** — Funciona en desktop y móvil

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS
- **Auth:** Supabase Auth
- **DB:** PostgreSQL (Supabase)
- **WhatsApp API:** Evolution API
- **Deploy:** Vercel

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

## Desarrollo

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run build
```

Automáticamente se despliega en Vercel al hacer push a `main`.
