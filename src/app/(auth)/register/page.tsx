"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderIcon } from "@/components/icons";
import { Logo } from "@/components/logo";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data = await res.json();
      if (data.status === "error") {
        setError(data.error);
      } else {
        router.push("/login?registered=1");
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
          <h1 className="text-2xl font-bold text-wa-text mb-2">Creá tu cuenta</h1>
          <p className="text-wa-text-secondary mb-6">
            Ya tenés una cuenta?{" "}
            <a href="/login" className="text-wa-accent hover:underline">
              Iniciá sesión
            </a>
          </p>

          {error && <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Nombre completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-wa-border bg-wa-header px-4 py-3 text-wa-text placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-accent/50"
              required
            />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-wa-border bg-wa-header px-4 py-3 text-wa-text placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-accent/50"
              required
            />
            <input
              type="password"
              placeholder="Contraseña (mínimo 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-wa-border bg-wa-header px-4 py-3 text-wa-text placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-accent/50"
              required
              minLength={6}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-wa-accent py-3 font-semibold text-white hover:bg-wa-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <LoaderIcon className="h-5 w-5 animate-spin" /> : "Crear cuenta"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-wa-text-secondary mt-4">
          Al registrarte, aceptás nuestros{" "}
          <a href="/terminos" className="hover:underline">Términos</a> y{" "}
          <a href="/privacidad" className="hover:underline">Política de privacidad</a>.
        </p>
      </div>
    </div>
  );
}
