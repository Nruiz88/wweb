"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle } from "lucide-react";

export default function SubscriptionStatus() {
  const [sub, setSub] = useState<{ plan_type: string; status: string; paid_until?: string | null; max_instances: number } | null>(null);

  useEffect(() => {
    async function loadSub() {
      try {
        const res = await fetch("/api/profile?lite=1");
        if (res.ok) {
          const data = await res.json();
          if (data.data?.subscription) setSub(data.data.subscription);
        }
      } catch {
        // ignore
      }
    }
    loadSub();
  }, []);

  /* eslint-disable react-hooks/purity -- time-based UI badge, re-evaluated each render */
  const isExpiringSoon = sub?.paid_until
    ? new Date(sub.paid_until).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
    : false;
  /* eslint-enable react-hooks/purity */

  return (
    <Card className="p-5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600" />
          Estado de suscripción
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Plan</span>
          <Badge variant={sub?.plan_type === "pro" ? "default" : "secondary"} className="text-[11px]">
            {sub?.plan_type === "pending" ? "Pendiente" : sub?.plan_type === "pro" ? "Pro" : sub?.plan_type || "Starter"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Estado</span>
          <Badge variant={sub?.status === "active" ? "outline" : "destructive"} className="text-[11px]">
            {sub?.status === "pending" ? "Pendiente" : sub?.status || "Inactivo"}
          </Badge>
        </div>
        {sub?.paid_until && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Vence</span>
            <span className={`text-xs font-medium ${isExpiringSoon ? "text-red-600" : "text-foreground"}`}>
              {new Date(sub.paid_until).toLocaleDateString("es-AR")}
            </span>
          </div>
        )}
        {isExpiringSoon && (
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Tu plan vence en menos de 3 días. Renovalo para no perder el acceso.
          </div>
        )}
      </CardContent>
    </Card>
  );
}