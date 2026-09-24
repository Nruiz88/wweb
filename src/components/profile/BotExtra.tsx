"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function BotExtra() {
  const [, setAddons] = useState<{ quantity: number; status: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadAddons() {
      // This endpoint could be added; for now show placeholder
      setAddons({ quantity: 0, status: "none" });
    }
    loadAddons();
  }, []);

  const handleBuyBot = async () => {
    setLoading(true);
    try {
      // Call preference endpoint for addon bot (simplified)
      toast.info("Funcionalidad de bot extra disponible a futuro (requiere endpoint de add-on)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="h-4 w-4 text-green-600" />
          Bot extra
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Contratá un bot adicional para tu instancia. Cada bot extra aumenta tu límite de conexiones.
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Actual: <strong>0 bots extra</strong></span>
          <span>|</span>
          <span>Precio: <strong>$5.000/mes</strong></span>
        </div>
        <Button size="sm" onClick={handleBuyBot} disabled={loading} className="w-full">
          {loading ? "Procesando..." : "Contratar bot extra"}
        </Button>
      </CardContent>
    </Card>
  );
}