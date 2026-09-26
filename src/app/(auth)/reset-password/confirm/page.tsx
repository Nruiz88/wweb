"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderIcon } from "@/components/icons";
import { Logo } from "@/components/logo";

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: searchParams.get("token") || "", password }),
      });
      const data = await res.json();
      if (data.status === "error") {
        setError(data.error);
      } else {
        router.push("/login?reset=1");
      }
    } catch {
      setError("Error de red. Reintentá más tarde.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card/40 to-primary/[0.08] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <div className="rounded-2xl border border-wa-border bg-wa-panel p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-wa-text mb-2">Nueva contraseña</h1>
          <p className="text-wa-text-secondary mb-6">
            Ingresá tu nueva contraseña.
          </p>

          {error && <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Nueva contraseña (mínimo 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-wa-border bg-wa-header px-4 py-3 text-wa-text placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-accent/50"
              required
              minLength={6}
            />
            <input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-wa-border bg-wa-header px-4 py-3 text-wa-text placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-accent/50"
              required
              minLength={6}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-wa-accent py-3 font-semibold text-white hover:bg-wa-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <LoaderIcon className="h-5 w-5 animate-spin" /> : "Guardar nueva contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
