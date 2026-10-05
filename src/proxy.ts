import { NextResponse, type NextRequest } from "next/server";
import { leerSesion, tieneElModulo, COOKIE_NAME } from "./lib/sesion";

/* =========================================================
   Nexo Studio — Proxy del bot
   ---------------------------------------------------------
   Protege las páginas del panel del bot (bot.midominio.com/dashboard...)
   y añade las cabeceras de seguridad.

   LO QUE CAMBIÓ
   -------------
   Antes:
     · cookie `wweb_session` con un JWT propio, firmada con JWT_SECRET
     · `/login`, `/register`, `/reset-password` como rutas públicas
       (el bot tenía su propio sistema de usuarios)
     · un chequeo de `user_instances` para limitar qué páginas ve un
       usuario no admin
     · la landing en `/`

   Ahora:
     · la entrada es un TICKET firmado que el panel emite, en
       `/entrar#<ticket>`, y se canjea por una sesión propia
       (`nexo_bot`)
     · no hay login ni registro: quien entra es un cliente de Nexo
       Studio que ya se autenticó en el panel
     · no hay usuarios "no admin": hay clientes de Nexo Studio

   ⚠️  LO QUE ESTE MIDDLEWARE NO HACE
   ---------------------------------
   No es la barrera de seguridad. Solo evita pintar páginas sin sesión
   a alguien que no la tiene. Los DATOS ya los protege RLS en la base
   (migración 011): aunque alguien llegara aquí sin sesión, las
   consultas con el cliente de Supabase no devolverían filas.

   La diferencia es que el middleware mejora la experiencia (no
   renderizar un panel vacío) mientras que RLS es lo que impide de
   verdad ver datos ajenos. Son dos capas y hacen falta las dos.
   ========================================================= */

/* Rutas que se sirven siempre, sin sesión.

   `/agendar` y `/agendar/<slug>` son la página PÚBLICA de reservas: la
   usan los clientes finales del comercio, que no tienen cuenta en
   Nexo Studio ni en ningún sitio. Por eso no pueden exigir sesión.

   `/entrar` también es pública: es la que canjea el ticket.

   El matcher de abajo ya deja fuera los ficheros estáticos, así que
   aquí solo hacen falta estas. */
const PUBLICAS = ["/agendar", "/entrar"];

function conCabeceras(respuesta: NextResponse): NextResponse {
  respuesta.headers.set("X-Frame-Options", "DENY");
  respuesta.headers.set("X-Content-Type-Options", "nosniff");
  respuesta.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  respuesta.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  const esDev = process.env.NODE_ENV !== "production";
  const scriptSrc = "script-src 'self' 'unsafe-inline'" + (esDev ? " 'unsafe-eval'; " : " ; ");

  respuesta.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; " +
      scriptSrc +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https: wss:; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'"
  );
  return respuesta;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /* Las rutas de API se dejan pasar: cada una define en su interior si
     exige sesión (ver exigeSesion en lib/api-helpers.ts). El webhook
     de Evolution, por ejemplo, no tiene sesión porque lo llama una
     máquina, y por eso se valida con la firma. */
  if (pathname.startsWith("/api")) {
    return conCabeceras(NextResponse.next({ request }));
  }

  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return conCabeceras(NextResponse.next({ request }));
  }

  const sesion = await leerSesion(request.cookies.get(COOKIE_NAME)?.value);

  if (!sesion) {
    /* Sin sesión no hay entrada. Se manda a `/entrar` conservando la
       página pedida: `/entrar` canjea el ticket y al volver redirige
       al dashboard. Para eso hace falta un `?next=`, que se lee aquí
       al llegar y se pasa en el POST. */
    const destino = new URL("/entrar", request.url);
    destino.searchParams.set("next", pathname);
    return conCabeceras(NextResponse.redirect(destino));
  }

  /* Se comprueba la suscripción en cada petición, no solo al entrar.
     Si alguien cancela con el navegador ya abierto, tiene que dejar de
     funcionar en la siguiente llamada y no cuando le dé la gana. Es el
     caso más feo del SaaS: el cliente sigue usando lo que ya pagó y
     ya no tiene. */
  if (!(await tieneElModulo(sesion.clientId, "bot_whatsapp"))) {
    const r = NextResponse.redirect(new URL("/sin-acceso", request.url));
    r.cookies.delete(COOKIE_NAME);
    return conCabeceras(r);
  }

  return conCabeceras(NextResponse.next({ request }));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};