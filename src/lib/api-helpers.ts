import type { Sesion } from "./sesion";

/**
 * Utilidades compartidas de la API del panel del bot.
 *
 * QUÉ CAMBIÓ
 * ----------
 * Antes vivía aquí `verifyUserAccess(userId, instanceId)`, que hacía
 * dos consultas a MariaDB para comprobar si un usuario era el dueño de
 * una instancia o tenía asignada. Aparecía en 10 ficheros.
 *
 * Ahora no hace falta. El acceso lo decide RLS: las consultas del
 * panel del bot van con el cliente de Supabase del propio usuario
 * (`clienteDeLaSesion`), y las políticas de la migración 011 ya dicen
 * qué filas son suyas.
 *
 * POR QUÉ ES MEJOR, Y NO SOLO MÁS CÓMODO
 * --------------------------------------
 * `verifyUserAccess` era una comprobación que había que recordar poner.
 * Un endpoint nuevo que se olvidara de ella leía datos de otro cliente
 * sin quejarse: el fallo era silencioso y solo se veía si alguien lo
 * probaba a mano.
 *
 * Con RLS la comprobación no está en el código: está en la base, y se
 * aplica a TODAS las consultas, incluidas las que se olviden. Un
 * endpoint mal escrito devuelve cero filas, no las de otro.
 *
 * Lo que sí sigue haciendo falta es `exigeSesion()`: que haya alguien
 * detrás de la petición. Eso no lo decide RLS, porque un cliente sin
 * sesión no está "sin permiso", está "sin quién ser".
 */

/** Error tipado, para que las rutas puedan distinguir 401 de 403 de 500. */
export class ErrorDeApi extends Error {
  constructor(
    readonly estado: number,
    message: string
  ) {
    super(message);
    this.name = "ErrorDeApi";
  }
}

/**
 * Exige una sesión válida (y el módulo contratado).
 *
 * Lanza `ErrorDeApi(401)` si no hay sesión, para que cada ruta no
 * tenga que escribir el mismo if.
 */
export function exigeSesion(sesion: Sesion | null): Sesion {
  if (!sesion) {
    throw new ErrorDeApi(401, "No has iniciado sesión.");
  }
  return sesion;
}

/**
 * Mensaje de error seguro para el cliente.
 *
 * Traduce los errores de Postgres a algo que un usuario pueda entender,
 * y deja el detalle en el log del servidor.
 *
 * Antes miraba `err.code === "ER 3819"`, que es el código de MariaDB.
 * Con Postgres los códigos son distintos y, sobre todo, hay alguno que
 * NO conviene enseñar: por ejemplo `42501` (sin permiso) y `23P01`
 * (hueco de la agenda ocupado) son los dos casos que más se repiten, y
 * el segundo soltaba el nombre de la restricción al cliente.
 */
export function mensajeSeguro(error: unknown): string {
  const err = error as { code?: string; message?: string } | null;

  if (err) {
    // Se registra el error REAL en el servidor antes de ocultar nada.
    console.error("[api-error]", { code: err.code, message: err.message });

    switch (err.code) {
      case "23505": // unique_violation
        return "Ya existe algo con esos mismos datos.";
      case "23503": // foreign_key_violation
        return "No se puede guardar: hay datos que apuntan a este registro.";
      case "23514": // check_violation
        return "Los datos no pasan la validación. Revisa los campos.";
      case "23P01": // exclusion_violation — el hueco de la agenda
        return "Ese horario acaba de ocuparse. Elige otro.";
      case "42501": // insufficient_privilege
        return "No tienes permiso para hacer esto.";
      case "PGRST116": // exactly one row expected, got none
        return "No se encontró lo que buscabas.";
      default:
        break;
    }

    /* `SELECT * FROM "tabla"` no existe. Sale cuando falta una
       migración, y antes el mensaje era críptico (código 42P01 de
       Postgres). Merece la pena saying it claro: es un problema de
       despliegue, no del usuario. */
    if (err.message?.includes("does not exist")) {
      return "Falta una actualización del sistema. Avisa al equipo.";
    }
  }

  return "Ocurrió un error inesperado.";
}

/**
 * Envuelve un handler y devuelve JSON con el error adecuado.
 *
 * Así cada ruta es `return await api(handler)` y no tiene que repetirse
 * el try/catch ni decidir si un error es 401, 403 o 500.
 */
export async function api<T>(
  handler: () => Promise<T>,
  datos: { ok?: unknown } = {}
): Promise<Response> {
  try {
    const resultado = await handler();
    return Response.json({ ok: true, ...(datos.ok ?? {}), ...(resultado ?? {}) });
  } catch (e) {
    if (e instanceof ErrorDeApi) {
      return Response.json({ ok: false, error: e.message }, { status: e.estado });
    }
    return Response.json({ ok: false, error: mensajeSeguro(e) }, { status: 500 });
  }
}