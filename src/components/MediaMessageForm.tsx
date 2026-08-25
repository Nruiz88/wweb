"use client";

import { useRef, useState } from "react";
import {
  AudioLinesIcon,
  CheckIcon,
  FileTextIcon,
  ImageIcon,
  LoaderIcon,
  MicIcon,
  SendIcon,
  UploadIcon,
  VideoIcon,
  XIcon,
} from "@/components/icons";

type MediaKind = "image" | "document" | "video" | "audio" | "ptt";
type Feedback = { kind: "success" | "error"; message: string } | null;

const KIND_OPTIONS: { value: MediaKind; label: string; icon: typeof ImageIcon }[] = [
  { value: "image", label: "Imagen", icon: ImageIcon },
  { value: "document", label: "PDF / Doc", icon: FileTextIcon },
  { value: "video", label: "Video", icon: VideoIcon },
  { value: "audio", label: "Audio", icon: AudioLinesIcon },
  { value: "ptt", label: "Nota de voz", icon: MicIcon },
];

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="field-label">Tipo de archivo</span>
        <div className="grid grid-cols-5 gap-1.5">
          {KIND_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = kind === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                title={option.label}
                className={`btn-base flex-col gap-1.5 rounded-xl border px-1 py-2.5 text-[10px] leading-tight ${
                  active
                    ? "border-sky-500/60 bg-sky-500/15 text-sky-300 shadow-[0_0_16px_-4px_rgba(14,165,233,0.5)]"
                    : "border-slate-700/80 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="media-number" className="field-label">
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
          className="field-input"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="media-file" className="field-label">
          Archivo
        </label>
        <input
          id="media-file"
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <label
          htmlFor="media-file"
          className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 px-4 py-4 transition hover:border-sky-500/50 hover:bg-sky-500/5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
            {file ? <CheckIcon className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            {file ? (
              <>
                <span className="block truncate text-sm font-medium text-slate-200">
                  {file.name}
                </span>
                <span className="block text-xs text-slate-500">
                  {Math.round(file.size / 1024)} KB · toca para cambiar
                </span>
              </>
            ) : (
              <>
                <span className="block text-sm font-medium text-slate-300">
                  Arrastra o selecciona un archivo
                </span>
                <span className="block text-xs text-slate-500">
                  Imagen, PDF, video o audio
                </span>
              </>
            )}
          </span>
        </label>
      </div>

      {(kind === "image" || kind === "document" || kind === "video") && (
        <div className="flex flex-col gap-2">
          <label htmlFor="media-caption" className="field-label">
            Leyenda (caption)
          </label>
          <input
            id="media-caption"
            type="text"
            placeholder="Texto opcional para acompañar el archivo"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className="field-input"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={sending}
        className="btn-base bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-3 text-white shadow-lg shadow-sky-500/25 hover:brightness-110"
      >
        {sending ? (
          <LoaderIcon className="h-4 w-4 animate-spin" />
        ) : (
          <SendIcon className="h-4 w-4" />
        )}
        {sending ? "Enviando…" : "Enviar archivo"}
      </button>

      {feedback && (
        <p
          role="status"
          className={`fade-up flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
            feedback.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {feedback.kind === "success" ? (
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XIcon className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {feedback.message}
        </p>
      )}
    </form>
  );
}
