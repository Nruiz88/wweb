"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  LoaderIcon,
  MapPinIcon,
  MessageCircleIcon,
  RefreshIcon,
  ReplyIcon,
  SendIcon,
  SmileIcon,
  XIcon,
} from "@/components/icons";

interface ChatContact {
  jid: string;
  name: string;
  profilePicUrl?: string;
  lastMessage?: { text: string; at?: number | string };
}

interface ThreadMessage {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  text: string;
  type: string;
  timestamp?: number | string;
  quotedMessageId?: string;
}

type Presence = "" | "composing" | "recording";
type Feedback = { kind: "success" | "error"; message: string } | null;

const PRESENCE_OPTIONS: { value: Presence; label: string }[] = [
  { value: "", label: "Sin presencia" },
  { value: "composing", label: "Escribiendo" },
  { value: "recording", label: "Grabando audio" },
];

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const TYPE_LABELS: Record<string, string> = {
  conversation: "",
  extendedTextMessage: "",
  imageMessage: "Imagen",
  videoMessage: "Video",
  documentMessage: "Documento",
  documentWithCaptionMessage: "Documento",
  audioMessage: "Audio",
  stickerMessage: "Sticker",
  locationMessage: "Ubicación",
  contactsArrayMessage: "Contacto",
  reactionMessage: "Reacción",
  pttMessage: "Nota de voz",
};

const AVATAR_COLORS = [
  "bg-emerald-500/20 text-emerald-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
  "bg-amber-500/20 text-amber-300",
  "bg-rose-500/20 text-rose-300",
];

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]).join("").toUpperCase() || "?";
}

function avatarColor(name: string): string {
  const sum = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function formatTime(value?: number | string): string {
  if (!value) {
    return "";
  }
  const numeric = typeof value === "number" ? value * 1000 : Number(value);
  const date = new Date(Number.isNaN(numeric) ? value : numeric);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ConversationsPanel() {
  const [chats, setChats] = useState<ChatContact[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [text, setText] = useState("");
  const [presence, setPresence] = useState<Presence>("");
  const [quoted, setQuoted] = useState<{
    id: string;
    text: string;
    fromMe: boolean;
  } | null>(null);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [reactionInput, setReactionInput] = useState("");
  const [locationMode, setLocationMode] = useState(false);
  const [loc, setLoc] = useState({ lat: "", lng: "", name: "", address: "" });

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/chats", { cache: "no-store" });
      const payload = (await res.json()) as {
        status?: string;
        data?: { chats?: ChatContact[] } | null;
      };

      if (res.ok && payload.status === "success") {
        setChats(payload.data?.chats ?? []);
      }
    } catch {
      // El polling no debe romper la vista.
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadChats(), 0);
    const interval = setInterval(() => void loadChats(), 15000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadChats]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  async function openChat(jid: string) {
    setSelectedJid(jid);
    setQuoted(null);
    setReactingTo(null);
    setLocationMode(false);
    setFeedback(null);
    setThreadLoading(true);

    try {
      const res = await fetch("/api/whatsapp/chat-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remoteJid: jid, limit: 40 }),
      });

      const payload = (await res.json()) as {
        status?: string;
        error?: string | null;
        data?: { messages?: ThreadMessage[] } | null;
      };

      if (!res.ok || payload.status !== "success") {
        setFeedback({ kind: "error", message: payload.error ?? "No se pudo cargar la conversación." });
        return;
      }

      setThread(payload.data?.messages ?? []);
    } catch {
      setFeedback({ kind: "error", message: "Error de red al cargar la conversación." });
    } finally {
      setThreadLoading(false);
    }
  }

  async function handleSendText() {
    if (!selectedJid || !text.trim()) {
      return;
    }

    setBusy(true);
    setFeedback(null);

    try {
      const body: Record<string, unknown> = { number: selectedJid, text: text.trim() };
      if (presence) {
        body.presence = { type: presence, duration: 3000 };
      }
      if (quoted) {
        body.quoted = { id: quoted.id, text: quoted.text, remoteJid: selectedJid };
      }

      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json()) as { status?: string; error?: string | null };

      if (!res.ok || payload.status !== "success") {
        setFeedback({ kind: "error", message: payload.error ?? "No se pudo enviar el mensaje." });
        return;
      }

      setText("");
      setQuoted(null);
      setFeedback({ kind: "success", message: "Mensaje enviado." });
      await openChat(selectedJid);
    } catch {
      setFeedback({ kind: "error", message: "Error de red al enviar." });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendLocation() {
    if (!selectedJid) {
      return;
    }

    const lat = Number(loc.lat);
    const lng = Number(loc.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setFeedback({ kind: "error", message: "Ingresa latitud y longitud válidas." });
      return;
    }

    setBusy(true);
    setFeedback(null);

    try {
      const body: Record<string, unknown> = {
        number: selectedJid,
        latitude: lat,
        longitude: lng,
      };
      if (loc.name.trim()) body.name = loc.name.trim();
      if (loc.address.trim()) body.address = loc.address.trim();

      const res = await fetch("/api/whatsapp/send-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json()) as { status?: string; error?: string | null };

      if (!res.ok || payload.status !== "success") {
        setFeedback({ kind: "error", message: payload.error ?? "No se pudo enviar la ubicación." });
        return;
      }

      setLocationMode(false);
      setLoc({ lat: "", lng: "", name: "", address: "" });
      setFeedback({ kind: "success", message: "Ubicación enviada." });
      await openChat(selectedJid);
    } catch {
      setFeedback({ kind: "error", message: "Error de red al enviar la ubicación." });
    } finally {
      setBusy(false);
    }
  }

  async function handleReact(message: ThreadMessage, reaction: string) {
    setBusy(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/whatsapp/send-reaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remoteJid: message.remoteJid,
          messageId: message.id,
          fromMe: message.fromMe,
          reaction,
        }),
      });

      const payload = (await res.json()) as { status?: string; error?: string | null };

      if (!res.ok || payload.status !== "success") {
        setFeedback({ kind: "error", message: payload.error ?? "No se pudo reaccionar." });
        return;
      }

      setReactingTo(null);
      setReactionInput("");
      setFeedback({ kind: "success", message: "Reacción enviada." });
    } catch {
      setFeedback({ kind: "error", message: "Error de red al reaccionar." });
    } finally {
      setBusy(false);
    }
  }

  const selectedChat = selectedJid
    ? chats.find((chat) => chat.jid === selectedJid) ?? null
    : null;

  return (
    <div className="flex min-h-[28rem] flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-100">Conversaciones</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-300">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          historial real
        </span>
        {chatsLoading && (
          <LoaderIcon className="h-4 w-4 animate-spin text-slate-500" />
        )}
        <span className="ml-auto text-xs text-slate-500">{chats.length}</span>
        <button
          type="button"
          onClick={() => void loadChats()}
          disabled={chatsLoading}
          className="btn-base border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:text-slate-100"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="flex max-h-[30rem] flex-col gap-1.5 overflow-y-auto rounded-xl border border-white/5 bg-slate-950/40 p-2">
          {chats.length === 0 && !chatsLoading ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <MessageCircleIcon className="h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-400">Sin conversaciones</p>
              <p className="text-xs text-slate-600">
                Las conversaciones aparecerán cuando la sesión tenga actividad.
              </p>
            </div>
          ) : (
            chats.map((chat) => {
              const active = chat.jid === selectedJid;
              return (
                <button
                  key={chat.jid}
                  type="button"
                  onClick={() => void openChat(chat.jid)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    active
                      ? "bg-sky-500/15 text-slate-100 ring-1 ring-inset ring-sky-500/40"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarColor(
                      chat.name
                    )}`}
                  >
                    {initials(chat.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{chat.name}</span>
                      <span className="shrink-0 text-[10px] text-slate-500">
                        {formatTime(chat.lastMessage?.at)}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {chat.lastMessage?.text || "Sin mensajes"}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex min-h-[24rem] flex-col rounded-xl border border-white/5 bg-slate-950/40">
          {!selectedJid ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <MessageCircleIcon className="h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">Selecciona una conversación</p>
              <p className="max-w-xs text-xs text-slate-600">
                Responde con citas, reacciones, presencia, ubicación y más.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(
                    selectedChat?.name ?? selectedJid
                  )}`}
                >
                  {initials(selectedChat?.name ?? selectedJid)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {selectedChat?.name ?? "Conversación"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{selectedJid}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void openChat(selectedJid)}
                  disabled={threadLoading}
                  className="btn-base border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:text-slate-100"
                >
                  <RefreshIcon className={`h-3.5 w-3.5 ${threadLoading ? "animate-spin" : ""}`} />
                  Recargar
                </button>
              </div>

              <div className="flex max-h-72 flex-1 flex-col gap-2 overflow-y-auto p-4">
                {threadLoading ? (
                  <div className="flex flex-1 items-center justify-center">
                    <LoaderIcon className="h-6 w-6 animate-spin text-slate-500" />
                  </div>
                ) : thread.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">
                    Sin mensajes en esta conversación.
                  </p>
                ) : (
                  thread.map((message) => (
                    <div key={message.id} className="fade-up flex flex-col gap-1.5">
                      <div
                        className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`group relative max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                            message.fromMe
                              ? "rounded-br-md bg-sky-600/80 text-white"
                              : "rounded-bl-md bg-slate-800/80 text-slate-200"
                          }`}
                        >
                          {message.quotedMessageId && (
                            <span className="mb-1 flex items-center gap-1.5 text-[11px] opacity-80">
                              <ReplyIcon className="h-3 w-3" />
                              Mensaje citado
                            </span>
                          )}
                          {message.text ? (
                            <p>{message.text}</p>
                          ) : (
                            <p className="opacity-75">
                              {TYPE_LABELS[message.type] ?? message.type}
                            </p>
                          )}
                          <span className="mt-1 block text-right text-[10px] opacity-60">
                            {formatTime(message.timestamp)}
                          </span>

                          <div className="absolute -bottom-3 right-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              title="Responder"
                              onClick={() => {
                                setQuoted({ id: message.id, text: message.text, fromMe: message.fromMe });
                                setReactingTo(null);
                              }}
                              className="btn-base h-7 w-7 rounded-full border border-white/10 bg-slate-900 p-0 text-slate-300 hover:border-sky-500/50 hover:text-sky-300"
                            >
                              <ReplyIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Reaccionar"
                              onClick={() => setReactingTo(reactingTo === message.id ? null : message.id)}
                              className="btn-base h-7 w-7 rounded-full border border-white/10 bg-slate-900 p-0 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300"
                            >
                              <SmileIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {reactingTo === message.id && (
                        <div
                          className={`fade-up flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/80 p-2 ${
                            message.fromMe ? "self-end" : "self-start"
                          }`}
                        >
                          {REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => void handleReact(message, emoji)}
                              disabled={busy}
                              className="btn-base h-8 w-8 rounded-lg border border-white/5 bg-white/5 p-0 text-lg hover:bg-white/15"
                            >
                              {emoji}
                            </button>
                          ))}
                          <input
                            type="text"
                            placeholder="o escribe un emoji"
                            maxLength={8}
                            value={reactionInput}
                            onChange={(event) => setReactionInput(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && reactionInput.trim()) {
                                void handleReact(message, reactionInput.trim());
                              }
                            }}
                            className="h-8 w-28 rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-200 outline-none focus:border-sky-500/60"
                          />
                          <button
                            type="button"
                            onClick={() => void handleReact(message, reactionInput.trim())}
                            disabled={!reactionInput.trim() || busy}
                            className="btn-base h-8 rounded-lg bg-emerald-600 px-2.5 text-xs text-white hover:bg-emerald-500 disabled:opacity-40"
                          >
                            Enviar
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              <div className="flex flex-col gap-2 border-t border-white/5 p-3">
                {feedback && (
                  <p
                    role="status"
                    className={`fade-up flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                      feedback.kind === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/30 bg-red-500/10 text-red-300"
                    }`}
                  >
                    {feedback.kind === "success" ? (
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    {feedback.message}
                  </p>
                )}

                {quoted && (
                  <div className="fade-up flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                    <ReplyIcon className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                    <span className="min-w-0 flex-1 truncate text-xs text-sky-200">
                      {quoted.text ? `“${quoted.text}”` : "Mensaje citado"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuoted(null)}
                      className="btn-base h-6 w-6 rounded-full p-0 text-slate-300 hover:text-white"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {locationMode ? (
                  <div className="fade-up flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="Latitud"
                        value={loc.lat}
                        onChange={(event) => setLoc({ ...loc, lat: event.target.value })}
                        className="field-input"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Longitud"
                        value={loc.lng}
                        onChange={(event) => setLoc({ ...loc, lng: event.target.value })}
                        className="field-input"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nombre (opcional)"
                        value={loc.name}
                        onChange={(event) => setLoc({ ...loc, name: event.target.value })}
                        className="field-input"
                      />
                      <input
                        type="text"
                        placeholder="Dirección (opcional)"
                        value={loc.address}
                        onChange={(event) => setLoc({ ...loc, address: event.target.value })}
                        className="field-input"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSendLocation()}
                        disabled={busy}
                        className="btn-base flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-white shadow-lg shadow-emerald-500/25 hover:brightness-110"
                      >
                        {busy ? (
                          <LoaderIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <MapPinIcon className="h-4 w-4" />
                        )}
                        Enviar ubicación
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocationMode(false)}
                        className="btn-base border border-slate-700 bg-slate-900/60 px-3 text-slate-300 hover:border-slate-600"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end gap-2">
                      <textarea
                        rows={2}
                        placeholder="Escribe un mensaje…"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleSendText();
                          }
                        }}
                        className="field-input flex-1 resize-none"
                      />
                      <button
                        type="button"
                        title="Enviar ubicación"
                        onClick={() => setLocationMode(true)}
                        className={`btn-base h-10 w-10 shrink-0 rounded-xl border p-0 ${
                          locationMode
                            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                            : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-slate-100"
                        }`}
                      >
                        <MapPinIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSendText()}
                        disabled={busy || !text.trim()}
                        className="btn-base h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-0 text-white shadow-lg shadow-emerald-500/30 hover:brightness-110 disabled:opacity-40"
                      >
                        {busy ? (
                          <LoaderIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <SendIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="field-label">Presencia</span>
                        <select
                          value={presence}
                          onChange={(event) => setPresence(event.target.value as Presence)}
                          className="field-input w-40 py-1.5 text-xs"
                        >
                          {PRESENCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="text-[11px] text-slate-600">
                        Enter para enviar
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
