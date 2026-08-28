"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { LoaderIcon } from "@/components/icons";
import { Logo } from "@/components/logo";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/confirm`,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <Logo size="lg" className="mx-auto justify-center" />
          <h1 className="mt-4 text-xl font-semibold text-wa-text">Email enviado</h1>
          <p className="mt-2 text-sm text-wa-text-secondary">
            Revisa tu bandeja de entrada y seguí el enlace para restablecer tu contraseña.
          </p>
          <p className="mt-1 text-xs text-wa-text-secondary/50">
            Si no lo ves, revisá la carpeta de spam.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block rounded-lg bg-[#00a884] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#00a884]/90"
          >
            Volver al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" className="mx-auto justify-center" />
          <div className="text-center">
            <p className="text-sm text-wa-text-secondary">
              Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña
            </p>
          </div>
        </div>

        <form onSubmit={handleReset} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-wa-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#00a884] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#00a884]/90 disabled:opacity-50"
          >
            {loading ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Enviando..." : "Enviar enlace de recuperación"}
          </button>

          <p className="text-center text-sm text-wa-text-secondary">
            ¿Recordaste tu contraseña?{" "}
            <a href="/login" className="text-[#00a884] hover:underline">
              Inicia sesión
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
