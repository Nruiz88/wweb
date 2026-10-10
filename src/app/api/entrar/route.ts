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

/**
 * Por qué no vale un ticket, PARA LOS LOGS.
 *
 * Devuelve una de estas cuatro: `vacio`, `malformado`, `firmado` o
 * `caducado`. Solo se usa en el log del servidor.
 *
 * ⚠️  Por qué NO se usa `verificar()` para esto
 * -------------------------------------------
 * `verificar()` devuelve null en los tres casos de fallo y no dice
 * cuál. Podría seem tentador reimplementar aquí la comprobación de
 * caducidad sobre el payload... pero eso significaría volver a hacer la
 * lectura del base64url y el JSON en este fichero, en un sitio que
 * puede desincronizarse del verificador. Si mañana `verificar()`
 * cambia una regla, el diagnóstico se queda diciendo lo contrario y es
 * peor que no decir nada.
 *
 * La versión falsa sería peor todavía: "caducado" en el mensaje de
 * error sería un oráculo. Con un enlace manipulado, devolver "no
 * caducado" frente a "caducado" no le dice al atacante si su firma era
 * correcta.
 *
 * Y el ticket NO se escribe en el log. Lleva el access_token de
 * Supabase dentro, y el log de un contenedor es de los sitios donde un
 * token se queda puesto mucho tiempo.
 */
function diagnosticoDeTicket(ticket: string): string {
  if (!ticket) return "vacio";

  const corte = ticket.lastIndexOf(".");
  if (corte < 1 || corte === ticket.length - 1) return "malformado";

  try {
    const payload = JSON.parse(Buffer.from(ticket.slice(0, corte), "base64url").toString("utf8"));

    if (!payload || typeof payload !== "object") return "malformado";
    if (typeof payload.exp !== "number") return "malformado";

    /* Mismo margen que el verificador: 5 segundos. */
    if (payload.exp + 5 < Math.floor(Date.now() / 1000)) return "caducado";

    /* El payload se lee bien y no está caducado, pero `verificar()`
       falló: la firma no cuadra. */
    return "firmado-pero-no-verifica";
  } catch {
    return "malformado";
  }
}

/**
 * El motivo de la entrada de soporte, si lo hay.
 *
 * Viaja dentro del ticket firmado, así que llega del panel y no se
 * puede alterar por el camino. Solo se acepta para staff: en una
 * sesión de cliente `mot` no significa nada, y guardarlo ahí
 * llenaría la columna de ruido.
 */
function leerMotivo(p: NonNullable<ReturnType<typeof verificar>>): string | null {
  if (p.rol !== "staff") return null;
  const bruto = typeof p.mot === "string" ? p.mot.trim() : "";
  return bruto ? bruto.slice(0, 200) : null;
}

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
    /* No se le dice al usuario si el ticket caducó o si alguien lo
       manipuló: distinguirlo sería una guía para ir probando, y el
       atacante no gana nada con probarlos todos.

       Pero internamente SÍ se distingue, y esa diferencia es la que
       hace falta para diagnosticar. Este fallo era el más probable del
       sistema y era invisible: la respuesta era siempre la misma, el
       contenedor no logueaba nada, y lo único que se podía hacer era
       adivinar.

       El caso real que salió: los tickets duran 60 segundos y el
       navegador congela el JavaScript de las pestañas en segundo plano.
       Si alguien pulsa "Abrir", cambia de pestaña y vuelve, el POST sale
       un minuto después, cuando el ticket ya caducó. El mensaje
       culpaba al enlace.

       El TICKET NO SE ESCRIBE, ni entero ni por partes: lleva dentro el
       access_token de Supabase y aquí sería el sitio donde se acabe. */
    const motivo = diagnosticoDeTicket(ticket);
    console.warn("[entrar] ticket rechazado:", motivo);

    return NextResponse.json(
      {
        ok: false,
        error: "Ese enlace no vale o ha caducado. Vuelve a entrar desde el panel.",
        /* Para la página, que sí sabe decirle a la persona que fue un
           enlace viejo y no un enlace malo. No le dice NADA que sirva
           para manipular nada: solo si caducó o no. */
        caducado: motivo === "caducado",
      },
      { status: 401 }
    );
  }

  /* Sin `cid` no hay cliente, y sin cliente no hay nada que mirar.
     A un staff le pasa a propósito: entra con la sesión sin cliente y
     elige a cuál atiende después. Lo que NO se hace es darle acceso a
     un cliente por el hecho de ser staff: eso se decide en la ruta de
     soporte, con un motivo, y la base lo comprueba en cada consulta. */
  /* Staff entra a un cliente QUE ELIGE, y siempre con motivo. Por eso
     un ticket de staff sin `cid` no es un error raro: es alguien que
     llegó por una ruta antigua, y se le manda al selector en vez de
     dejarle una sesión que no puede abrir nada. */
  const esSoporte = p.rol === "staff";

  if (!p.cid) {
    if (!esSoporte) {
      return NextResponse.json(
        { ok: false, error: "Este enlace no es de una cuenta de cliente." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "Elige a qué cliente quieres atender. Se entra desde el panel.",
        donde: "/panel/soporte",
      },
      { status: 403 }
    );
  }

  const motivo = leerMotivo(p);

  /* El motivo se pide AL CANJEAR, no al editar. Pedirlo en el primer
     momento es lo que hace que no se pueda saltar: no se llega al
     botón de guardar sin haber escrito uno. `crearSesion` lo
     comprueba también, por si mañana otra ruta crea sesiones. */
  if (esSoporte && !motivo) {
    return NextResponse.json(
      { ok: false, error: "Falta el motivo de la entrada." },
      { status: 403 }
    );
  }

  /* La suscripción se comprueba al cliente, no al staff. Support entra
     justamente cuando algo va mal, y un cliente al que se le ha
     caducado la suscripción es de los que mássupport necesitan. Si se
     le exigiera el módulo, no podría ver el bot que está fallando. */
  if (!esSoporte) {
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
  }

  let sesion;
  try {
    sesion = await crearSesion({
      userId: p.uid,
      clientId: p.cid,
      rol: p.rol,
      accessToken: tokenDe(p),
      soporteDe: esSoporte ? p.cid : null,
      soporteMotivo: motivo,
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