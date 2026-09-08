"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Plus, Settings, Shield, Trash2, X, MessageCircle, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { Instance, Profile } from "@/lib/supabase/types";

function InstanceCard({ instance, onDelete }: { instance: Instance; onDelete: (id: string) => void }) {
  const isConnected = instance.status === "open";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isConnected ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{instance.instance_name}</h3>
                  <Badge variant="secondary" className={`gap-1 text-[10px] ${isConnected ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-destructive"}`} />
                    {isConnected ? "Conectada" : "Desconectada"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Creada: {new Date(instance.created_at).toLocaleDateString("es-AR")}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(instance.id)} title="Eliminar">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [instanceName, setInstanceName] = useState("");
  const [evolutionApiUrl, setEvolutionApiUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [outsideHoursMessage, setOutsideHoursMessage] = useState("");
  const [savingMessages, setSavingMessages] = useState(false);

  const isAdmin = profile?.role === "admin";

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/instances?lite=1");
    const payload = await res.json();
    if (payload.status === "success") {
      setInstances(payload.data);
      if (payload.role) {
        setProfile({ id: "", email: null, full_name: null, role: payload.role, business_name: null, phone: null, address: null, created_at: "" });
      }
      if (payload.data?.length > 0) {
        const id = payload.data[0].id;
        setSelectedInstanceId(id);
        try {
          const settingsRes = await fetch(`/api/instance-settings?instanceId=${id}`);
          const settingsPayload = await settingsRes.json();
          if (settingsPayload.status === "success") {
            setWelcomeMessage(settingsPayload.data.welcomeMessage || "");
            setOutsideHoursMessage(settingsPayload.data.outsideHoursMessage || "");
          }
        } catch {
          /* non-critical */
        }
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(t);
  }, [loadData]);

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName, evolutionApiUrl, evolutionApiKey }),
      });
      const payload = await res.json();
      if (payload.status !== "success") {
        toast.error(payload.error ?? "Error al crear instancia");
        return;
      }
      toast.success("Instancia creada correctamente");
      setShowForm(false);
      setInstanceName("");
      setEvolutionApiUrl("");
      setEvolutionApiKey("");
      await loadData();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta instancia y todas sus auto-respuestas?")) return;
    const res = await fetch(`/api/instances?id=${id}`, { method: "DELETE" });
    const payload = await res.json();
    if (payload.status === "success") {
      toast.success("Instancia eliminada");
      await loadData();
    } else {
      toast.error(payload.error ?? "Error al eliminar");
    }
  }

  async function handleSaveMessages() {
    if (!selectedInstanceId) return;
    setSavingMessages(true);
    try {
      const res = await fetch("/api/instance-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          welcomeMessage: welcomeMessage || null,
          outsideHoursMessage: outsideHoursMessage || null,
        }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        toast.success("Mensajes guardados");
      } else {
        toast.error(payload.error ?? "Error al guardar");
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setSavingMessages(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold">Configuración</span>
          {isAdmin && (
            <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 text-[10px]">
              <Shield className="h-2.5 w-2.5" /> Admin
            </Badge>
          )}
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Nueva instancia
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : instances.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
              <Settings className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-base font-semibold">{isAdmin ? "Sin instancias" : "Sin instancia asignada"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Crea una para que los usuarios conecten WhatsApp" : "Pide al administrador que te asigne una"}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
            <div className="space-y-3">
              {instances.map((instance) => (
                <InstanceCard key={instance.id} instance={instance} onDelete={handleDelete} />
              ))}
            </div>

            {/* Messages card */}
            {selectedInstanceId && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Mensajes automáticos</CardTitle>
                      <CardDescription className="text-xs">Bienvenida y fuera de horario</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Mensaje de bienvenida</label>
                    <textarea
                      rows={3}
                      placeholder="Ej: ¡Hola! 👋 Bienvenido a [tu negocio]. ¿En qué te puedo ayudar?"
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      className="flex min-h-[80px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <p className="text-[10px] text-muted-foreground">Se envía solo la primera vez que cada persona te escribe</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Mensaje fuera de horario</label>
                    <textarea
                      rows={3}
                      placeholder="Ej: ¡Hola! Nuestro horario es de lunes a viernes de 9:00 a 18:00."
                      value={outsideHoursMessage}
                      onChange={(e) => setOutsideHoursMessage(e.target.value)}
                      className="flex min-h-[80px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Se envía cuando escriben fuera del horario configurado en <a href="/calendar" className="text-primary hover:underline">Calendario</a>
                    </p>
                  </div>

                  <Button onClick={() => void handleSaveMessages()} disabled={savingMessages} className="gap-2">
                    {savingMessages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {savingMessages ? "Guardando..." : "Guardar mensajes"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h3 className="text-base font-semibold">Nueva instancia</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-4 p-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Nombre de instancia</label>
                  <Input placeholder="mi-whatsapp" value={instanceName} onChange={(e) => setInstanceName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">URL de Evolution API</label>
                  <Input type="url" placeholder="https://your-api.railway.app" value={evolutionApiUrl} onChange={(e) => setEvolutionApiUrl(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">API Key</label>
                  <Input type="password" placeholder="Tu API key de Evolution" value={evolutionApiKey} onChange={(e) => setEvolutionApiKey(e.target.value)} />
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1 gap-2" onClick={() => void handleCreate()} disabled={saving || !instanceName || !evolutionApiUrl || !evolutionApiKey}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {saving ? "Creando..." : "Crear instancia"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
