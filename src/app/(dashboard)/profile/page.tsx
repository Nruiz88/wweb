"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Profile } from "@/lib/db/types";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  User,
  Shield,
  MessageCircle,
  Link2,
  CalendarDays,
  Mail,
  Store,
  Phone,
  MapPin,
  Sparkles,
} from "lucide-react";

const profileSchema = z.object({
  full_name: z.string().min(2, "Mínimo 2 caracteres"),
  business_name: z.string().min(2, "Mínimo 2"),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof profileSchema>;

// Avatar with gradient ring
function ProfileAvatar({ name, role }: { name: string; role?: string }) {
  const initial = name?.[0]?.toUpperCase() || "?";
  const isAdmin = role === "admin";

  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-4 ring-primary/10 text-2xl font-bold text-primary">
        {initial}
      </div>
      {isAdmin && (
        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
          <Shield className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

// Info card using Card
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-2xl transition hover:shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium">{value || "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  /* El tipo ya no lleva `subscription`: la API no lo manda. Antes sí, y
     por eso la página tenía una tarjeta "Mi Plan" que murió con los
     planes de Nexo Studio. */
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  /* El slug del bot, para el enlace público. Viene de la API: aquí no se
     calcula nada, porque cualquier slug inventado da un enlace roto. */
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);
  const [upcoming, setUpcoming] = useState<{ date: string; time: string; name: string | null }[] | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: "", business_name: "", phone: "", address: "" },
  });

  const watchedBusinessName = watch("business_name") || "";
  const watchedPhone = watch("phone") || "";

  // El origin solo existe en el cliente; se setea tras hidratar para no
  // romper el prerender de Vercel (window no existe en el servidor).
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(t);
  }, []);

  /* El enlace público de la agenda.

     ANTES se armaba aquí con `slugify(nombre del negocio) || slugify(email)`
     y la forma `/agendar?business=<eso>`. Las dos cosas estaban mal: la
     ruta correcta es `/agendar/<slug>` sin query, y ese slug no era el del
     bot, sino uno improvisado aquí. Que coincidieran era casualidad, y si
     no coincidían el cliente copiaba un enlace que devolvía 404 a sus
     clientes. No había forma de que se notara hasta que alguien lo abría.

     Ahora el slug viene de `/api/profile`, que lo saca de la fila del bot
     con RLS. Si no hay bot, no hay enlace: es mejor no mostrar uno que
     mostrar uno roto. */
  const publicAgendaLink = useMemo(() => {
    if (!origin || !slug) return null;
    return `${origin}/agendar/${encodeURIComponent(slug)}`;
  }, [origin, slug]);

  async function copyLink() {
    if (!publicAgendaLink) return;
    try {
      await navigator.clipboard.writeText(publicAgendaLink);
      setCopied(true);
      toast.success("Link copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  // Próximos turnos: agregados en el servidor (?include=upcoming, 1 roundtrip).
  // Antes era N+1 en el cliente (1x instances + Nx appointments).
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile?include=upcoming");
      const payload = await res.json();
      if (payload.status === "success") {
        const p = payload.data;
        setProfile(p);
        reset({ full_name: p.full_name || "", business_name: p.business_name || "", phone: p.phone || "", address: p.address || "" });
        setEmail(p.email || "");
        setSlug(p.slug || "");
        setUpcoming(Array.isArray(p.upcoming) ? p.upcoming : []);
      }
    } catch {
      /* non-critical */
    }
    setLoading(false);
  }, [reset]);

  useEffect(() => {
    const t = setTimeout(() => void loadProfile(), 0);
    return () => clearTimeout(t);
  }, [loadProfile]);

  const onSubmit = handleSubmit(async (data) => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: data.full_name, business_name: data.business_name, phone: data.phone, address: data.address }),
      });
      const payload = await res.json();
      if (payload.status === "success") {
        toast.success("Perfil actualizado");
        setProfile(payload.data);
        reset({ full_name: payload.data.full_name || "", business_name: payload.data.business_name || "", phone: payload.data.phone || "", address: payload.data.address || "" });
      } else {
        toast.error(payload.error);
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header Card */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mi Perfil</CardTitle>
          <CardDescription className="text-xs">Gestioná tu información personal y configuración</CardDescription>
        </CardHeader>
      </Card>

      {/* Content */}
      <div className="mt-4 flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="mx-auto max-w-lg space-y-4">
            <Card className="rounded-2xl">
              <CardContent className="flex items-center gap-4 p-6">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}
            className="mx-auto max-w-lg space-y-4"
          >
            {/* Profile card */}
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
              <Card className="relative overflow-hidden rounded-2xl">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
                <CardContent className="relative flex items-center gap-4 p-6">
                  <ProfileAvatar name={profile?.full_name || profile?.email || ""} role={profile?.role} />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{profile?.full_name || "Sin nombre"}</p>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={profile?.role === "admin" ? "default" : "secondary"} className="gap-1 rounded-full text-[11px]">
                        {profile?.role === "admin" ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {profile?.role === "admin" ? "Administrador" : "Usuario"}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground/60">
                        Miembro desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("es-AR") : ""}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick info cards */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <InfoCard icon={<Store className="h-4 w-4" />} label="Negocio" value={watchedBusinessName} />
              <InfoCard icon={<Phone className="h-4 w-4" />} label="Teléfono" value={watchedPhone} />
            </motion.div>

            {/* La tarjeta de "Mi Plan" se eliminó entera.

               Estaba metida en un `profile?.subscription && ...` y
               /api/profile dejó de devolver `subscription` cuando los
               planes pasaron a Nexo Studio. Eso la dejaba en código
               muerto: nunca se veía, pero seguía ahí con sus referencias
               a `plan_type`, `addons` y `max_instances`, listas para
               volver a aparecer si alguien tocaba la API.

               Si algún día hay que mostrar el plan, sale de
               `suscripciones` y se lee aquí: no de un campo que el bot
               ya no tiene. */}

            {/* Public agenda card */}
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Agenda pública</CardTitle>
                      <CardDescription className="text-xs">Compartí este link para que tus clientes agenden solos</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {publicAgendaLink ? (
                    <>
                      <div className="flex gap-2">
                        <Input value={publicAgendaLink} readOnly className="font-mono text-xs" />
                        <Button onClick={() => void copyLink()} variant="outline" className="shrink-0 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300">
                          {copied ? <Check className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                          {copied ? "¡Copiado!" : "Copiar"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Antes decía "cargá el nombre de tu negocio", que era lo que pasaba
                          cuando el slug se armaba aquí. Ahora el enlace depende del bot: si no
                          hay bot, no hay agenda pública que enlazar, y el nombre del negocio
                          no cambia nada. */}
                      <p className="text-xs text-muted-foreground">
                        Tu enlace aparece cuando tu bot esté creado. Nexo Studio lo prepara al
                        activar la suscripción.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Upcoming appointments */}
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Próximos turnos</CardTitle>
                      <CardDescription className="text-xs">Próximos 14 días</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {upcoming === null ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
                          <Skeleton className="h-9 w-14 shrink-0 rounded-lg" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : upcoming.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No hay turnos próximos.</p>
                  ) : (
                    <div className="space-y-2">
                      {upcoming.map((a, i) => {
                        const d = new Date(a.date + "T12:00:00");
                        const day = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d.getDay()];
                        const time = a.time.slice(0, 5);
                        return (
                          <Card key={i} className="rounded-xl border-muted">
                            <CardContent className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                                  <span className="text-[11px] font-bold">{time}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{a.name || "Sin nombre"}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {day} {d.getDate()}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Form */}
            <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-sm">Editar datos</CardTitle>
                  <CardDescription className="text-xs">Actualizá tu información de perfil</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onSubmit} className="space-y-4">
                    {/* Email (read-only) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Mail className="h-3 w-3" /> Email
                      </label>
                      <Input type="email" value={email} disabled className="opacity-60" />
                      <p className="text-[10px] text-muted-foreground/60">No se puede cambiar</p>
                    </div>

                    {/* Full Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <User className="h-3 w-3" /> Nombre y Apellido
                      </label>
                      <Input type="text" placeholder="Juan Perez" {...register("full_name")} />
                      {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
                    </div>

                    {/* Business Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Store className="h-3 w-3" /> Local / Emprendimiento
                      </label>
                      <Input type="text" placeholder="Mi negocio" {...register("business_name")} />
                      {errors.business_name && <p className="text-xs text-destructive">{errors.business_name.message}</p>}
                    </div>

                    {/* Phone */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Phone className="h-3 w-3" /> Teléfono
                      </label>
                      <Input type="tel" placeholder="+54 11 1234-5678" {...register("phone")} />
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                    </div>

                    {/* Address */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <MapPin className="h-3 w-3" /> Dirección
                      </label>
                      <Input type="text" placeholder="Av. Principal 1234, Ciudad" {...register("address")} />
                      {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
                    </div>

                    <Separator />

                    {/* Save button */}
                    <Button
                      type="submit"
                      disabled={saving || !isDirty}
                      className="w-full gap-2 bg-gradient-to-r from-primary to-emerald-500 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
