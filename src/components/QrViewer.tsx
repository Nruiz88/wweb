"use client";

import { CheckIcon, LoaderIcon } from "@/components/icons";

interface QrViewerProps {
  qrcode: string | null;
  state: string | null;
  loading?: boolean;
}

export function QrViewer({ qrcode, state, loading }: QrViewerProps) {
  const connected = state?.toLowerCase() === "open";

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative w-full max-w-64">
        <div
          className="absolute -inset-4 rounded-[2rem] bg-emerald-500/10 blur-2xl"
          aria-hidden
        />

        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white p-3 shadow-2xl shadow-black/40">
          <span className="pointer-events-none absolute left-3 top-3 h-6 w-6 rounded-tl-lg border-l-2 border-t-2 border-emerald-500" />
          <span className="pointer-events-none absolute right-3 top-3 h-6 w-6 rounded-tr-lg border-r-2 border-t-2 border-emerald-500" />
          <span className="pointer-events-none absolute bottom-3 left-3 h-6 w-6 rounded-bl-lg border-b-2 border-l-2 border-emerald-500" />
          <span className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 rounded-br-lg border-b-2 border-r-2 border-emerald-500" />

          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <LoaderIcon className="h-8 w-8 animate-spin text-slate-500" />
              <p className="text-sm">Cargando código QR…</p>
            </div>
          ) : qrcode ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrcode}
                alt="Código QR de WhatsApp"
                className="h-full w-full object-contain"
              />
              <span className="scan-line pointer-events-none absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/90 to-transparent" />
            </>
          ) : connected ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <CheckIcon className="h-7 w-7" />
              </span>
              <p className="text-sm text-emerald-600">
                Sesión activa.
                <br />
                No se requiere código QR.
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-400">
              Sin código QR disponible.
              <br />
              Presiona actualizar para intentar de nuevo.
            </p>
          )}
        </div>
      </div>

      {qrcode && (
        <p className="max-w-64 text-center text-xs leading-relaxed text-slate-400">
          Escanea el código con WhatsApp desde{" "}
          <span className="font-medium text-slate-200">
            Ajustes → Dispositivos vinculados
          </span>
          .
        </p>
      )}
    </div>
  );
}
