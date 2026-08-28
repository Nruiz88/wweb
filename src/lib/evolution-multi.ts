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
  options: RequestInit = {},
  timeoutMs = 5000,
): Promise<EvolutionResult<T>> {
  const headers = new Headers(options.headers);
  headers.set("apikey", apiKey);
  headers.set("Content-Type", "application/json");

  // Timeout por defecto 5s (evita colgar el request si Railway duerme).
  // Operaciones de grupos pueden ser MUCHO más lentas (issue EvolutionAPI#1883:
  // fetchAllGroups tarda 25s+) → se pasa un timeout mayor explícitamente.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      cache: "no-store",
      headers,
      signal: controller.signal,
    });

    const raw = await res.text();
    // Algunos endpoints responden 200/201 con body vacío o no-JSON → no debe
    // contarse como fallo (el mensaje ya se envió).
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }

    if (!res.ok) {
      const message =
        data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string"
          ? (data as { message: string }).message
          : `Evolution API respondió con estado ${res.status}`;
      return { ok: false, status: res.status, message };
    }

    return { ok: true, status: res.status, data: data as T };
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        ok: false,
        status: null,
        message: `Timeout: Evolution API no respondió en ${timeoutMs}ms`,
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

/**
 * Test that a base URL + API key reach an Evolution server.
 * Calls GET /instance/fetchInstances (no instance name) which returns a
 * 200 when the server is reachable and the key is valid.
 */
export async function testEvolutionConnection(
  baseUrl: string,
  apiKey: string,
): Promise<EvolutionResult<unknown>> {
  return evolutionRequest<unknown>(baseUrl, apiKey, `/instance/fetchInstances`);
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
  // Evolution v2: POST /instance/create con instanceName en el body.
  const v2 = await evolutionRequest<unknown>(
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

  // Evolution v1: POST /instance/create/{instanceName}.
  if (!v2.ok && (v2.status === 404 || v2.status === 405 || v2.status === 400)) {
    return evolutionRequest<unknown>(
      baseUrl,
      apiKey,
      `/instance/create/${encodeURIComponent(instanceName)}`,
      { method: "POST", body: JSON.stringify({}) }
    );
  }

  return v2;
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
    },
    15000,
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
    },
    15000,
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
    },
    15000,
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
    // OJO bug EvolutionAPI#2431: en algunas versiones `mentionsEveryOne:false`
    // igual menciona a todos → solo se envía el campo cuando es true.
    if (mentions.includes("everyone")) payload.mentionsEveryOne = true;
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
    },
    15000,
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
  /** Group profile picture URL (pps.whatsapp.net). */
  pictureUrl?: string;
}

/**
 * Get the JID of the WhatsApp user logged into the instance.
 * Used to determine if the bot is admin of a group.
 * GET /instance/fetchInstances?instanceName=... → owner / ownerJid.
 * Handles multiple response shapes across Evolution versions.
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
    {},
    20000,
  );
  if (!result.ok) return null;

  const data = result.data;
  if (Array.isArray(data)) {
    for (const entry of data) {
      if (!entry || typeof entry !== "object") continue;
      const obj = entry as Record<string, unknown>;
      const nested = obj.instance as Record<string, unknown> | undefined;
      const owner = String(
        nested?.owner ?? obj.owner ?? nested?.ownerJid ?? obj.ownerJid ?? "",
      ).trim();
      if (owner) return owner;
    }
    return null;
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const inst = (obj.instance ?? obj) as Record<string, unknown>;
    const owner = String(inst.owner ?? inst.ownerJid ?? obj.owner ?? "").trim();
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
 * Participantes de un grupo: v2.3.5+ puede devolver `participantsData`
 * (con números convertidos de LID) además del legacy `participants`.
 */
function participantsOf(g: Record<string, unknown>): Array<Record<string, unknown>> {
  if (Array.isArray(g.participants)) return g.participants as Array<Record<string, unknown>>;
  if (Array.isArray(g.participantsData)) return g.participantsData as Array<Record<string, unknown>>;
  return [];
}

/**
 * Matchea un participante contra un JID. El `id` del participante suele ser
 * LID (ej "55843265462454@lid") — un número totalmente distinto al real — así
 * que también se prueba el campo `phoneNumber` (v2.3.5+) que sí trae el
 * `@s.whatsapp.net` verdadero. Sin esto, el bot nunca matcheaba su propio
 * participante y jamás se lo detectaba como admin.
 */
function participantMatches(p: Record<string, unknown>, targetJid: string): boolean {
  const id = String(p.id ?? p.jid ?? "");
  const phone = String(p.phoneNumber ?? p.phone ?? "");
  return jidsMatch(id, targetJid) || (phone.length > 0 && jidsMatch(phone, targetJid));
}

/** Compare two WhatsApp JIDs ignoring the device/@lid suffix when possible. */
function jidsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const norm = (j: string) =>
    j.replace("@s.whatsapp.net", "").replace("@lid", "").replace("@g.us", "").replace(/\D/g, "");
  const na = norm(a);
  const nb = norm(b);
  return na.length > 5 && na === nb;
}

/**
 * Fetch details for a single group (reliable `subject` name).
 * GET /group/findGroupInfos/{instance}?groupJid=... → subject, participants.
 * Used when fetchAllGroups omits the subject for some groups.
 * botOwnerJid = JID del bot (owner de la instancia): se usa para detectar si
 * el bot es admin del grupo (participante con rol admin/superadmin que lo matchea).
 */
export async function findGroupInfos(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  groupJid: string,
  botOwnerJid?: string,
): Promise<EvolutionResult<EvolutionGroup>> {
  // getParticipants=true: por defecto findGroupInfos no trae participants
  // (issue EvolutionAPI#2124) y sin ellos no podemos saber si el bot es admin.
  const result = await evolutionRequest<Record<string, unknown>>(
    baseUrl,
    apiKey,
    `/group/findGroupInfos/${instanceName}?groupJid=${encodeURIComponent(groupJid)}&getParticipants=true`,
    {},
    20000,
  );
  if (!result.ok) return result;

  const g = result.data;
  const id = String(g.id ?? groupJid).trim();
  // El nombre real puede llegar en varios campos según la versión/estado.
  const name = String(
    g.name ?? g.subject ?? g.groupName ?? g.title ?? g.pushName ?? "",
  ).trim();
  const pictureUrl = String(g.pictureUrl ?? g.imageUrl ?? g.picUrl ?? "").trim() || undefined;

  let isAdmin: boolean | undefined;
  const participants = participantsOf(g);
  if (participants.length > 0) {
    const ownerField = String(g.owner ?? "").trim();
    const target = botOwnerJid
      ? participants.find((p) => participantMatches(p, botOwnerJid))
      : ownerField
        ? participants.find((p) => participantMatches(p, ownerField))
        : undefined;
    // Si encontramos el participante del bot: admin true/false definitivo.
    // Si NO se encontró (p.ej. participantes sin phoneNumber), isAdmin queda
    // undefined → "no se pudo determinar" → NO se debe persistir como falso.
    if (target) isAdmin = isParticipantAdmin(target);
  }

  return {
    ok: true,
    status: result.status,
    data: {
      id,
      name,
      isAdmin,
      communityId: typeof g.communityId === "string" ? g.communityId : undefined,
      isCommunity: g.isCommunity === true || undefined,
      pictureUrl,
    },
  };
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
  getParticipants = true,
): Promise<EvolutionResult<EvolutionGroup[]>> {
  // getParticipants=true puede tardar 25s+ (issue EvolutionAPI#1883): serializar
  // los participantes de TODOS los grupos es lo lento. Para listar nombres
  // rápido se llama sin participants y se refuerza admin por grupo con
  // findGroupInfos (un solo grupo, liviano).
  const result = await evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/group/fetchAllGroups/${instanceName}?getParticipants=${getParticipants ? "true" : "false"}`,
    {},
    20000,
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

    // El nombre real puede llegar en varios campos según la versión/estado
    // (bug EvolutionAPI#2124: a veces omiten `subject`).
    const name = String(
      g.name ?? g.subject ?? g.groupName ?? g.title ?? g.pushName ?? "",
    ).trim();

    // The bot is admin when a participant matching the instance owner JID
    // has an admin role. Without ownerJid we fall back to "any admin" only
    // when the group has exactly the bot (can't be determined reliably) — so
    // we keep it false unless we can match the owner.
    let isAdmin = false;
    const participants = participantsOf(g);
    if (participants.length > 0) {
      if (ownerJid) {
        const botParticipant = participants.find((p) => participantMatches(p, ownerJid));
        isAdmin = !!botParticipant && isParticipantAdmin(botParticipant);
      } else {
        // No owner JID available: Evolution only returns groups the bot belongs
        // to, so if exactly one participant is the bot admin candidate we can
        // still detect it via the `owner` field or single-admin groups.
        const ownerField = String(g.owner ?? "").trim();
        if (ownerField) {
          const ownerParticipant = participants.find((p) => participantMatches(p, ownerField));
          isAdmin = !!ownerParticipant && isParticipantAdmin(ownerParticipant);
        }
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

export interface EvolutionChat {
  remoteJid: string;
  name: string;
}

/** Concurrency limit helper: run `fn` over items with at most `limit` in flight. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

/**
 * Enumera los GRUPOS del bot vía POST /chat/findChats/{instance} — lee de la
 * DB local de Evolution, así que es RÁPIDO. fetchAllGroups es lentísimo
 * (25s+/timeout, issue #1883) incluso sin participants, así que discovery y
 * sync usan findChats para listar grupos y luego findGroupInfos por grupo.
 * Se prueban varias estrategias (sin params / take-skip / limit-offset) porque
 * el esquema de paginación varía según la versión, y se fusionan los grupos.
 */
export async function fetchAllChats(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<EvolutionResult<EvolutionChat[]>> {
  const groups = new Map<string, string>();

  const addList = (list: unknown[]) => {
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const c = item as Record<string, unknown>;
      const remoteJid = String(c.remoteJid ?? c.jid ?? "").trim();
      if (!remoteJid || !remoteJid.includes("@g.us")) continue; // solo grupos
      if (groups.has(remoteJid)) continue;
      const name = String(c.name ?? c.subject ?? c.groupName ?? "").trim();
      groups.set(remoteJid, name);
    }
  };

  const parseList = (data: unknown): unknown[] => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && Array.isArray((data as { chats?: unknown[] }).chats)) {
      return (data as { chats: unknown[] }).chats;
    }
    return [];
  };

  // Estrategia 1: sin params → todo en una llamada (si el server lo permite).
  const allResult = await evolutionRequest<unknown>(
    baseUrl,
    apiKey,
    `/chat/findChats/${instanceName}`,
    { method: "POST", body: JSON.stringify({}) },
    20000,
  );
  if (allResult.ok) {
    addList(parseList(allResult.data));
    if (groups.size > 0) {
      return { ok: true, status: 200, data: [...groups.entries()].map(([remoteJid, name]) => ({ remoteJid, name })) };
    }
  }

  // Estrategias 2 y 3: paginación (el esquema varía según la versión).
  for (const makeBody of [
    (skip: number) => ({ take: 500, skip }),
    (skip: number) => ({ limit: 500, offset: skip }),
  ]) {
    let skip = 0;
    for (let page = 0; page < 20; page++) {
      const result = await evolutionRequest<unknown>(
        baseUrl,
        apiKey,
        `/chat/findChats/${instanceName}`,
        { method: "POST", body: JSON.stringify(makeBody(skip)) },
        20000,
      );
      if (!result.ok) break;
      const list = parseList(result.data);
      if (list.length === 0) break;
      addList(list);
      if (list.length < 500) break;
      skip += 500;
    }
    if (groups.size > 0) break;
  }

  return { ok: true, status: 200, data: [...groups.entries()].map(([remoteJid, name]) => ({ remoteJid, name })) };
}
