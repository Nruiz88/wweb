"use client";

import { useState } from "react";
import {
  CheckIcon,
  ClockIcon,
  LoaderIcon,
  MicIcon,
  PenIcon,
  SearchIcon,
  SendIcon,
  XIcon,
} from "@/components/icons";

type Presence = "" | "composing" | "recording";
type Feedback = { kind: "success" | "error"; message: string } | null;

const PRESENCE_OPTIONS: {
  value: Presence;
  label: string;
  icon: typeof PenIcon;
}[] = [
  { value: "", label: "Sin", icon: ClockIcon },
  { value: "composing", label: "Escribiendo", icon: PenIcon },
  { value: "recording", label: "Audio", icon: MicIcon },
];

export function SendMessageForm() {
  const [number, setNumber] = useState("");
  const [text, setText] = useState("");
  const [presence, setPresence] = useState<Presence>("");
  const [presenceSeconds, setPresenceSeconds] = useState(3);
  const [sending, setSending] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{
    exists: boolean | null;
    name: string | null;
  }>({ exists: null, name: null });
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleValidate() {
    const value = number.trim();
    if (!value) {
      return;
    }

    setValidating(true);
    setValidation({ exists: null, name: null });

    try {
      const res = await fetch("/api/whatsapp/validate-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: value }),
      });

      const payload = (await res.json()) as {
        status?: string;
        error?: string | null;
        data?: { exists?: boolean; name?: string | null } | null;
      };

      if (!res.ok || payload.status !== "success" || !payload.data) {
        setFeedback({ kind: "error", message: payload.error ?? "No se pudo validar el número." });
        return;
      }

      setValidation({
        exists: !!payload.data.exists,
        name: payload.data.name ?? null,
      });
      setFeedback(null);
    } catch {
      setFeedback({ kind: "error", message: "Error de red al validar el número." });
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setFeedback(null);

    try {
      const body: Record<string, unknown> = {
        number: number.trim(),
        text: text.trim(),
      };

      if (presence) {
        body.presence = { type: presence, duration: presenceSeconds * 1000 };
      }

      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json()) as {
        status?: string;
        error?: string | null;
      };

      if (!res.ok || payload.status !== "success") {
        setFeedback({ kind: "error", message: payload.error ?? "No se pudo enviar el mensaje." });
        return;
      }

      setFeedback({
        kind: "success",
        message: presence
          ? "Mensaje enviado con presencia simulada."
          : "Mensaje enviado correctamente.",
      });
      setText("");
    } catch {
      setFeedback({ kind: "error", message: "Error de red. Intenta nuevamente." });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="number" className="field-label">
          Número de WhatsApp
        </label>
        <div className="relative">
          <input
            id="number"
            type="tel"
            required
            autoComplete="off"
            placeholder="573001234567"
            value={number}
            onChange={(event) => {
              setNumber(event.target.value);
              setValidation({ exists: null, name: null });
            }}
            className="field-input pr-24"
          />
          <button
            type="button"
            onClick={() => void handleValidate()}
            disabled={validating || number.trim() === ""}
            className="btn-base absolute inset-y-1 right-1 border border-slate-700 bg-slate-800/80 px-3 text-xs text-slate-200 hover:border-slate-600 hover:bg-slate-700"
          >
            {validating ? (
              <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <SearchIcon className="h-3.5 w-3.5" />
            )}
            Validar
          </button>
        </div>

        <div className="flex min-h-5 items-center gap-1.5 text-xs">
          {validating ? (
            <span className="text-slate-500">Verificando número…</span>
          ) : validation.exists === null ? (
            <span className="text-slate-500">
              Con código de país, sin “+”.
            </span>
          ) : validation.exists ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
              <CheckIcon className="h-3.5 w-3.5" />
              Existe en WhatsApp
              {validation.name ? ` (${validation.name})` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-red-400">
              <XIcon className="h-3.5 w-3.5" />
              No existe en WhatsApp
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="text" className="field-label">
          Mensaje
        </label>
        <textarea
          id="text"
          required
          rows={3}
          placeholder="Escribe el mensaje a enviar…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="field-input resize-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="field-label">Presencia (humanización)</span>
        <div className="grid grid-cols-3 gap-2">
          {PRESENCE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = presence === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPresence(option.value)}
                className={`btn-base flex-col gap-1.5 border py-2.5 text-xs ${
                  active
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 shadow-[0_0_16px_-4px_rgba(16,185,129,0.5)]"
                    : "border-slate-700/80 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>

        {presence && (
          <div className="fade-up flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
            <input
              id="presenceSeconds"
              type="range"
              min={1}
              max={8}
              value={presenceSeconds}
              onChange={(event) => setPresenceSeconds(Number(event.target.value))}
              className="h-1.5 flex-1 cursor-pointer"
            />
            <span className="shrink-0 text-xs font-medium text-slate-300">
              {presenceSeconds} s
            </span>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={sending}
        className="btn-base bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-white shadow-lg shadow-emerald-500/25 hover:brightness-110"
      >
        {sending ? (
          <LoaderIcon className="h-4 w-4 animate-spin" />
        ) : (
          <SendIcon className="h-4 w-4" />
        )}
        {sending ? "Enviando…" : "Enviar mensaje"}
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
