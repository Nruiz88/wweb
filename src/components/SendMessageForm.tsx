"use client";

import { useState } from "react";

type Presence = "" | "composing" | "recording";
type Feedback = { kind: "success" | "error"; message: string } | null;

const PRESENCE_LABELS: Record<Exclude<Presence, "">, string> = {
  composing: "Escribiendo…",
  recording: "Grabando audio…",
};

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
          ? `Mensaje enviado con presencia “${PRESENCE_LABELS[presence]}”.`
          : "Mensaje enviado correctamente.",
      });
      setText("");
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
      <div className="flex flex-col gap-1.5">
        <label htmlFor="number" className="text-sm font-medium text-slate-300">
          Número de WhatsApp
        </label>
        <div className="flex gap-2">
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
            className={inputStyles}
          />
          <button
            type="button"
            onClick={() => void handleValidate()}
            disabled={validating || number.trim() === ""}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {validating && (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-slate-100"
                aria-hidden
              />
            )}
            Validar
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {validation.exists === null ? (
            <span className="text-slate-500">Con código de país, sin “+”.</span>
          ) : validation.exists ? (
            <span className="font-medium text-emerald-400">
              Existe en WhatsApp{validation.name ? ` (${validation.name})` : ""}
            </span>
          ) : (
            <span className="font-medium text-red-400">No existe en WhatsApp</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="text" className="text-sm font-medium text-slate-300">
          Mensaje
        </label>
        <textarea
          id="text"
          required
          rows={3}
          placeholder="Escribe el mensaje a enviar…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={`${inputStyles} resize-none`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="presence" className="text-sm font-medium text-slate-300">
            Presencia (humanización)
          </label>
          <select
            id="presence"
            value={presence}
            onChange={(event) => setPresence(event.target.value as Presence)}
            className={inputStyles}
          >
            <option value="">Sin presencia</option>
            <option value="composing">Escribiendo…</option>
            <option value="recording">Grabando audio…</option>
          </select>
        </div>

        {presence && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="presenceSeconds" className="text-sm font-medium text-slate-300">
              Duración (segundos)
            </label>
            <input
              id="presenceSeconds"
              type="number"
              min={1}
              max={8}
              value={presenceSeconds}
              onChange={(event) => setPresenceSeconds(Number(event.target.value))}
              className={inputStyles}
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden
          />
        )}
        {sending ? "Enviando…" : "Enviar mensaje"}
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
