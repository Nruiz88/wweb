import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, type Sesion } from "@/lib/sesion";
import { getAdmin } from "@/lib/db";
import { rateLimitResponse } from "@/lib/rate-limit";
import {
  connectInstance,
  createInstance,
  getConnectionState,
  logoutInstance,
  setWebhook,
} from "@/lib/evolution-multi";

export const dynamic = "force-dynamic";

const qrCache = new Map<string, { base64: string; at: number }>();
const QR_TTL_MS = 20000;
const recentLogout = new Map<string, number>();
const LOGOUT_GRACE_MS = 15000;

/** Valores permitidos por el CHECK de `instances.status`. */
const INSTANCE_STATUSES = new Set(["open", "close", "connecting", "qrcode"]);

async function prepareInstance(baseUrl: string, apiKey: string, instanceName: string, webhookUrl: string) {
  await createInstance(baseUrl, apiKey, instanceName);
  const secret = process.env.WEBHOOK_SECRET;
  const result = await setWebhook(baseUrl, apiKey, instanceName, webhookUrl, ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"], secret ? { "x-webhook-secret": secret } : {});
  if (!result.ok && result.status === 401) {
    return;
  }
}

function buildWebhookUrl(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host.includes("localhost") || host.startsWith("127.") || host.startsWith("192.168.")) {
    return "";
  }
  return `${proto}://${host}/api/webhook`;
}

function cacheKey(baseUrl: string, instanceName: string): string {
  return `${baseUrl}|${instanceName}`;
}

interface ResolvedInstance {
  id: string;
  instance_name: string;
  evolution_api_url: string;
  evolution_api_key: string;
  status?: string;
}

/**
/**
 * El bot del cliente que está preguntando, con la conexión de su servidor.
 *
 * ANTES esta función tenía tres ramas: instancias propias por
 * `instances.admin_id`, y luego `user_instances` para las asignadas. Existía
 * porque un usuario podía tener unas y otras, y había que decidir cuál
 * manipulaba —con un comentario larguísimo sobre el riesgo de que
 * `DELETE /api/whatsapp` deslogueara el WhatsApp de otra persona.
 *
 * AHORA hay un bot por cliente. El bot sale de la sesión (con RLS, así que
 * no puede ser el de otro) y su conexión se resuelve con un JOIN a
 * `evolution_servers`, que es donde viven la url y la clave.
 *
 * La clave se trae a memoria para hablar con Evolution, pero NUNCA se
 * devuelve al cliente: la respuesta de esta ruta no la incluye.
 */
async function resolverBot(sesion: Sesion): Promise<ResolvedInstance | null> {
  const bot = await botDeLaSesion(sesion);
  if (!bot) return null;

  /* La conexión va por la secret key: `evolution_servers` no tiene
     políticas RLS a propósito, para que un cliente no pueda leer la clave
     compartida del servidor. Aquí solo la usa el servidor. */
  const { data } = await getAdmin()
    .from("bots")
    .select("instance_name, status, evolution_servers:server_id(url, api_key)")
    .eq("id", bot.id)
    .maybeSingle();

  if (!data) return null;

  /* El JOIN viene como objeto (many-to-one) o como array si PostgREST no
     conoce la cardinalidad. Con un tipo explícito se ve de un vistazo. */
  type Nodo = { url: string; api_key: string };
  const unido = data as unknown as {
    evolution_servers: Nodo | Nodo[] | null;
  };
  const nodo = Array.isArray(unido.evolution_servers)
    ? unido.evolution_servers[0]
    : unido.evolution_servers;

  if (!nodo) return null;

  return {
    id: bot.id,
    instance_name: data.instance_name,
    evolution_api_url: nodo.url,
    evolution_api_key: nodo.api_key,
    status: data.status,
  };
}

/* Antes esto devolvía un userId y las rutas lo pasaban a
   resolveInstance, que iba a la tabla. Ahora se pasa la sesión entera,
   que es lo que necesita botDeLaSesion para resolver el bot con RLS. */
async function sesionActiva(): Promise<Sesion | null> {
  return getSession();
}

// GET: estado de la conexión y QR
export async function GET(request: Request) {
  const webhookUrl = buildWebhookUrl(request);
  const sesion = await sesionActiva();
  if (!sesion) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  // El selector de /whatsapp manda ?instanceId=, pero la ruta lo ignoraba y
  // siempre operaba sobre la más reciente (ORDER BY created_at DESC LIMIT 1).
  /* Ya no se elige instancia: hay una por cliente. El ?instanceId= que mandaba
     el selector de /whatsapp se ignora a propósito. */
  const instance = await resolverBot(sesion);
  if (!instance) {
    return NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 });
  }

  const stateResult = await getConnectionState(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name);
  let currentState = instance.status;
  if (stateResult.ok) {
    const key = cacheKey(instance.evolution_api_url, instance.instance_name);
    const justLoggedOut = recentLogout.has(key) && Date.now() - (recentLogout.get(key) ?? 0) < LOGOUT_GRACE_MS;
    if (justLoggedOut && stateResult.data === "open" && instance.status === "close") {
      currentState = "close";
    } else {
      currentState = stateResult.data;
      // `instances.status` tiene CHECK (open, close, connecting, qrcode).
      // `getConnectionState` devuelve "unknown" (o cualquier string crudo de
      // Evolution) cuando no parsea el estado → el UPDATE violaba el CHECK,
      // reventaba sin catch y el polling del QR devolvía 500.
      const persistable = INSTANCE_STATUSES.has(stateResult.data) ? stateResult.data : "connecting";
      await getAdmin().from("bots").update({ status: persistable }).eq("id", instance.id);
    }
    if (justLoggedOut && Date.now() - (recentLogout.get(key) ?? 0) >= LOGOUT_GRACE_MS) {
      recentLogout.delete(key);
    }
  }

  let qrCode: string | null = null;
  if (currentState === "close" || currentState === "qrcode" || currentState === "connecting") {
    const key = cacheKey(instance.evolution_api_url, instance.instance_name);
    const cached = qrCache.get(key);
    if (cached && Date.now() - cached.at < QR_TTL_MS) {
      qrCode = cached.base64;
    } else {
      if (webhookUrl) {
        await prepareInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name, webhookUrl);
      }
      const qrResult = await connectInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name);
      if (qrResult.ok && qrResult.data) {
        qrCode = qrResult.data.base64 || qrResult.data.b64 || null;
        if (qrCode && !qrCode.startsWith("data:")) {
          qrCode = `data:image/png;base64,${qrCode}`;
        }
        if (qrCode) {
          qrCache.set(key, { base64: qrCode, at: Date.now() });
        }
      }
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      instanceId: instance.id,
      /* `instanceName` ya NO se manda al navegador.

         Es el nombre con el que Evolution guarda el número. Se necesita
         aquí (para conectar y para enviar) pero no en el cliente: no se
         pinta, no se decide nada con él, y estar en la respuesta lo
         dejaba en el HTML y en el historial del navegador.

         `instanceId` sí se manda, y es el id de la fila de `bots`: no
         da acceso a nada por sí solo, porque todas las rutas lo
         comprueban contra la sesión antes de usarlo. */
      connectionState: currentState,
      qrCode,
    },
  });
}

// POST: Connect instance (get QR)
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "whatsapp-connect", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const webhookUrl = buildWebhookUrl(request);
  const sesion = await sesionActiva();
  if (!sesion) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  /* Conectar o forzar el QR modifica el estado del WhatsApp. Antes solo
     podía hacerlo el dueño de la instancia (`instances.admin_id`), y por
     eso existía el parámetro `ownerOnly`. Ahora el bot sale de la
     sesión con RLS, así que no hay nadie más a quien dejar pasar. */
  const instance = await resolverBot(sesion);
  if (!instance) {
    return NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 });
  }

  if (webhookUrl) {
    await prepareInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name, webhookUrl);
  }

  const result = await connectInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name);
  if (!result.ok) {
    return NextResponse.json({ status: "error", error: result.message }, { status: 500 });
  }

  await getAdmin().from("bots").update({ status: "qrcode" }).eq("id", instance.id);

  let qrCode = result.data?.base64 || result.data?.b64 || null;
  if (qrCode && !qrCode.startsWith("data:")) {
    qrCode = `data:image/png;base64,${qrCode}`;
  }
  if (qrCode) {
    qrCache.set(cacheKey(instance.evolution_api_url, instance.instance_name), { base64: qrCode, at: Date.now() });
  }

  return NextResponse.json({ status: "success", data: { qrCode } });
}

// DELETE: Logout instance
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "whatsapp-logout", { maxRequests: 20, windowMs: 60_000 });
  if (rateLimitErr) return rateLimitErr;

  const sesion = await sesionActiva();
  if (!sesion) {
    return NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
  }

  /* Desloguear deja sin WhatsApp a la persona. Antes un usuario merelyamente
     ASIGNADO podía desloguear la instancia del owner, y por eso existía
     `ownerOnly`. Ahora el bot sale de la sesión con RLS: solo se toca el
     propio. */
  const instance = await resolverBot(sesion);
  if (!instance) {
    return NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 });
  }

  const result = await logoutInstance(instance.evolution_api_url, instance.evolution_api_key, instance.instance_name);

  // Always mark as disconnected locally
  await getAdmin().from("bots").update({ status: "close" }).eq("id", instance.id);

  const key = cacheKey(instance.evolution_api_url, instance.instance_name);
  qrCache.delete(key);
  recentLogout.set(key, Date.now());

  if (!result.ok) {
    console.warn("[whatsapp] logout Evolution falló pero se marcó close", { instance: instance.instance_name, status: result.status, message: result.message });
  }

  return NextResponse.json({ status: "success" });
}
