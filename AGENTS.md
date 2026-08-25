# Contexto y Estructura del Proyecto

## 1. Visión General del Proyecto
Desarrollar un panel web (MVP) en **Next.js (App Router)** y **Tailwind CSS**, desplegable en **Vercel**, que actúe como cliente seguro e interfaz gráfica para interactuar con la **Evolution API v2** alojada en Railway.

* **Backend / API:** Evolution API v2.3.7 en Railway (`https://evolution-api-production-f811.up.railway.app`).
* **Base de Datos Backend:** PostgreSQL en Railway.
* **Frontend:** Next.js 14+ (App Router) + TypeScript + Tailwind CSS (ubicado dentro de `src/`).
* **Seguridad Primaria:** Proxy de peticiones mediante Route Handlers en Next.js para ocultar la `EVOLUTION_API_KEY` global del navegador cliente.

---

## 2. Reglas de Arquitectura y Seguridad
1. **Zero Exposure:** Ninguna clave de API (`EVOLUTION_API_KEY`) debe incluir el prefijo `NEXT_PUBLIC_`. Todas las llamadas hacia Railway deben hacerse exclusivamente desde el servidor de Next.js (`src/app/api/...`).
2. **Control de Errores Robustos:** Los Route Handlers deben capturar fallos de red con el backend de Railway y retornar respuestas JSON estructuradas (`{ status, error, data }`).
3. **No-Cache en Estado de Instancia:** Las peticiones a `/instance/connectionState` y `/instance/connect` deben llevar el encabezado `cache: 'no-store'` para garantizar que los códigos QR y estados de sesión no se guarden en la caché de Next.js/Vercel.

---

## 3. Estructura de Archivos (Directorio `src/`)

```text
.
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── whatsapp/
│   │   │       └── route.ts             # Proxy principal: GET (Estado/QR) y POST (Envío de texto)
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx                   # Layout global con tema oscuro (Slate/Emerald)
│   │   └── page.tsx                     # Dashboard principal (Estado + QR + Formulario)
│   ├── components/
│   │   ├── ConnectionBadge.tsx          # Indicador visual de estado (Conectado / Desconectado)
│   │   ├── QrViewer.tsx                 # Renderizador de la imagen Base64 del código QR
│   │   └── SendMessageForm.tsx          # Formulario para enviar mensajes de texto
│   └── lib/
│       └── evolution.ts                 # Helper/Fetch centralizado con headers de autenticación
├── .env.local                           # Variables de entorno locales
├── AGENTS.md                            # Instrucciones y contexto para OpenCode
├── package.json
└── tsconfig.json
