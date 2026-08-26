/**
 * Multi-tenant Evolution API helper.
 * Each instance has its own URL and API key stored in the database.
 */

export interface EvolutionError {
  ok: false;
  status: number | null;
  message: string;
}

export interface EvolutionSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export type EvolutionResult<T> = EvolutionSuccess<T> | EvolutionError;

async function evolutionRequest<T>(
  baseUrl: string,
  apiKey: string,
  path: string,
  options: RequestInit = {}
): Promise<EvolutionResult<T>> {
  const headers = new Headers(options.headers);
  headers.set("apikey", apiKey);
  headers.set("Content-Type", "application/json");

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      cache: "no-store",
      headers,
    });

    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!res.ok) {
      const message =
        data && typeof data.message === "string"
          ? data.message
          : `Evolution API respondió con estado ${res.status}`;
      return { ok: false, status: res.status, message };
    }

    return { ok: true, status: res.status, data: data as T };
  } catch (error) {
    return {
      ok: false,
      status: null,
      message:
        error instanceof Error
          ? `Error de red: ${error.message}`
          : "Error de red hacia Evolution API",
    };
  }
}

export interface QrData {
  base64?: string;
  b64?: string;
  code?: string;
  pairingCode?: string;
}

export async function connectInstance(
  baseUrl: string,
  apiKey: string,
  instanceName: string
): Promise<EvolutionResult<QrData>> {
  return evolutionRequest<QrData>(
    baseUrl,
    apiKey,
    `/instance/connect/${instanceName}?number=`
  );
}

export type ConnectionState =
  | "open"
  | "close"
  | "connecting"
  | "qrcode"
  | "unknown";

export async function getConnectionState(
  baseUrl: string,
  apiKey: string,
  instanceName: string
): Promise<EvolutionResult<ConnectionState>> {
  const result = await evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/instance/connectionState/${instanceName}`
  );

  if (!result.ok) return result;

  // Parse the state from various formats
  const data = result.data;
  let state: string | null = null;

  if (typeof data === "string") {
    state = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    state =
      (typeof obj.state === "string" && obj.state) ||
      (typeof obj.instance === "object" &&
        obj.instance !== null &&
        typeof (obj.instance as Record<string, unknown>).state === "string" &&
        (obj.instance as Record<string, unknown>).state as string) ||
      null;
  }

  return {
    ok: true,
    status: result.status,
    data: (state as ConnectionState) || "unknown",
  };
}

export async function logoutInstance(
  baseUrl: string,
  apiKey: string,
  instanceName: string
): Promise<EvolutionResult<unknown>> {
  return evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/instance/logout/${instanceName}`,
    { method: "DELETE" }
  );
}

export async function restartInstance(
  baseUrl: string,
  apiKey: string,
  instanceName: string
): Promise<EvolutionResult<unknown>> {
  return evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/instance/restart/${instanceName}`,
    { method: "POST" }
  );
}

export async function createInstance(
  baseUrl: string,
  apiKey: string,
  instanceName: string
): Promise<EvolutionResult<unknown>> {
  return evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/instance/create/${instanceName}`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function setWebhook(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  webhookUrl: string,
  events: string[]
): Promise<EvolutionResult<unknown>> {
  return evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/webhook/set/${instanceName}`,
    {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          events,
          byEvents: false,
          base64: false,
        },
      }),
    }
  );
}

export interface SendTextResult {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  message?: { id?: string };
  status?: string;
}

export async function sendTextMessage(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  number: string,
  text: string,
  delay?: number
): Promise<EvolutionResult<SendTextResult>> {
  const payload: Record<string, unknown> = { number, text };
  if (typeof delay === "number" && delay >= 0) {
    payload.delay = delay;
  }

  return evolutionRequest<SendTextResult>(
    baseUrl,
    apiKey,
    `/message/sendText/${instanceName}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}
