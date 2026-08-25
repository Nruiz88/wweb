"use client";

interface QrViewerProps {
  qrcode: string | null;
  state: string | null;
  loading?: boolean;
}

export function QrViewer({ qrcode, state, loading }: QrViewerProps) {
  const connected = state?.toLowerCase() === "open";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex aspect-square w-full max-w-72 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-white p-3">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
            <p className="text-sm">Cargando código QR…</p>
          </div>
        ) : qrcode ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrcode}
            alt="Código QR de WhatsApp"
            className="h-full w-full object-contain"
          />
        ) : connected ? (
          <p className="text-center text-sm text-emerald-400">
            Sesión activa.
            <br />
            No se requiere código QR.
          </p>
        ) : (
          <p className="text-center text-sm text-slate-400">
            Sin código QR disponible.
            <br />
            Presiona actualizar para intentar de nuevo.
          </p>
        )}
      </div>

      {qrcode && (
        <p className="max-w-72 text-center text-xs text-slate-500">
          Escanea el código con WhatsApp desde <span className="text-slate-300">Ajustes → Dispositivos vinculados</span>.
        </p>
      )}
    </div>
  );
}
