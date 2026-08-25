"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/supabase/types";
import {
  CheckIcon,
  LoaderIcon,
  UserIcon,
  XIcon,
} from "@/components/icons";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      const payload = await res.json();
      if (payload.status === "success") {
        const p = payload.data;
        setProfile(p);
        setFullName(p.full_name || "");
        setBusinessName(p.business_name || "");
        setPhone(p.phone || "");
        setAddress(p.address || "");
        setEmail(p.email || "");
      }
    } catch { /* non-critical */ }
    setLoading(false);
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, business_name: businessName, phone, address }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: "Perfil actualizado" });
        setProfile(payload.data);
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-wa-border bg-wa-header px-4 py-2.5">
        <UserIcon className="h-5 w-5 text-[#00a884]" />
        <span className="text-[0.9375rem] font-normal text-wa-text">Mi Perfil</span>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mx-4 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
            feedback.kind === "success"
              ? "bg-[#00a884]/10 text-[#00a884]"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {feedback.kind === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
          {feedback.message}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : (
          <div className="mx-auto max-w-lg space-y-6">

            {/* Avatar + Role */}
            <div className="flex items-center gap-4 rounded-xl border border-wa-border bg-wa-header p-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#00a884]/15 text-[#00a884]">
                <UserIcon className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-wa-text truncate">
                  {profile?.full_name || profile?.email || "Sin nombre"}
                </p>
                <p className="text-sm text-wa-text-secondary">{profile?.email}</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  profile?.role === "admin"
                    ? "bg-[#00a884]/15 text-[#00a884]"
                    : "bg-[#53bdeb]/15 text-[#53bdeb]"
                }`}>
                  {profile?.role === "admin" ? "Administrador" : "Usuario"}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="rounded-xl border border-wa-border bg-wa-header p-5 space-y-4">
              <h3 className="text-sm font-semibold text-wa-text">Datos personales</h3>

              {/* Email (read-only) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-wa-text-secondary">Email</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text-secondary/60 cursor-not-allowed opacity-60"
                />
                <p className="text-[10px] text-wa-text-secondary/40">No se puede cambiar</p>
              </div>

              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-wa-text-secondary">Nombre y Apellido</label>
                <input
                  type="text"
                  placeholder="Juan Perez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
              </div>

              {/* Business Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-wa-text-secondary">Local / Emprendimiento</label>
                <input
                  type="text"
                  placeholder="Mi negocio"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-wa-text-secondary">Telefono</label>
                <input
                  type="tel"
                  placeholder="+54 11 1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-wa-text-secondary">Direccion</label>
                <input
                  type="text"
                  placeholder="Av. Principal 1234, Ciudad"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
              </div>

              {/* Save button */}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a884] px-4 py-3 text-sm font-semibold text-white hover:bg-[#00a884]/90 disabled:opacity-50"
              >
                {saving ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>

            <p className="text-center text-[11px] text-wa-text-secondary/40">
              Miembro desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("es-AR") : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
