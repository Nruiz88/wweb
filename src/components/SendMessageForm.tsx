"use client";

import { useState } from "react";

type Feedback = { kind: "success" | "error"; message: string } | null;

export function SendMessageForm() {
  const [number, setNumber] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: number.trim(), text: text.trim() }),
      });

      const payload = (await res.json()) as {
        status?: string;
        error?: string | null;
      };

      if (!res.ok || payload.status !== "success") {
        setFeedback({ kind: "error", message: payload.error ?? "No se pudo enviar el mensaje." });
        return;
      }

      setFeedback({ kind: "success", message: "Mensaje enviado correctamente." });
      setNumber("");
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
        <input
          id="number"
          type="tel"
          required
          autoComplete="off"
          placeholder="573001234567"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          className={inputStyles}
        />
        <p className="text-xs text-slate-500">Con código de país, sin “+”, espacios ni guiones.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="text" className="text-sm font-medium text-slate-300">
          Mensaje
        </label>
        <textarea
          id="text"
          required
          rows={4}
          placeholder="Escribe el mensaje a enviar…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={`${inputStyles} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
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
