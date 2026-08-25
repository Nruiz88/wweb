"use client";

import { useRef, useState } from "react";

type MediaKind = "image" | "document" | "video" | "audio" | "ptt";
type Feedback = { kind: "success" | "error"; message: string } | null;

const KIND_LABELS: Record<MediaKind, string> = {
  image: "Imagen",
  document: "Documento / PDF",
  video: "Video",
  audio: "Audio",
  ptt: "Nota de voz (PTT)",
};

const MEDIA_KINDS = Object.entries(KIND_LABELS) as [MediaKind, string][];

function dataUrlToBase64(dataUrl: string): string {
  const index = dataUrl.indexOf(",");
  return index >= 0 ? dataUrl.slice(index + 1) : dataUrl;
}

export function MediaMessageForm() {
  const [number, setNumber] = useState("");
  const [kind, setKind] = useState<MediaKind>("image");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readFileAsDataUrl(target: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(target);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setFeedback({ kind: "error", message: "Selecciona un archivo para enviar." });
      return;
    }

    setSending(true);
    setFeedback(null);

    try {
      const media = dataUrlToBase64(await readFileAsDataUrl(file));

      const body: Record<string, unknown> = {
        number: number.trim(),
        kind,
        media,
      };

      if (caption.trim()) {
        body.caption = caption.trim();
      }
      if (file.name) {
        body.fileName = file.name;
      }
      if (file.type) {
        body.mimetype = file.type;
      }

      const res = await fetch("/api/whatsapp/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json()) as {
        status?: string;
        error?: string | null;
      };

      if (!res.ok || payload.status !== "success") {
        setFeedback({ kind: "error", message: payload.error ?? "No se pudo enviar el archivo." });
        return;
      }

      setFeedback({ kind: "success", message: "Archivo enviado correctamente." });
      setFile(null);
      setCaption("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red. Intenta nuevamente." });
    } finally {
      setSending(false);
    }
  }

  const inputStyles =
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="media-number" className="text-sm font-medium text-slate-300">
            Número de WhatsApp
          </label>
          <input
            id="media-number"
            type="tel"
            required
            autoComplete="off"
            placeholder="573001234567"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            className={inputStyles}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="media-kind" className="text-sm font-medium text-slate-300">
            Tipo de archivo
          </label>
          <select
            id="media-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as MediaKind)}
            className={inputStyles}
          >
            {MEDIA_KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="media-file" className="text-sm font-medium text-slate-300">
          Archivo
        </label>
        <input
          id="media-file"
          ref={fileInputRef}
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className={`${inputStyles} file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-200 file:hover:bg-slate-700`}
        />
        {file && (
          <p className="text-xs text-slate-500">
            {file.name} ({Math.round(file.size / 1024)} KB)
          </p>
        )}
      </div>

      {(kind === "image" || kind === "document" || kind === "video") && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="media-caption" className="text-sm font-medium text-slate-300">
            Leyenda (caption)
          </label>
          <input
            id="media-caption"
            type="text"
            placeholder="Texto opcional para acompañar el archivo"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className={inputStyles}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden
          />
        )}
        {sending ? "Enviando…" : `Enviar ${KIND_LABELS[kind].toLowerCase()}`}
      </button>

      {feedback && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            feedback.kind === "success"
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-red-500/10 text-red-300"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </form>
  );
}
