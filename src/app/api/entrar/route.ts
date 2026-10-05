import { NextResponse } from "next/server";
import { verificar, tokenDe } from "@/lib/tickets";
import { crearSesion, tieneElModulo, COOKIE_NAME } from "@/lib/sesion";

/* =========================================================
   POST /api/entrar  —  canjea el ticket por una sesión
   ---------------------------------------------------------
   El flujo completo es:

     1. panel.midominio.com/panel/servicios/:id/entrar
        Firma un ticket y redirige a bot.midominio.com/entrar#<ticket>

     2. /entrar  (esta app) sirve una página cuyo JavaScript lee el
        FRAGMENTO y hace POST a este endpoint con el ticket.

     3. Este endpoint verifica la firma, comprueba que el cliente
        REALLY tiene el bot contratado, y pone una cookie propia.

   POR QUÉ EL TICKET VIENE EN EL FRAGMENTO Y NO EN LA URL
   ------------------------------------------------------
   El ticket lleva dentro el access_token de Supabase. En el
   fragmento (#) el navegador no lo manda al servidor, así que no
   acaba en los logs del proxy, ni en el historial, ni en las
   cabeceras de petición. Con ?ticket=... acabaría en todas partes.

   POR QUÉ SE COMPRUEBA LA SUSCRIPCIÓN SI EL TICKET ES AUTÉNTICO
   ----------------------------------------------------------
   Porque la firma solo dice QUIÉN es el usuario, no qué ha
   contratado. Si alguien le pasa a un cliente el ticket de otro, su
   suscripción no cuadra y se le rechaza aquí. El panel ya hizo la
   comprobación, pero repetirla es lo que hace que un enlace
   reenviado no sirva.
   ========================================================= */

export const dynamic = "force-dynamic";

/** El módulo que hay que tener contratado para usar esto. */
const MODULO = "bot_whatsapp";

/** Nombre que se le enseña al cliente en los mensajes. */
const NOMBRE = "el bot de WhatsApp";

export async function POST(request: Request) {
  let ticket = "";
  try {
    const cuerpo = (await request.json()) as { ticket?: unknown };
    ticket = String(cuerpo.ticket ?? "");
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo leer la petición." },
      { status: 400 }
    );
  }

  const p = verificar(ticket);

  if (!p) {
    /* No se distingue entre "no existe", "caducado" y "manipulado":
       informar de cuál sería una guía para ir probando. */
    return NextResponse.json(
      {
        ok: false,
        error: "Ese enlace no vale o ha caducado. Vuelve a entrar desde el panel.",
      },
      { status: 401 }
    );
  }

  /* Sin `cid` no hay cliente, y sin cliente no hay nada que mirar. El
     ticket de staff sí puede venir sin él, pero staff no entra por aquí:
     el bot es de uso del cliente. */
  if (!p.cid) {
    return NextResponse.json(
      { ok: false, error: "Este enlace no es de una cuenta de cliente." },
      { status: 403 }
    );
  }

  const ok = await tieneElModulo(p.cid, MODULO);
  if (!ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Tu cuenta no tiene ${NOMBRE} contratado o está vencido.`,
      },
      { status: 403 }
    );
  }

  let sesion;
  try {
    sesion = await crearSesion({
      userId: p.uid,
      clientId: p.cid,
      rol: p.rol,
      accessToken: tokenDe(p),
    });
  } catch (e) {
    console.error("[entrar] no se pudo crear la sesión", e);
    return NextResponse.json(
      { ok: false, error: "No se pudo iniciar la sesión. Inténtalo otra vez." },
      { status: 500 }
    );
  }

  const respuesta = NextResponse.json({
    ok: true,
    volver: "/dashboard",
  });

  /* Host-only a propósito: sin `domain`, esta cookie no viaja a ningún
     otro subdominio. Es lo que evita que un XSS en el panel (o en
     cualquier otro servicio) se lleve esta sesión. */
  respuesta.cookies.set(COOKIE_NAME, sesion.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 4 * 3600,
  });

  /* El access_token de Supabase viaja dentro del ticket, que va en el
     fragmento. Aun así se limpia el fragmento de la barra para que no
     se quede ahí si el usuario copia la URL. */
  respuesta.cookies.set("nexo_ticket_hused", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60,
  });

  return respuesta;
}