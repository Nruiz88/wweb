"use client";

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

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString();
}

export function MessagesPanel({ messages, loading }: MessagesPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Mensajes recibidos</h2>
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-slate-200" />
        )}
        <span className="ml-auto text-xs text-slate-500">
          {messages.length} en memoria
        </span>
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-4 py-8 text-center">
          <p className="text-sm text-slate-400">Aún no hay mensajes recibidos.</p>
          <p className="text-xs text-slate-500">
            Configura el webhook y envía un mensaje a tu número para verlo aquí en
            tiempo real.
          </p>
        </div>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
          {messages.map((message) => (
            <li
              key={message.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-200">
                  {message.pushName || "Desconocido"}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {message.from}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {formatTime(message.at)}
                </span>
              </div>
              {message.text ? (
                <p className="mt-1 text-sm text-slate-300">{message.text}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  {TYPE_LABELS[message.type] ?? message.type}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
