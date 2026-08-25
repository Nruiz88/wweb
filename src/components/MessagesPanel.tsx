"use client";

import { InboxIcon } from "@/components/icons";

export interface MessageItem {
  id: string;
  from: string;
  pushName: string;
  text: string;
  type: string;
  at: string;
}

interface MessagesPanelProps {
  messages: MessageItem[];
  loading?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  conversation: "Texto",
  extendedTextMessage: "Texto",
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

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]).join("").toUpperCase() || "?";
}

function avatarColor(name: string): string {
  const sum = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function MessagesPanel({ messages, loading }: MessagesPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-100">Mensajes recibidos</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          en vivo
        </span>
        {loading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-slate-200" />
        )}
        <span className="ml-auto text-xs text-slate-500">
          {messages.length}
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 px-4 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/60 text-slate-500">
            <InboxIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-300">Aún no hay mensajes recibidos</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Configura el webhook y envía un mensaje a tu número para verlo aquí en
              tiempo real.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
          {messages.map((message) => (
            <li
              key={message.id}
              className="fade-up group flex gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 transition hover:border-slate-700 hover:bg-slate-900/70"
            >
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor(
                  message.pushName || message.from
                )}`}
              >
                {initials(message.pushName || message.from)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-200">
                    {message.pushName || "Desconocido"}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {message.from}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {formatTime(message.at)}
                  </span>
                </div>

                {message.text ? (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-300">
                    {message.text}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    {TYPE_LABELS[message.type] ?? message.type}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
