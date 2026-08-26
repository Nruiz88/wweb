"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "@/lib/supabase/types";
import {
  CheckIcon,
  LoaderIcon,
  UserIcon,
  XIcon,
  ShieldIcon,
  MessageCircleIcon,
  ClockIcon,
} from "@/components/icons";

// Avatar with gradient
function ProfileAvatar({ name, role }: { name: string; role?: string }) {
  const initial = name?.[0]?.toUpperCase() || "?";
  const isAdmin = role === "admin";

  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-full bg-[#00a884]/10 blur-xl" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#00a884]/20 to-[#00a884]/5 ring-4 ring-[#00a884]/10 text-2xl font-bold text-[#00a884]">
        {initial}
      </div>
      {isAdmin && (
        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#00a884] shadow-lg shadow-[#00a884]/30">
          <ShieldIcon className="h-3.5 w-3.5 text-white" />
        </div>
      )}
    </div>
  );
}

// Info card
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-wa-border/50 bg-wa-panel/50 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00a884]/10 text-[#00a884]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-wa-text-secondary/50">{label}</p>
        <p className="truncate text-sm text-wa-text">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

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

  const hasChanges = profile && (
    fullName !== (profile.full_name || "") ||
    businessName !== (profile.business_name || "") ||
    phone !== (profile.phone || "") ||
    address !== (profile.address || "")
  );

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="border-b border-wa-border bg-wa-header px-4 py-2.5">
        <span className="text-[0.9375rem] font-normal text-wa-text">Mi Perfil</span>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`mx-4 mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium ${
            feedback.kind === "success"
              ? "bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
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
          <div className="mx-auto max-w-lg space-y-5">

            {/* Profile card */}
            <div className="relative overflow-hidden rounded-2xl border border-wa-border bg-wa-header p-6">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#00a884]/5 blur-2xl" />
              <div className="relative flex items-center gap-4">
                <ProfileAvatar name={profile?.full_name || profile?.email || ""} role={profile?.role} />
                <div className="min-w-0">
                  <p className="text-lg font-bold text-wa-text truncate">
                    {profile?.full_name || "Sin nombre"}
                  </p>
                  <p className="text-sm text-wa-text-secondary">{profile?.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      profile?.role === "admin"
                        ? "bg-[#00a884]/15 text-[#00a884]"
                        : "bg-[#53bdeb]/15 text-[#53bdeb]"
                    }`}>
                      {profile?.role === "admin" ? <ShieldIcon className="h-2.5 w-2.5" /> : <UserIcon className="h-2.5 w-2.5" />}
                      {profile?.role === "admin" ? "Administrador" : "Usuario"}
                    </span>
                    <span className="text-[10px] text-wa-text-secondary/40">
                      Miembro desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("es-AR") : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick info cards */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={<MessageCircleIcon className="h-4 w-4" />} label="Negocio" value={businessName} />
              <InfoCard icon={<ClockIcon className="h-4 w-4" />} label="Telefono" value={phone} />
            </div>

            {/* Form */}
            <div className="rounded-2xl border border-wa-border bg-wa-header p-5 space-y-4">
              <h3 className="text-sm font-semibold text-wa-text">Editar datos</h3>

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
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none transition"
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
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none transition"
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
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none transition"
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
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none transition"
                />
              </div>

              {/* Save button */}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !hasChanges}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00a884] to-[#25d366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00a884]/20 transition-all hover:shadow-xl hover:shadow-[#00a884]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
