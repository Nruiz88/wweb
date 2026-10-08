/* =========================================================
   /api/salud — cómo está este servicio
   ---------------------------------------------------------
   Lo consulta el panel de empresa (panel.shopcito.com.ar) para saber,
   antes de que un cliente llame a la puerta, si el bot está vivo y si
   comparte secreto con él.

   ── POR QUÉ EXISTE ──

   Porque el bot NO lo tenía, y eso hacía que la pantalla de Salud lo
   anunciara como caído. El detalle es que el bot sí contestaba: lo que
   no tenía era `/api/salud`, que es donde el panel pregunta. El
   resultado era un "No responde: 404" sobre un servicio perfectamente
   sano, que es la peor forma de mentira posible en una pantalla de
   diagnóstico: hace buscar un fallo donde no lo hay.

   ── ES COPIA DEL DE INVENTARIO ──

   A propósito. Los dos servicios tienen que devolver lo mismo porque el
   panel los lee con el mismo código: si uno devuelve `secret_md5` y el
   otro `hash`, o uno recorta a 16 y el otro a 32, el panel avisa de un
   problema que no existe. Dos implementaciones parecidas divergen; una
   y la otra se copian.

   ── QUÉ DEVUELVE Y QUÉ NO ──

   Devuelve el md5 del SERVICE_SECRET, no el secreto.

     · Un md5 de un secreto de 64 caracteres aleatorios no se deshace
       por fuerza bruta: el espacio de búsqueda es 2^256.
     · Lo que el panel necesita es COMPARAR, no leer. Si los dos dan lo
       mismo, los secretos coinciden.
     · Guardar el secreto en la base para compararlo sería meterlo en
       un sitio donde antes no estaba.

   Y qué NO lleva: nada de mensajes, ni números de conversaciones, ni
   cuentas, ni la url de la base. Un endpoint sin sesión es público por
   definición, así que lo que devuelva tiene que poder enseñarse sin
   vergüenza.

   ── OJO CON EL 503 ──

   Sin SERVICE_SECRET devuelve 503 y lo dice. Un 200 con `ok: false`
   sería peor: el panel leería "responde" y daría el servicio por bueno
   cuando lo que falta es justo lo que tenía que comprobar.
   ========================================================= */

import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* Lo que hace este servicio. */
const NOMBRE = "bot_whatsapp";

function md5(texto: string): string {
  return crypto.createHash("md5").update(texto).digest("hex");
}

export async function GET() {
  const inicio = performance.now();
  const secreto = (process.env.SERVICE_SECRET || "").trim();

  /* Sin secreto no hay nada que comparar, y decirlo es más útil que
     devolver un md5 de cadena vacía, que parecería que todo bien. */
  if (!secreto) {
    return NextResponse.json(
      {
        ok: false,
        servicio: NOMBRE,
        error: "SERVICE_SECRET no está en el entorno.",
      },
      { status: 503 }
    );
  }

  const cosas = {
    ok: true,
    servicio: NOMBRE,

    /* md5 del secreto, recortado a 16: suficiente para comparar y
       bastante menos de lo que alguien podría intentar buscar. */
    secret_md5: md5(secreto).slice(0, 16),

    /* Qué variables críticas hay. Solo si están: el panel prefiere
       "falta X" a un 503 sin explicación.

       Las dos que el bot usa de verdad y las dos que vienen del panel
       para los enlaces de canje. */
    configuracion: {
      supabase_url: Boolean(process.env.SUPABASE_URL),
      supabase_secret_key: Boolean(process.env.SUPABASE_SECRET_KEY),
      supabase_publishable_key: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
      service_secret: true,
      app_url: Boolean(process.env.APP_URL),
      panel_url: Boolean(process.env.NEXT_PUBLIC_PANEL_URL),
      evolution_api_key: Boolean(process.env.EVOLUTION_API_KEY),
      evolution_api_url: Boolean(process.env.EVOLUTION_API_URL),
      webhook_secret: Boolean(process.env.WEBHOOK_SECRET),
    },

    version: process.env.VERSCION || null,
  };

  /* El tiempo que tardó va en la cabecera, no en el cuerpo: así el
     panel lo enseña sin tener que parsear el json.

     Un número constante de "cuánto tardó" no dice nada. Si la pantalla
     de salud dice que algo va lento, tiene que enseñar el tiempo de
     verdad. */
  const respuesta = NextResponse.json(cosas, {
    headers: { "Cache-Control": "no-store" },
  });
  respuesta.headers.set("X-Tiempo-Ms", String(Math.round(performance.now() - inicio)));

  return respuesta;
}

/* OPTIONS y HEAD: los proxies y los health checks los llaman también. Que
   no los rechace, o el panel verá un 405 y pensará que el servicio está
   mal cuando lo único que hizo fue preguntar con el verbo
   equivocado. */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}