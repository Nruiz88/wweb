"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GroupSetting, Broadcast } from "@/lib/supabase/types";
import {
  CheckIcon,
  ClockIcon,
  LoaderIcon,
  PenIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
  UsersIcon,
  SendIcon,
  ShieldIcon,
} from "@/components/icons";
import { useUserPlan } from "@/hooks/useUserPlan";
import PlanPaywall from "@/components/PlanPaywall";

const STATUS_META: Record<string, { label: string; accent: string }> = {
  draft: { label: "Borrador", accent: "#e6a44e" },
  sending: { label: "Enviando", accent: "#53bdeb" },
  completed: { label: "Completado", accent: "#00a884" },
  failed: { label: "Falló", accent: "#ef4444" },
};

export default function CommunityPage() {
  const { plan, isAdmin, loading: planLoading } = useUserPlan();
  const hasAccess = isAdmin || plan === "community";
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [groupSettings, setGroupSettings] = useState<GroupSetting[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [discoveredGroups, setDiscoveredGroups] = useState<{ group_jid: string; group_name: string | null; saved: boolean }[]>([]);
  const [searchingGroups, setSearchingGroups] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingLiveGroup, setSavingLiveGroup] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"groups" | "broadcasts">("groups");

  // Group form
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupSetting | null>(null);
  const [groupJid, setGroupJid] = useState("");
  const [groupName, setGroupName] = useState("");
  const [welcomeEnabled, setWelcomeEnabled] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [spamFilterEnabled, setSpamFilterEnabled] = useState(false);
  const [blockAllLinks, setBlockAllLinks] = useState(true);
  const [allowedDomains, setAllowedDomains] = useState("");
  const [bannedWordsEnabled, setBannedWordsEnabled] = useState(false);
  const [bannedWordsInput, setBannedWordsInput] = useState("");
  const [bannedWordsAction, setBannedWordsAction] = useState<"delete" | "delete_and_reply">("delete_and_reply");
  const [bannedWordsReply, setBannedWordsReply] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  // Broadcast form
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [savingBroadcast, setSavingBroadcast] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const instRes = await fetch("/api/instances?lite=1");
      const instPayload = await instRes.json();
      if (instPayload.status === "success" && instPayload.data?.length > 0) {
        const id = instPayload.data[0].id;
        setInstanceId(id);

        // Solo datos de la DB (rápido). La discovery en vivo se hace a
        // demanda con "Buscar grupos" (evita llamar a Evolution en cada carga).
        const [grpRes, bcastRes] = await Promise.all([
          fetch(`/api/group-settings?instanceId=${id}`),
          fetch(`/api/broadcasts?instanceId=${id}`),
        ]);

        const grpPayload = await grpRes.json();
        if (grpPayload.status === "success") setGroupSettings(grpPayload.data);

        const bcastPayload = await bcastRes.json();
        if (bcastPayload.status === "success") setBroadcasts(bcastPayload.data);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // Discovery en vivo de grupos/comunidades donde el bot es admin (a demanda).
  const loadDiscoveredGroups = useCallback(async () => {
    if (!instanceId) return;
    setSearchingGroups(true);
    try {
      const discRes = await fetch(`/api/discovered-groups?instanceId=${instanceId}`);
      const discPayload = await discRes.json();
      if (discPayload.status === "success") {
        setDiscoveredGroups(discPayload.data);
      }
    } catch {
      // Non-critical
    } finally {
      setSearchingGroups(false);
    }
  }, [instanceId]);

  useEffect(() => {
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [loadData]);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  // --- Group form ---
  function openGroupForm(g?: GroupSetting) {
    if (g) {
      setEditingGroup(g);
      setGroupJid(g.group_jid);
      setGroupName(g.group_name || "");
      setWelcomeEnabled(g.welcome_enabled);
      setWelcomeMessage(g.welcome_message || "");
      setSpamFilterEnabled(g.spam_filter_enabled);
      setBlockAllLinks(g.block_all_links);
      setAllowedDomains(g.allowed_domains?.join(", ") || "");
      setBannedWordsEnabled(g.banned_words_enabled ?? false);
      setBannedWordsInput((g.banned_words || []).join(", "));
      setBannedWordsAction(g.banned_words_action ?? "delete_and_reply");
      setBannedWordsReply(g.banned_words_reply || "");
    } else {
      setEditingGroup(null);
      setGroupJid("");
      setGroupName("");
      setWelcomeEnabled(false);
      setWelcomeMessage("");
      setSpamFilterEnabled(false);
      setBlockAllLinks(true);
      setAllowedDomains("");
      setBannedWordsEnabled(false);
      setBannedWordsInput("");
      setBannedWordsAction("delete_and_reply");
      setBannedWordsReply("");
    }
    setShowGroupForm(true);
  }

  async function handleSaveGroup() {
    if (!instanceId || !groupJid) return;
    setSavingGroup(true);
    try {
      const domains = allowedDomains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);
      const words = bannedWordsInput
        .split(",")
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch("/api/group-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          groupJid,
          welcomeEnabled,
          welcomeMessage,
          spamFilterEnabled,
          blockAllLinks,
          allowedDomains: domains,
          bannedWordsEnabled,
          bannedWords: words,
          bannedWordsAction,
          bannedWordsReply,
        }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: editingGroup ? "Grupo actualizado" : "Grupo configurado" });
        setShowGroupForm(false);
        await loadData();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setSavingGroup(false);
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("Eliminar configuración de este grupo?")) return;
    await fetch(`/api/group-settings?id=${id}`, { method: "DELETE" });
    setFeedback({ kind: "success", message: "Grupo eliminado" });
    await loadData();
  }

  async function handleSaveLiveGroup(jid: string, name: string | null) {
    if (!instanceId) return;
    setSavingLiveGroup(jid);
    try {
      const res = await fetch("/api/group-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          groupJid: jid,
          groupName: name || "",
          welcomeEnabled: false,
          welcomeMessage: "",
          spamFilterEnabled: false,
          blockAllLinks: true,
          allowedDomains: [],
          bannedWordsEnabled: false,
          bannedWords: [],
          bannedWordsAction: "delete_and_reply",
          bannedWordsReply: "",
        }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({ kind: "success", message: "Grupo guardado" });
        setDiscoveredGroups((prev) =>
          prev.map((g) => (g.group_jid === jid ? { ...g, saved: true } : g)),
        );
        await loadData();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setSavingLiveGroup(null);
    }
  }

  function openConfigureDiscovered(disc: { group_jid: string; group_name: string | null }) {
    setEditingGroup(null);
    setGroupJid(disc.group_jid);
    setGroupName(disc.group_name || "");
    setWelcomeEnabled(false);
    setWelcomeMessage("");
    setSpamFilterEnabled(false);
    setBlockAllLinks(true);
    setAllowedDomains("");
    setBannedWordsEnabled(false);
    setBannedWordsInput("");
    setBannedWordsAction("delete_and_reply");
    setBannedWordsReply("");
    setShowGroupForm(true);
  }

  // --- Broadcast form ---
  function openBroadcastForm() {
    setBroadcastTitle("");
    setBroadcastMessage("");
    setSelectedGroups(groupSettings.map((g) => g.group_jid));
    setShowBroadcastForm(true);
  }

  async function handleSendBroadcast(sendNow: boolean) {
    if (!instanceId || !broadcastTitle || !broadcastMessage || selectedGroups.length === 0) return;
    setSavingBroadcast(true);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          title: broadcastTitle,
          message: broadcastMessage,
          groupJids: selectedGroups,
          sendNow,
        }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        setFeedback({
          kind: "success",
          message: sendNow
            ? `Broadcast enviado: ${payload.data.sent_count} éxitos, ${payload.data.failed_count} fallos`
            : "Broadcast guardado como borrador",
        });
        setShowBroadcastForm(false);
        await loadData();
      } else {
        setFeedback({ kind: "error", message: payload.error });
      }
    } catch {
      setFeedback({ kind: "error", message: "Error de red" });
    } finally {
      setSavingBroadcast(false);
    }
  }

  const welcomeGroups = useMemo(() => groupSettings.filter((g) => g.welcome_enabled), [groupSettings]);
  const spamGroups = useMemo(() => groupSettings.filter((g) => g.spam_filter_enabled), [groupSettings]);

  if (!planLoading && !hasAccess) {
    return (
      <PlanPaywall
        requiredPlan="community"
        currentPlan={plan}
        isAdmin={isAdmin}
        featureName="Community"
        description="Gestioná grupos, bienvenida automática, anti-spam y broadcasts"
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-wa-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6a44e]/15 text-[#e6a44e]">
            <UsersIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-wa-text">Community</p>
            <p className="text-[10px] text-wa-text-secondary/60">
              Grupos · {welcomeGroups.length} bienvenida{welcomeGroups.length !== 1 ? "s" : ""} · {spamGroups.length} anti-spam · {broadcasts.length} broadcast{broadcasts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-wa-border bg-wa-header px-4 py-2.5">
        {(["groups", "broadcasts"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              activeTab === tab
                ? "bg-[#e6a44e]/15 text-[#e6a44e]"
                : "bg-wa-panel text-wa-text-secondary hover:bg-wa-hover"
            }`}
          >
            {tab === "groups" ? "📋 Grupos" : "📣 Broadcasts"}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mx-4 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs fade-up ${
          feedback.kind === "success" ? "bg-[#00a884]/10 text-[#00a884]" : "bg-red-500/10 text-red-400"
        }`}>
          {feedback.kind === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
          {feedback.message}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!instanceId ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <UsersIcon className="h-12 w-12 text-wa-text-secondary/20" />
            <p className="text-sm text-wa-text-secondary">Espera a tener una instancia asignada</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-8 w-8 animate-spin text-wa-text-secondary/40" />
          </div>
        ) : activeTab === "groups" ? (
          /* ===== GROUPS TAB ===== */
          <div className="mx-auto max-w-2xl space-y-4">
            {/* ===== Discovery (a demanda) ===== */}
            <div className="rounded-2xl border border-[#e6a44e]/20 bg-[#e6a44e]/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e6a44e]/20 text-xs">🔍</div>
                <p className="text-xs font-semibold text-[#e6a44e]">Descubrir grupos</p>
              </div>
              <p className="text-[10px] text-wa-text-secondary/60 mb-3">
                Consultá WhatsApp para encontrar los grupos y comunidades donde el bot es admin. Guardá los que quieras administrar y quedan en tu cuenta (sin volver a consultar).
              </p>

              {searchingGroups ? (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-wa-header border border-wa-border py-6 text-xs text-wa-text-secondary">
                  <LoaderIcon className="h-4 w-4 animate-spin text-[#e6a44e]" />
                  Buscando grupos...
                </div>
              ) : discoveredGroups.length > 0 ? (
                <>
                  <p className="text-[10px] text-wa-text-secondary/60 mb-2">
                    {discoveredGroups.length} grupo{discoveredGroups.length !== 1 ? "s" : ""} donde el bot es admin.
                  </p>
                  <div className="space-y-2">
                    {discoveredGroups.map((dg) => (
                      <div key={dg.group_jid} className="flex items-center justify-between rounded-xl bg-wa-header border border-wa-border p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6a44e]/15 text-xs font-bold text-[#e6a44e]">
                            {dg.group_name?.[0]?.toUpperCase() || "#"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-wa-text truncate">{dg.group_name || "Grupo de WhatsApp"}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {dg.saved ? (
                            <button
                              type="button"
                              onClick={() => openConfigureDiscovered(dg)}
                              className="rounded-lg bg-[#00a884]/15 px-2.5 py-1.5 text-[10px] font-semibold text-[#00a884] transition hover:bg-[#00a884]/25"
                            >
                              Configurar
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={savingLiveGroup === dg.group_jid}
                              onClick={() => void handleSaveLiveGroup(dg.group_jid, dg.group_name)}
                              className="rounded-lg bg-[#00a884]/15 px-2.5 py-1.5 text-[10px] font-semibold text-[#00a884] transition hover:bg-[#00a884]/25 disabled:opacity-50"
                            >
                              {savingLiveGroup === dg.group_jid ? "Guardando..." : "Guardar grupo"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadDiscoveredGroups()}
                    className="mt-3 flex items-center gap-1.5 rounded-lg border border-wa-border bg-wa-header px-3 py-2 text-xs font-medium text-wa-text-secondary transition hover:bg-wa-hover hover:text-wa-text"
                  >
                    <RefreshIcon className="h-3.5 w-3.5" />
                    Buscar de nuevo
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadDiscoveredGroups()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e6a44e] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e6a44e]/90"
                >
                  <RefreshIcon className="h-4 w-4" />
                  Buscar grupos
                </button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-wa-text-secondary/60">
                Grupos configurados
              </p>
            </div>

            {groupSettings.length === 0 && discoveredGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full bg-[#e6a44e]/10 blur-xl" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e6a44e]/20 to-[#e6a44e]/5 ring-4 ring-[#e6a44e]/10">
                    <UsersIcon className="h-9 w-9 text-[#e6a44e]" />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-semibold text-wa-text">Sin grupos configurados</p>
                  <p className="mt-1 max-w-xs text-sm text-wa-text-secondary">
                    Agregá un grupo para configurar bienvenida y anti-spam
                  </p>
                </div>
                <div className="rounded-xl border border-wa-border bg-wa-header p-4 max-w-sm text-center">
                  <p className="text-xs text-wa-text-secondary/60">
                    Los grupos y comunidades se detectan automáticamente desde WhatsApp. Guardá uno de la lista superior para configurar bienvenida y anti-spam.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {groupSettings.map((g) => (
                  <div
                    key={g.id}
                    className="group overflow-hidden rounded-2xl border border-wa-border bg-wa-header p-4 transition hover:border-wa-text-secondary/20 hover:shadow-lg hover:shadow-black/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e6a44e]/15 text-sm font-bold text-[#e6a44e]">
                          {g.group_name?.[0]?.toUpperCase() || "#"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-wa-text">{g.group_name || "Grupo de WhatsApp"}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {g.welcome_enabled && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#00a884]/15 px-2 py-0.5 text-[9px] font-medium text-[#00a884]">
                                👋 Bienvenida
                              </span>
                            )}
                            {g.spam_filter_enabled && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-medium text-red-400">
                                🛡️ Anti-spam
                              </span>
                            )}
                            {(g.banned_words_enabled && (g.banned_words?.length ?? 0) > 0) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#e6a44e]/15 px-2 py-0.5 text-[9px] font-medium text-[#e6a44e]">
                                🚫 {(g.banned_words?.length ?? 0)} palabra{(g.banned_words?.length ?? 0) !== 1 ? "s" : ""}
                              </span>
                            )}
                            {g.allowed_domains?.length > 0 && (
                              <span className="inline-flex items-center rounded-full bg-[#53bdeb]/15 px-2 py-0.5 text-[9px] font-medium text-[#53bdeb]">
                                {g.allowed_domains.length} dominio{g.allowed_domains.length !== 1 ? "s" : ""} permitido{g.allowed_domains.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => openGroupForm(g)}
                          className="rounded-lg p-1.5 text-wa-text-secondary transition hover:bg-wa-hover hover:text-wa-text"
                        >
                          <PenIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteGroup(g.id)}
                          className="rounded-lg p-1.5 text-red-400/50 transition hover:bg-red-500/10 hover:text-red-400"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ===== BROADCASTS TAB ===== */
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-wa-text-secondary/60">
                Comunicados
              </p>
              <button
                type="button"
                onClick={openBroadcastForm}
                disabled={groupSettings.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-[#e6a44e] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#e6a44e]/90 disabled:opacity-50"
              >
                <SendIcon className="h-3.5 w-3.5" />
                Nuevo broadcast
              </button>
            </div>

            {broadcasts.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-wa-header ring-4 ring-wa-border/30">
                  <SendIcon className="h-10 w-10 text-wa-text-secondary/20" />
                </div>
                <div>
                  <p className="text-base font-semibold text-wa-text">Sin comunicados</p>
                  <p className="mt-1 text-sm text-wa-text-secondary">
                    Enviá mensajes masivos a todos tus grupos
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {broadcasts.map((b) => {
                  const meta = STATUS_META[b.status] || STATUS_META.draft;
                  return (
                    <div
                      key={b.id}
                      className="overflow-hidden rounded-2xl border border-wa-border bg-wa-header p-4 transition hover:border-wa-text-secondary/20"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-wa-text">{b.title}</p>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                              style={{ backgroundColor: `${meta.accent}15`, color: meta.accent }}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-wa-text-secondary line-clamp-2">{b.message}</p>
                          <div className="mt-2 flex items-center gap-3 text-[10px] text-wa-text-secondary/50">
                            <span>{b.total_groups} grupo{b.total_groups !== 1 ? "s" : ""}</span>
                            {b.sent_count > 0 && (
                              <span className="text-[#00a884]">{b.sent_count} enviado{b.sent_count !== 1 ? "s" : ""}</span>
                            )}
                            {b.failed_count > 0 && (
                              <span className="text-red-400">{b.failed_count} fallo{b.failed_count !== 1 ? "s" : ""}</span>
                            )}
                            {b.sent_at && (
                              <span>{new Date(b.sent_at).toLocaleString("es-AR")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== GROUP FORM MODAL ===== */}
      {showGroupForm && (
        <div className="modal-overlay" onClick={() => setShowGroupForm(false)}>
          <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-wa-text">
                  {editingGroup ? "Editar grupo" : "Configurar grupo"}
                </h3>
                <p className="text-[10px] text-wa-text-secondary/60">Bienvenida y anti-spam</p>
              </div>
              <button type="button" onClick={() => setShowGroupForm(false)} className="icon-btn h-8 w-8">
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              <div className="flex items-center gap-3 rounded-xl border border-wa-border bg-wa-input px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e6a44e]/15 text-xs font-bold text-[#e6a44e]">
                  {groupName?.[0]?.toUpperCase() || "#"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-wa-text truncate">{groupName || "Grupo de WhatsApp"}</p>
                  <p className="text-[10px] text-wa-text-secondary/50">
                    El nombre se toma automáticamente de WhatsApp
                  </p>
                </div>
              </div>

              {/* Welcome */}
              <div className="rounded-xl border border-wa-border bg-wa-input p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">👋</span>
                    <span className="text-sm font-medium text-wa-text">Bienvenida automática</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWelcomeEnabled(!welcomeEnabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${welcomeEnabled ? "bg-[#00a884]" : "bg-wa-text-secondary/30"}`}
                  >
                    <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${welcomeEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {welcomeEnabled && (
                  <div className="mt-3 fade-up">
                    <textarea
                      rows={3}
                      placeholder="¡Hola @usuario! Bienvenido al grupo 👋"
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      className="w-full resize-none rounded-xl border border-wa-border bg-wa-panel px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-wa-text-secondary/50">
                      Usá <code className="text-[#e6a44e]">@usuario</code> para mencionar al nuevo miembro
                    </p>
                  </div>
                )}
              </div>

              {/* Spam filter */}
              <div className="rounded-xl border border-wa-border bg-wa-input p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🛡️</span>
                    <span className="text-sm font-medium text-wa-text">Filtro anti-spam</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSpamFilterEnabled(!spamFilterEnabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${spamFilterEnabled ? "bg-[#00a884]" : "bg-wa-text-secondary/30"}`}
                  >
                    <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${spamFilterEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {spamFilterEnabled && (
                  <div className="mt-3 space-y-3 fade-up">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-wa-text-secondary">Bloquear todos los links</span>
                      <button
                        type="button"
                        onClick={() => setBlockAllLinks(!blockAllLinks)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${blockAllLinks ? "bg-[#00a884]" : "bg-wa-text-secondary/30"}`}
                      >
                        <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${blockAllLinks ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    {!blockAllLinks && (
                      <div className="fade-up">
                        <input
                          type="text"
                          placeholder="Dominios permitidos (separados por coma)"
                          value={allowedDomains}
                          onChange={(e) => setAllowedDomains(e.target.value)}
                          className="w-full rounded-xl border border-wa-border bg-wa-panel px-4 py-2.5 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                        />
                        <p className="mt-1 text-[10px] text-wa-text-secondary/50">
                          Ej: youtube.com, instagram.com
                        </p>
                      </div>
                    )}
                    <p className="text-[10px] text-wa-text-secondary/50">
                      Los links no autorizados serán eliminados automáticamente. El bot necesita ser admin del grupo.
                    </p>
                  </div>
                )}
              </div>

              {/* Banned words moderation */}
              <div className="rounded-xl border border-wa-border bg-wa-input p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🚫</span>
                    <span className="text-sm font-medium text-wa-text">Palabras prohibidas</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBannedWordsEnabled(!bannedWordsEnabled)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${bannedWordsEnabled ? "bg-[#00a884]" : "bg-wa-text-secondary/30"}`}
                  >
                    <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${bannedWordsEnabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {bannedWordsEnabled && (
                  <div className="mt-3 space-y-3 fade-up">
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="text"
                        placeholder="Ej: palabra1, palabra2, otra"
                        value={bannedWordsInput}
                        onChange={(e) => setBannedWordsInput(e.target.value)}
                        className="w-full rounded-xl border border-wa-border bg-wa-panel px-4 py-2.5 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                      />
                      <p className="text-[10px] text-wa-text-secondary/50">
                        Palabras separadas por coma. Los mensajes que las contengan serán eliminados.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-wa-text-secondary">Acción al detectar una palabra</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setBannedWordsAction("delete_and_reply")}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            bannedWordsAction === "delete_and_reply"
                              ? "border-[#00a884] bg-[#00a884]/15 text-[#00a884]"
                              : "border-wa-border text-wa-text-secondary hover:bg-wa-hover"
                          }`}
                        >
                          Borrar y responder
                        </button>
                        <button
                          type="button"
                          onClick={() => setBannedWordsAction("delete")}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            bannedWordsAction === "delete"
                              ? "border-[#00a884] bg-[#00a884]/15 text-[#00a884]"
                              : "border-wa-border text-wa-text-secondary hover:bg-wa-hover"
                          }`}
                        >
                          Solo borrar
                        </button>
                      </div>
                    </div>
                    {bannedWordsAction === "delete_and_reply" && (
                      <div className="flex flex-col gap-1.5 fade-up">
                        <textarea
                          rows={2}
                          placeholder="Ej: ⚠️ Ese mensaje contiene una palabra prohibida. Por favor evitá ese lenguaje."
                          value={bannedWordsReply}
                          onChange={(e) => setBannedWordsReply(e.target.value)}
                          className="w-full resize-none rounded-xl border border-wa-border bg-wa-panel px-4 py-2.5 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                        />
                        <p className="text-[10px] text-wa-text-secondary/50">
                          Mensaje que el bot enviará al grupo después de eliminar el mensaje.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowGroupForm(false)}
                  className="flex-1 rounded-xl border border-wa-border py-3 text-sm font-medium text-wa-text-secondary hover:bg-wa-hover"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveGroup()}
                  disabled={savingGroup || !groupJid}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e6a44e] py-3 text-sm font-semibold text-white hover:bg-[#e6a44e]/90 disabled:opacity-50"
                >
                  {savingGroup ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {savingGroup ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== BROADCAST FORM MODAL ===== */}
      {showBroadcastForm && (
        <div className="modal-overlay" onClick={() => setShowBroadcastForm(false)}>
          <div className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-wa-border bg-wa-panel shadow-2xl fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-wa-border bg-wa-header px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-wa-text">Nuevo broadcast</h3>
                <p className="text-[10px] text-wa-text-secondary/60">Enviar mensaje a múltiples grupos</p>
              </div>
              <button type="button" onClick={() => setShowBroadcastForm(false)} className="icon-btn h-8 w-8">
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">Título</label>
                <input
                  type="text"
                  placeholder="Ej: Mantenimiento programado"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">Mensaje</label>
                <textarea
                  rows={5}
                  placeholder="Escribí el mensaje que se enviará a todos los grupos seleccionados..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="resize-none rounded-xl border border-wa-border bg-wa-input px-4 py-3 text-sm text-wa-text placeholder:text-wa-text-secondary/40 focus:border-[#00a884] focus:outline-none"
                />
                <p className="text-[10px] text-wa-text-secondary/50">
                  Usá <code className="text-[#e6a44e]">@everyone</code> para mencionar a todos, o{" "}
                  <code className="text-[#e6a44e]">@número</code> (ej. @5492995885273) para mencionar a un contacto.
                  Se agrega automáticamente la leyenda &quot;Enviado por el Admin Bot&quot;.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-wa-text-secondary">
                  Grupos destino ({selectedGroups.length}/{groupSettings.length})
                </label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-wa-border bg-wa-input p-3">
                  {groupSettings.map((g) => (
                    <label key={g.group_jid} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedGroups.includes(g.group_jid)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedGroups([...selectedGroups, g.group_jid]);
                          } else {
                            setSelectedGroups(selectedGroups.filter((j) => j !== g.group_jid));
                          }
                        }}
                        className="h-4 w-4 rounded border-wa-border text-[#e6a44e] focus:ring-[#e6a44e]"
                      />
                      <span className="text-xs text-wa-text">{g.group_name || g.group_jid}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBroadcastForm(false)}
                  className="flex-1 rounded-xl border border-wa-border py-3 text-sm font-medium text-wa-text-secondary hover:bg-wa-hover"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendBroadcast(false)}
                  disabled={savingBroadcast || !broadcastTitle || !broadcastMessage || selectedGroups.length === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#e6a44e] py-3 text-sm font-semibold text-[#e6a44e] transition hover:bg-[#e6a44e]/10 disabled:opacity-50"
                >
                  Guardar borrador
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendBroadcast(true)}
                  disabled={savingBroadcast || !broadcastTitle || !broadcastMessage || selectedGroups.length === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#e6a44e] py-3 text-sm font-semibold text-white hover:bg-[#e6a44e]/90 disabled:opacity-50"
                >
                  {savingBroadcast ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                  {savingBroadcast ? "Enviando..." : "Enviar ahora"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
