const EVOLUTION_BASE_URL = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.INSTANCE_NAME;

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

export const EVOLUTION_ERROR_MISSING_ENV =
  "EVOLUTION_API_URL, EVOLUTION_API_KEY e INSTANCE_NAME deben estar definidos en .env.local";

function envError(): EvolutionError {
  return { ok: false, status: null, message: EVOLUTION_ERROR_MISSING_ENV };
}

async function evolutionRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<EvolutionResult<T>> {
  if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return envError();
  }

  const headers = new Headers(options.headers);
  headers.set("apikey", EVOLUTION_API_KEY);
  headers.set("Content-Type", "application/json");

  try {
    const res = await fetch(`${EVOLUTION_BASE_URL}${path}`, {
      ...options,
      cache: options.cache ?? "no-store",
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
          ? `Error de red hacia Evolution API: ${error.message}`
          : "Error de red hacia Evolution API",
    };
  }
}

export type ConnectionState = "open" | "close" | "connecting" | "qrcode" | string;

function parseConnectionState(value: unknown): ConnectionState | null {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as { instance?: { state?: unknown }; state?: unknown };
    const state = record.state ?? record.instance?.state;
    if (typeof state === "string") {
      return state;
    }
  }

  return null;
}

export async function getConnectionState(): Promise<EvolutionResult<ConnectionState>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const result = await evolutionRequest<unknown>(
    `/instance/connectionState/${EVOLUTION_INSTANCE}`
  );

  if (!result.ok) {
    return result;
  }

  const state = parseConnectionState(result.data);

  if (state === null) {
    return {
      ok: false,
      status: result.status,
      message: "Formato inesperado en la respuesta de connectionState",
    };
  }

  return { ok: true, status: result.status, data: state };
}

export interface QrData {
  base64?: string;
  b64?: string;
  code?: string;
}

export async function getQrCode(): Promise<EvolutionResult<QrData>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  return evolutionRequest<QrData>(
    `/instance/connect/${EVOLUTION_INSTANCE}?number=`
  );
}

export interface SendTextPayload {
  number: string;
  text: string;
  delay?: number;
}

export interface SendTextResult {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
  };
  message?: {
    id?: string;
  };
  status?: string;
}

export async function sendTextMessage(
  number: string,
  text: string,
  delay?: number
): Promise<EvolutionResult<SendTextResult>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const payload: SendTextPayload = { number, text };
  if (typeof delay === "number" && delay >= 0) {
    payload.delay = delay;
  }

  return evolutionRequest<SendTextResult>(`/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
