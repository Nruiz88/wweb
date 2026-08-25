export interface StoredMessage {
  id: string;
  from: string;
  pushName: string;
  text: string;
  type: string;
  at: string;
}

const MAX_MESSAGES = 50;
const store: StoredMessage[] = [];

export function addMessage(message: StoredMessage): void {
  const duplicate = store.some((item) => item.id === message.id);
  if (duplicate) {
    return;
  }

  store.unshift(message);

  if (store.length > MAX_MESSAGES) {
    store.length = MAX_MESSAGES;
  }
}

export function listMessages(): StoredMessage[] {
  return [...store];
}

export function clearMessages(): void {
  store.length = 0;
}

interface EvolutionWebhookPayload {
  event?: string;
  instance?: string;
  data?: Record<string, unknown>;
  date_time?: string;
}

interface WebhookMessage {
  key?: {
    remoteJid?: string;
    fromMe?: boolean;
    id?: string;
  };
  pushName?: string;
  message?: Record<string, unknown> & {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { caption?: string };
    audioMessage?: Record<string, unknown>;
  };
  messageType?: string;
  messageTimestamp?: number | string;
  sender?: Record<string, unknown>;
}

function isMessageUpsert(payload: EvolutionWebhookPayload): boolean {
  const event = payload.event?.toUpperCase().replace(/[.-]/g, "_") ?? "";
  return event === "MESSAGES_UPSERT";
}

function extractText(message: WebhookMessage["message"]): string {
  if (!message) {
    return "";
  }

  if (typeof message.conversation === "string") {
    return message.conversation;
  }

  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text;
  }

  return (
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    ""
  );
}

export function parseWebhookMessage(payload: unknown): StoredMessage | null {
  const body = (payload ?? {}) as EvolutionWebhookPayload;

  if (!isMessageUpsert(body)) {
    return null;
  }

  const message = (body.data ?? {}) as WebhookMessage;
  const key = message.key ?? {};

  if (key.fromMe) {
    return null;
  }

  const remoteJid = key.remoteJid ?? "desconocido";
  const id = key.id ?? `${Date.now()}-${remoteJid}`;

  return {
    id,
    from: remoteJid.replace(/@s\.whatsapp\.net$/, ""),
    pushName: message.pushName ?? "Desconocido",
    text: extractText(message.message),
    type: message.messageType ?? "mensaje",
    at: body.date_time ?? new Date().toISOString(),
  };
}
