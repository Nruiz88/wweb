import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cerrarSesion, COOKIE_NAME } from "@/lib/sesion";

export const dynamic = "force-dynamic";

/* =========================================================
   POST /api/salir  —  cerrar la sesión del bot
   =========================================================
   Antes esto era `/api/auth/logout`, del sistema de usuarios propio del
   bot, y la página de login vivía en `/login`. Las dos cosas ya no
   existen: la identidad es la de Nexo Studio y no hay login aquí.

   Ahora cierra la sesión del bot (revoca la fila de `bot_sesiones`) y
   manda a la pantalla de entrada, que es lo coherente: si alguien
   cerró sesión, el sitio al que volver es "entra de nuevo", no el
   panel de Nexo Studio (que sigue abierto en su propia pestaña y no se
   ve afectado).

   Que cerrar sesión aquí NO cierre la del panel es intencionado y es
   justo el aislamiento del que se habla en proxy.ts: cada servicio
   tiene su cookie y su vida útil. */
export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) await cerrarSesion(token);

  const respuesta = NextResponse.json({ ok: true, volver: "/entrar" });

  /* Se borra la cookie con las mismas opciones con las que se puso.
     Si no coinciden, el navegador puede no borrarla y el usuario
     seguiría "con sesión" en la barra. */
  respuesta.cookies.delete(COOKIE_NAME);
  respuesta.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return respuesta;
}