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

export interface SendQuoted {
  id: string;
  text?: string;
  remoteJid?: string;
}

export interface SendTextPayload {
  number: string;
  text: string;
  delay?: number;
  quoted?: {
    key: { id: string; remoteJid?: string; fromMe?: boolean };
    message?: { conversation?: string };
  };
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
  delay?: number,
  quoted?: SendQuoted
): Promise<EvolutionResult<SendTextResult>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const payload: SendTextPayload = { number, text };
  if (typeof delay === "number" && delay >= 0) {
    payload.delay = delay;
  }
  if (quoted?.id) {
    payload.quoted = {
      key: {
        id: quoted.id,
        remoteJid: quoted.remoteJid,
        fromMe: false,
      },
      message: quoted.text
        ? { conversation: quoted.text }
        : undefined,
    };
  }

  return evolutionRequest<SendTextResult>(`/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type PresenceType = "composing" | "recording" | "paused";

export async function sendPresence(
  number: string,
  presence: PresenceType,
  delay?: number
): Promise<EvolutionResult<unknown>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const payload: { number: string; presence: PresenceType; delay?: number } = {
    number,
    presence,
  };
  if (typeof delay === "number" && delay >= 0) {
    payload.delay = delay;
  }

  return evolutionRequest<unknown>(`/chat/sendPresence/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoutInstance(): Promise<EvolutionResult<unknown>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  return evolutionRequest<unknown>(`/instance/logout/${EVOLUTION_INSTANCE}`, {
    method: "DELETE",
  });
}

export async function restartInstance(): Promise<EvolutionResult<unknown>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  return evolutionRequest<unknown>(`/instance/restart/${EVOLUTION_INSTANCE}`, {
    method: "POST",
  });
}

export type MediaType = "image" | "document" | "video" | "audio";

export interface SendMediaPayload {
  number: string;
  mediatype: MediaType;
  media: string;
  mimetype?: string;
  caption?: string;
  fileName?: string;
  delay?: number;
}

export interface SendMediaResult {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
  };
  status?: string;
}

export async function sendMediaMessage(
  payload: SendMediaPayload
): Promise<EvolutionResult<SendMediaResult>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  return evolutionRequest<SendMediaResult>(
    `/message/sendMedia/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function sendWhatsAppAudio(
  number: string,
  audio: string,
  delay?: number
): Promise<EvolutionResult<SendMediaResult>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const payload: { number: string; audio: string; delay?: number } = {
    number,
    audio,
  };
  if (typeof delay === "number" && delay >= 0) {
    payload.delay = delay;
  }

  return evolutionRequest<SendMediaResult>(
    `/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export interface OnWhatsAppDto {
  jid?: string;
  exists: boolean;
  number: string;
  name?: string;
  lid?: string;
}

export async function validateWhatsAppNumbers(
  numbers: string[]
): Promise<EvolutionResult<OnWhatsAppDto[]>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const result = await evolutionRequest<unknown>(
    `/chat/whatsappNumbers/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      body: JSON.stringify({ numbers }),
    }
  );

  if (!result.ok) {
    return result;
  }

  const items = Array.isArray(result.data) ? result.data : [];
  const normalized = items.filter(
    (item): item is OnWhatsAppDto =>
      typeof item === "object" && item !== null && "exists" in item
  );

  return { ok: true, status: result.status, data: normalized };
}

export interface WebhookEvent {
  enabled: boolean;
  url?: string;
  events?: string[];
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
}

export async function setInstanceWebhook(
  url: string,
  events: string[]
): Promise<EvolutionResult<unknown>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  return evolutionRequest<unknown>(`/webhook/set/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url,
        events,
        byEvents: false,
        base64: false,
      },
    }),
  });
}

export async function findInstanceWebhook(): Promise<EvolutionResult<WebhookEvent>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const result = await evolutionRequest<unknown>(
    `/webhook/find/${EVOLUTION_INSTANCE}`
  );

  if (!result.ok) {
    return result;
  }

  const record =
    typeof result.data === "object" && result.data !== null
      ? (result.data as Record<string, unknown>)
      : {};
  const webhook = record.webhook ?? result.data;

  if (typeof webhook === "object" && webhook !== null) {
    return { ok: true, status: result.status, data: webhook as unknown as WebhookEvent };
  }

  return { ok: true, status: result.status, data: { enabled: false } };
}

export interface ChatContact {
  jid: string;
  name: string;
  pushName?: string;
  profilePicUrl?: string;
  isSaved?: boolean;
  lastMessage?: {
    text: string;
    at?: number | string;
  };
}

function extractMessageText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }

  const record = message as Record<string, unknown>;
  const conversation = record.conversation;
  if (typeof conversation === "string") {
    return conversation;
  }

  const extended = record.extendedTextMessage as Record<string, unknown> | undefined;
  if (typeof extended?.text === "string") {
    return extended.text;
  }

  const mediaKeys = ["imageMessage", "videoMessage", "documentMessage", "audioMessage"];
  for (const key of mediaKeys) {
    const media = record[key] as Record<string, unknown> | undefined;
    if (typeof media?.caption === "string") {
      return media.caption;
    }
  }

  return "";
}

export async function findChats(): Promise<EvolutionResult<ChatContact[]>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const result = await evolutionRequest<unknown>(
    `/chat/findChats/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      body: JSON.stringify({ where: {}, sort: "desc", page: 1, offset: 50 }),
    }
  );

  if (!result.ok) {
    return result;
  }

  const items = Array.isArray(result.data)
    ? result.data
    : Array.isArray((result.data as { records?: unknown[] })?.records)
      ? (result.data as { records: unknown[] }).records
      : [];

  const chats: ChatContact[] = items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const jid =
        (typeof item.jid === "string" && item.jid) ||
        (typeof item.remoteJid === "string" && item.remoteJid) ||
        (typeof item.id === "string" && item.id) ||
        "";

      const name =
        (typeof item.name === "string" && item.name) ||
        (typeof item.pushName === "string" && item.pushName) ||
        (typeof item.profileName === "string" && item.profileName) ||
        jid.replace(/@.*$/, "") ||
        "Sin nombre";

      const lastMessage = item.lastMessage as Record<string, unknown> | null | undefined;
      const message = lastMessage?.message;
      const timestamp = lastMessage?.messageTimestamp;

      return {
        jid,
        name,
        pushName: typeof item.pushName === "string" ? item.pushName : undefined,
        isSaved: typeof item.isSaved === "boolean" ? item.isSaved : undefined,
        profilePicUrl:
          typeof item.profilePicUrl === "string" ? item.profilePicUrl : undefined,
        lastMessage: {
          text: extractMessageText(message),
          at: typeof timestamp === "string" || typeof timestamp === "number" ? timestamp : undefined,
        },
      };
    });

  return { ok: true, status: result.status, data: chats };
}

export async function findContacts(): Promise<EvolutionResult<ChatContact[]>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const result = await evolutionRequest<unknown>(
    `/chat/findContacts/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      body: JSON.stringify({ where: {} }),
    }
  );

  if (!result.ok) {
    return result;
  }

  const items = Array.isArray(result.data)
    ? result.data
    : Array.isArray((result.data as { records?: unknown[] })?.records)
      ? (result.data as { records: unknown[] }).records
      : [];

  const contacts: ChatContact[] = items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const jid =
        (typeof item.remoteJid === "string" && item.remoteJid) ||
        (typeof item.id === "string" && item.id) ||
        "";
      const pushName = typeof item.pushName === "string" ? item.pushName : "";

      return {
        jid,
        name: pushName || jid.replace(/@.*$/, "") || "Sin nombre",
        pushName: pushName || undefined,
        isSaved: typeof item.isSaved === "boolean" ? item.isSaved : undefined,
        profilePicUrl:
          typeof item.profilePicUrl === "string" ? item.profilePicUrl : undefined,
      };
    });

  return { ok: true, status: result.status, data: contacts };
}

export interface ThreadMessage {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  text: string;
  type: string;
  timestamp?: number | string;
  quotedMessageId?: string;
}

export async function findMessages(
  remoteJid: string,
  limit = 30
): Promise<EvolutionResult<ThreadMessage[]>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  const result = await evolutionRequest<unknown>(
    `/chat/findMessages/${EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      body: JSON.stringify({
        where: { key: { remoteJid } },
        limit,
        offset: 0,
      }),
    }
  );

  if (!result.ok) {
    return result;
  }

  const items = Array.isArray(result.data)
    ? result.data
    : Array.isArray((result.data as { messages?: unknown[] })?.messages)
      ? (result.data as { messages: unknown[] }).messages
      : Array.isArray((result.data as { records?: unknown[] })?.records)
        ? (result.data as { records: unknown[] }).records
        : [];

  const messages: ThreadMessage[] = items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const key = (item.key ?? {}) as Record<string, unknown>;
      const message = item.message as Record<string, unknown> | undefined;

      const id = (typeof key.id === "string" && key.id) || (typeof item.id === "string" && item.id) || "";
      const remote = (typeof key.remoteJid === "string" && key.remoteJid) || remoteJid;
      const fromMe = Boolean(key.fromMe ?? item.fromMe ?? false);

      const rawType = (typeof item.messageType === "string" && item.messageType) || "";
      const type = rawType || (message ? Object.keys(message).find((k) => k !== "contextInfo") ?? "unknown" : "unknown");

      const quotedMessageId = (() => {
        if (!message) return undefined;
        const typeValue = message[type] as Record<string, unknown> | undefined;
        const context = typeValue?.contextInfo as Record<string, unknown> | undefined;
        const stanzaId = context?.stanzaId;
        return typeof stanzaId === "string" ? stanzaId : undefined;
      })();

      const rawTimestamp = item.messageTimestamp;
      const timestamp =
        typeof rawTimestamp === "string" || typeof rawTimestamp === "number"
          ? rawTimestamp
          : undefined;

      return {
        id,
        remoteJid: remote,
        fromMe,
        text: extractMessageText(message),
        type,
        timestamp,
        quotedMessageId,
      };
    })
    .sort((a, b) => {
      const atA = typeof a.timestamp === "number" ? a.timestamp : 0;
      const atB = typeof b.timestamp === "number" ? b.timestamp : 0;
      return atA - atB;
    });

  return { ok: true, status: result.status, data: messages };
}

export async function sendReaction(
  remoteJid: string,
  messageId: string,
  fromMe: boolean,
  reaction: string
): Promise<EvolutionResult<unknown>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  return evolutionRequest<unknown>(`/message/sendReaction/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({
      key: { id: messageId, remoteJid, fromMe },
      reaction,
    }),
  });
}

export async function sendStickerMessage(
  number: string,
  sticker: string
): Promise<EvolutionResult<SendMediaResult>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  return evolutionRequest<SendMediaResult>(`/message/sendSticker/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify({ number, sticker }),
  });
}

export interface SendLocationPayload {
  number: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export async function sendLocationMessage(
  payload: SendLocationPayload
): Promise<EvolutionResult<SendMediaResult>> {
  if (!EVOLUTION_INSTANCE) {
    return envError();
  }

  return evolutionRequest<SendMediaResult>(`/message/sendLocation/${EVOLUTION_INSTANCE}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
