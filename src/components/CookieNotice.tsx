"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "boti-cookies-notice-accepted";

/**
 * Aviso de cookies de la landing.
 * Solo usamos cookies estrictamente necesarias (sesión y seguridad) —
 * no hay tracking ni publicidad, por eso no hace falta un gestor de
 * consentimiento completo: basta con informar y permitir cerrar el aviso.
 */
export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Después de montar: solo se muestra si el usuario no lo cerró antes.
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "1") {
        setVisible(true);
      }
    } catch {
      // localStorage puede fallar en modo privado: mostramos el aviso igual.
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Si no se puede persistir, el aviso vuelve a aparecer en la próxima visita.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4"
    >
      <div className="ld-glass-panel mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#202c33]/95 p-4 shadow-2xl backdrop-blur-lg sm:flex-row sm:gap-6 sm:p-5">
        <span className="hidden shrink-0 text-2xl sm:block" aria-hidden>
          🍪
        </span>
        <p className="flex-grow text-center text-sm leading-relaxed text-text-secondary sm:text-left">
          Usamos <strong className="text-white">solo cookies estrictamente necesarias</strong> para
          mantener tu sesión y la seguridad del sitio. Sin publicidad ni seguimiento. Más detalle en
          nuestra{" "}
          <Link
            href="/privacidad"
            className="font-semibold text-whatsapp-green underline underline-offset-2 transition-colors hover:text-[#00a884]"
          >
            Política de Privacidad
          </Link>
          .
        </p>
        <button
          onClick={accept}
          className="w-full shrink-0 rounded-full bg-whatsapp-green px-6 py-2.5 font-label text-sm font-bold text-surface-dim transition-colors hover:bg-[#00a884] sm:w-auto"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
