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

  // Timeout de 5s: evita colgar el request si Railway duerme o no responde
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      cache: "no-store",
      headers,
      signal: controller.signal,
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
    if (controller.signal.aborted) {
      return {
        ok: false,
        status: null,
        message: "Timeout: Evolution API no respondió en 5s",
      };
    }
    return {
      ok: false,
      status: null,
      message:
        error instanceof Error
          ? `Error de red: ${error.message}`
          : "Error de red hacia Evolution API",
    };
  } finally {
    clearTimeout(timeout);
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
    { method: "PUT" }
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
    `/instance/create`,
    {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    }
  );
}

export async function setWebhook(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  webhookUrl: string,
  events: string[],
  headers?: Record<string, string>
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
          headers: headers ?? {},
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

/** Button definition for interactive messages (Evolution v2 format). */
export interface ButtonItem {
  type: "reply";
  displayText: string;
  id: string;
}

/** Send an interactive button message (up to 3 reply buttons). */
export async function sendButtonMessage(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  number: string,
  title: string,
  description: string,
  buttons: ButtonItem[],
  footer?: string,
  delay?: number
): Promise<EvolutionResult<SendTextResult>> {
  const payload: Record<string, unknown> = {
    number,
    title,
    description,
    footer: footer ?? "",
    buttons: buttons.map((b) => ({
      type: b.type,
      displayText: b.displayText,
      id: b.id,
    })),
  };
  if (typeof delay === "number" && delay >= 0) {
    payload.delay = delay;
  }

  return evolutionRequest<SendTextResult>(
    baseUrl,
    apiKey,
    `/message/sendButtons/${instanceName}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

/** Send an interactive list message (sections with rows). */
export async function sendListMessage(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  number: string,
  title: string,
  description: string,
  buttonText: string,
  sections: { title: string; rows: { title: string; description?: string; rowId: string }[] }[],
  footer?: string,
  delay?: number
): Promise<EvolutionResult<SendTextResult>> {
  const payload: Record<string, unknown> = {
    number,
    title,
    description,
    buttonText,
    footerText: footer ?? "",
    sections,
  };
  if (typeof delay === "number" && delay >= 0) {
    payload.delay = delay;
  }

  return evolutionRequest<SendTextResult>(
    baseUrl,
    apiKey,
    `/message/sendList/${instanceName}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

/** Delete a message for everyone in a chat (group or DM). */
export async function deleteMessage(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  messageId: string,
  remoteJid: string,
  fromMe: boolean = false,
  participant?: string,
): Promise<EvolutionResult<unknown>> {
  const payload: Record<string, unknown> = {
    id: messageId,
    remoteJid,
    fromMe,
  };
  // Required for group messages: the JID of the participant who sent it.
  if (participant) payload.participant = participant;

  return evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/chat/deleteMessageForEveryone/${instanceName}`,
    {
      method: "DELETE",
      body: JSON.stringify(payload),
    }
  );
}

/** Send a text message to a group. */
export async function sendGroupMessage(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  groupJid: string,
  text: string,
  mentions?: string[],
  delay?: number,
): Promise<EvolutionResult<SendTextResult>> {
  const payload: Record<string, unknown> = {
    number: groupJid,
    text,
  };
  if (mentions && mentions.length > 0) {
    payload.mentionsEveryOne = mentions.includes("everyone");
    payload.mentioned = mentions.filter((m) => m !== "everyone");
  }
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

/** A group as returned by Evolution's fetchAllGroups. */
export interface EvolutionGroup {
  id: string;
  name: string;
  /** True if the bot (instance owner) is admin of the group. */
  isAdmin?: boolean;
  /** Community id (when the group belongs to a community). */
  communityId?: string;
  /** True if this group is a community announcement group. */
  isCommunity?: boolean;
}

/**
 * Get the JID of the WhatsApp user logged into the instance.
 * Used to determine if the bot is admin of a group.
 * GET /instance/fetchInstances?instanceName=... → owner / ownerJid.
 */
export async function fetchInstanceOwnerJid(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<string | null> {
  const result = await evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
  );
  if (!result.ok) return null;

  const data = result.data;
  if (Array.isArray(data)) {
    const inst = data[0] as Record<string, unknown> | undefined;
    if (!inst) return null;
    const nested = inst.instance as Record<string, unknown> | undefined;
    const owner = String(nested?.owner ?? inst.owner ?? nested?.ownerJid ?? inst.ownerJid ?? "");
    return owner || null;
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const inst = (obj.instance ?? obj) as Record<string, unknown>;
    const owner = String(inst.owner ?? inst.ownerJid ?? obj.owner ?? "");
    return owner || null;
  }
  return null;
}

/** True if a participant entry is an admin of the group. */
function isParticipantAdmin(p: Record<string, unknown>): boolean {
  const admin = p.admin;
  if (typeof admin === "string") {
    const role = admin.toLowerCase();
    return role === "admin" || role === "superadmin";
  }
  if (typeof admin === "boolean") return admin;
  return p.isAdmin === true || p.isSuperAdmin === true;
}

/**
 * Fetch all groups the bot is in for an instance.
 * Requires getParticipants=true so we can tell if the bot is admin.
 * Response shape varies across Evolution versions, so we normalize:
 *   - Array of { id, name, subject, participants, ... }
 *   - { groups: [...] }
 *   - Array of strings (JIDs only)
 */
export async function fetchAllGroups(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  ownerJid?: string,
): Promise<EvolutionResult<EvolutionGroup[]>> {
  const result = await evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/group/fetchAllGroups/${instanceName}?getParticipants=true`,
  );

  if (!result.ok) return result;

  const raw = result.data as
    | EvolutionGroup[]
    | { groups?: EvolutionGroup[] }
    | string[]
    | null;

  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object" && Array.isArray((raw as { groups?: unknown[] }).groups)) {
    list = (raw as { groups: unknown[] }).groups;
  }

  const groups: EvolutionGroup[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      groups.push({ id: item, name: "" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const g = item as Record<string, unknown>;
    const id = String(g.id ?? g.jid ?? g.remoteJid ?? "").trim();
    if (!id) continue;

    const name = String(g.name ?? g.subject ?? "").trim();

    // The bot is admin when a participant matching the instance owner JID
    // has an admin role. Without ownerJid we can't confirm — mark as non-admin.
    let isAdmin = false;
    if (Array.isArray(g.participants)) {
      const participants = g.participants as Array<Record<string, unknown>>;
      if (ownerJid) {
        const botParticipant = participants.find((p) => {
          const pid = String(p.id ?? p.jid ?? "");
          return pid === ownerJid || pid === ownerJid.replace("@s.whatsapp.net", "@lid");
        });
        isAdmin = !!botParticipant && isParticipantAdmin(botParticipant);
      } else if (participants.length === 0) {
        isAdmin = false;
      } else if (participants.some((p) => isParticipantAdmin(p))) {
        // Legacy versions may not expose the owner JID; keep it undefined so the
        // caller can decide (filtering strict requires ownerJid).
        isAdmin = false;
      }
    }

    groups.push({
      id,
      name,
      isAdmin: isAdmin || undefined,
      communityId: typeof g.communityId === "string" ? g.communityId : undefined,
      isCommunity: g.isCommunity === true || undefined,
    });
  }

  return { ok: true, status: result.status, data: groups };
}
