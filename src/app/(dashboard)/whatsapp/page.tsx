"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Loader2, RefreshCw, LogOut, Check, X, ArrowRight, HelpCircle, ChevronDown, Smartphone, Info, RotateCcw, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type ConnectionState = "open" | "close" | "connecting" | "qrcode" | "unknown";

interface InstanceData {
  instanceId: string;
  instanceName: string;
  connectionState: ConnectionState;
  qrCode: string | null;
}

function ConnectedIllustration() {
  return (
    <div className="relative mx-auto w-fit">
      <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/20 blur-2xl" />
      <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 ring-4 ring-emerald-500/10">
        <Check className="h-12 w-12 text-emerald-500" />
      </div>
      <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
        <MessageCircle className="h-3 w-3 text-white" />
      </div>
    </div>
  );
}

function DisconnectedIllustration() {
  return (
    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-muted ring-4 ring-border">
      <MessageCircle className="h-12 w-12 text-muted-foreground/30" />
    </div>
  );
}

export default function WhatsAppPage() {
  const [instance, setInstance] = useState<InstanceData | null>(null);
  const [myInstances, setMyInstances] = useState<{ id: string; instance_name: string; status: string }[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noInstance, setNoInstance] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const query = selectedInstanceId ? `?instanceId=${encodeURIComponent(selectedInstanceId)}` : "";
      const res = await fetch(`/api/whatsapp${query}`);
      const payload = await res.json();

      if (payload.status === "success") {
        setInstance(payload.data);
        setLastUpdated(new Date());
        setNoInstance(false);
        return payload.data;
      } else if (res.status === 404) {
        setNoInstance(true);
      } else {
        setError(payload.error);
      }
    } catch {
      setError("No se pudo conectar al servidor");
    }
    return null;
  }, [selectedInstanceId]);

  useEffect(() => {
    const t = setTimeout(async () => {
      await loadStatus();
      setLoading(false);
    }, 0);
    return () => clearTimeout(t);
  }, [loadStatus]);

  useEffect(() => {
    if (!connecting) return;
    const interval = setInterval(async () => {
      const data = await loadStatus();
      if (data?.connectionState === "open" || data?.qrCode) {
        clearInterval(interval);
        setConnecting(false);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [connecting, loadStatus]);

  // Run-once on mount: resolves the instance list and picks a default for admins.
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/instances?lite=1");
        const payload = await res.json();
        if (payload.status === "success" && payload.data?.length > 0) {
          setMyInstances(payload.data);
          if (payload.role === "admin" && !selectedInstanceId) {
            setSelectedInstanceId(payload.data[0].id);
          }
        }
      } catch {
        /* non-critical */
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const query = selectedInstanceId ? `?instanceId=${encodeURIComponent(selectedInstanceId)}` : "";
      const res = await fetch(`/api/whatsapp${query}`, { method: "POST" });
      const payload = await res.json();
      if (payload.status !== "success") {
        setError(payload.error);
        toast.error(payload.error ?? "Error al conectar");
        setConnecting(false);
      } else {
        toast.success("Conectando...");
        await loadStatus();
      }
    } catch {
      setError("No se pudo conectar");
      toast.error("No se pudo conectar");
      setConnecting(false);
    }
  }

  async function handleRestart() {
    setRestarting(true);
    try {
      const query = selectedInstanceId ? `?instanceId=${encodeURIComponent(selectedInstanceId)}` : "";
      // Reusa POST /api/whatsapp para refrescar QR; si hay endpoint restart, el backend lo maneja
      const res = await fetch(`/api/whatsapp${query}`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (payload.status === "success") {
        toast.success("Instancia reiniciada — actualizando QR");
        await loadStatus();
      } else {
        toast.error(payload.error || "No se pudo reiniciar");
      }
    } catch {
      toast.error("Error al reiniciar");
    } finally {
      setRestarting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/whatsapp${selectedInstanceId ? `?instanceId=${encodeURIComponent(selectedInstanceId)}` : ""}`);
      const payload = await res.json();
      if (payload.status === "success" && payload.data?.connectionState === "open") toast.success("Conexión OK — bot en línea");
      else if (payload.data?.connectionState) toast.info(`Estado: ${payload.data.connectionState}`);
      else toast.error(payload.error || "Sin respuesta");
    } catch {
      toast.error("Error al probar conexión");
    } finally {
      setTesting(false);
    }
  }

  async function handleLogout() {
    if (!confirm("Tu WhatsApp se desconectará. Puedes volver a conectarlo después.")) return;
    try {
      const query = selectedInstanceId ? `?instanceId=${encodeURIComponent(selectedInstanceId)}` : "";
      const res = await fetch(`/api/whatsapp${query}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (payload.status !== "success" && res.status >= 400) {
        throw new Error(payload.error || "Error al desconectar");
      }
      toast.success("Desconectado");
      // Optimista: mostrar desconectado inmediato, evitar que un GET stale muestre "open"
      setInstance((prev) => (prev ? { ...prev, connectionState: "close", qrCode: null } : prev));
      setConnecting(false);
      // Verificación diferida (Evolution tarda en propagar)
      setTimeout(() => void loadStatus(), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al desconectar");
      toast.error(e instanceof Error ? e.message : "Error al desconectar");
      // Igual refrescar para mostrar estado real
      void loadStatus();
    }
  }

  const isConnected = instance?.connectionState === "open";

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-xl" />
            <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/25">
              <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-100">Mi WhatsApp</h1>
            <p className="text-xs text-slate-400">Conexión con Evolution API</p>
          </div>
          {isConnected && (
            <Badge className="gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 text-[10px]">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" /></span>
              Conectado
            </Badge>
          )}
          {myInstances.length > 1 && (
            <select value={selectedInstanceId} onChange={(e) => setSelectedInstanceId(e.target.value)} className="h-8 max-w-[140px] truncate rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-slate-200">
              {myInstances.map((i) => (<option key={i.id} value={i.id} className="bg-slate-900">{i.instance_name}</option>))}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="mx-auto h-24 w-24 rounded-full" />
              <Skeleton className="h-5 w-3/4 mx-auto" />
              <Skeleton className="h-3 w-1/2 mx-auto" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </CardContent>
          </Card>
        ) : noInstance ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-4 py-16 text-center">
            <DisconnectedIllustration />
            <div>
              <p className="text-lg font-semibold">Sin instancia asignada</p>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">El administrador debe asignarte una instancia de WhatsApp para poder conectar</p>
            </div>
          </motion.div>
        ) : (
          <div className="mx-auto w-full max-w-sm space-y-4">
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="flex items-center gap-2 p-3 text-xs text-destructive">
                      <X className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1">{error}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setError(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isConnected ? (
                <motion.div key="connected" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <Card className="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
                    <CardContent className="p-8 text-center">
                      <ConnectedIllustration />
                      <p className="mt-4 text-xl font-bold text-slate-100">Conectado</p>
                      <p className="mt-1 text-sm text-slate-400">{instance?.instanceName}</p>
                      <Badge className="mt-3 gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-400/20">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        En línea
                      </Badge>
                    </CardContent>
                  </Card>

                  <Button variant="outline" className="w-full" onClick={() => void loadStatus()}>
                    <RefreshCw className="h-4 w-4" />
                    Verificar estado
                  </Button>

                  <Button variant="destructive" className="w-full" onClick={() => void handleLogout()}>
                    <LogOut className="h-4 w-4" />
                    Desconectar
                  </Button>
                </motion.div>
              ) : instance?.qrCode ? (
                <motion.div key="qr" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="mb-1 text-base font-semibold">Escanea el código QR</p>
                      <p className="mb-5 text-xs text-muted-foreground">
                        Abre WhatsApp en tu teléfono, ve a <span className="font-medium text-foreground">Configuración</span> &gt;{" "}
                        <span className="font-medium text-foreground">Dispositivos vinculados</span> &gt;{" "}
                        <span className="font-medium text-foreground">Vincular dispositivo</span>
                      </p>

                      <div className="mx-auto w-56 overflow-hidden rounded-xl bg-white p-2 shadow-lg">
                        <Image src={instance.qrCode} alt="Código QR para conectar WhatsApp" width={208} height={208} unoptimized className="h-auto w-full" />
                      </div>

                      {connecting && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-600">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Esperando conexión...
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Button variant="outline" className="w-full" onClick={() => void loadStatus()}>
                    <RefreshCw className="h-4 w-4" />
                    Actualizar código
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="disconnected" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <Card className="overflow-hidden border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent backdrop-blur-md shadow-xl shadow-black/30">
                    <CardContent className="p-8 text-center">
                      <DisconnectedIllustration />
                      <p className="mt-4 text-lg font-semibold text-slate-100">Conecta tu WhatsApp</p>
                      <p className="mt-1 text-sm text-slate-400">{instance?.instanceName}</p>
                      <p className="mt-2 text-xs text-slate-500">Necesitas tu teléfono para escanear el código QR</p>
                    </CardContent>
                  </Card>

                  <Button onClick={() => void handleConnect()} disabled={connecting} className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-semibold shadow-lg shadow-emerald-500/30" size="lg">
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                    {connecting ? "Conectando..." : "Conectar WhatsApp"}
                    {!connecting && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Estado detallado */}
            {instance && !noInstance && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Info className="h-3.5 w-3.5 text-primary" /> Detalles
                    <Badge variant="secondary" className="ml-auto text-[10px] font-mono">{instance.connectionState}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Instancia</span>
                    <span className="font-mono font-medium">{instance.instanceName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Actualizado</span>
                    <span className="text-muted-foreground">{lastUpdated ? lastUpdated.toLocaleTimeString("es-AR") : "—"}</span>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadStatus()} className="text-xs w-full">
                      <RefreshCw className="h-3.5 w-3.5" /> Verificar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleTest()} disabled={testing} className="text-xs w-full">
                      {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />} Probar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleRestart()} disabled={restarting} className="text-xs w-full">
                      {restarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reiniciar
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Reiniciar ayuda si el QR no carga o Railway estuvo dormido.</p>
                </CardContent>
              </Card>
            )}

            {/* Ayuda contextual */}
            <Card className="overflow-hidden">
              <button type="button" onClick={() => setHelpOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-accent/50">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><HelpCircle className="h-4 w-4" /></div>
                <div className="flex-1">
                  <p className="text-xs font-semibold">¿Cómo conectar?</p>
                  <p className="text-[11px] text-muted-foreground">Pasos + solución de problemas</p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${helpOpen ? "rotate-180" : ""}`} />
              </button>
              {helpOpen && (
                <div className="border-t border-border p-4 space-y-3 text-xs">
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">1</div>
                    <div><p className="font-medium flex items-center gap-1"><Smartphone className="h-3 w-3" /> Abrí WhatsApp en tu celular</p><p className="text-muted-foreground">Configuración → Dispositivos vinculados</p></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">2</div>
                    <div><p className="font-medium">Tocá “Vincular dispositivo”</p><p className="text-muted-foreground">Se abrirá la cámara para escanear</p></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">3</div>
                    <div><p className="font-medium">Escaneá el QR de esta pantalla</p><p className="text-muted-foreground">Mantené el teléfono cerca hasta ver “Conectado”</p></div>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="font-semibold">Si no funciona:</p>
                    <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                      <li>QR borroso o vencido → Tocá “Actualizar código” o “Reiniciar”</li>
                      <li>Aparece conectado pero no responde → “Probar” y luego “Verificar estado”</li>
                      <li>Desconectar borra la sesión — podés reconectar sin perder respuestas</li>
                    </ul>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
