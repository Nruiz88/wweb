"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderIcon } from "@/components/icons";
import { Logo } from "@/components/logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        setLoading(false);
        return;
      }

      router.replace(next);
    } catch {
      setError("Error de conexión");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo size="lg" className="mx-auto justify-center" />
          <div className="text-center">
            <p className="text-sm text-wa-text-secondary">Inicia sesión para continuar</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-wa-text-secondary">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-field"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#00a884] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#00a884]/90 disabled:opacity-50"
          >
            {loading ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>

          <p className="text-center text-sm text-wa-text-secondary">
            <a href="/reset-password" className="text-[#00a884] hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </p>

          <p className="text-center text-sm text-wa-text-secondary">
            ¿No tenés cuenta?{" "}
            <a href="/register" className="text-[#00a884] hover:underline">
              Regístrate
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
