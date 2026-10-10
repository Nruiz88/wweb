"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/* =========================================================
   Usuario del bot
   ---------------------------------------------------------
   SUSTITUYE a `components/plan-context.tsx`, que se borró con el
   sistema de planes.

   Qué cambia y qué no:
     · ANTES el contexto cargaba el `subscription` del bot para saber
       el `plan_type` (starter/pro), y las páginas lo usaban para
       ocultar navegación y poner un paywall.
     · AHORA no hay plan. Quien entra en este panel ya tiene el bot
       contratado: lo comprueba el proxy (`tieneElModulo`) en cada
       petición. Así que lo único que hace falta aquí es el nombre y el
       rol, para pintar la cabecera.

   Se conserva el "un solo fetch compartido": las páginas del dashboard
   hacen varias consultas a /api/profile (o a /api/instances), y sin
   contexto cada una repetiría la petición de identidad.

   ⚠️  POR QUÉ NO SE USA EL `GET /api/profile` PARA EL ROL
   El endpoint devuelve nombre y email del cliente, no el rol de
   Supabase Auth. El rol vive en la sesión del servidor (tabla
   `bot_sesiones`), y sacarlo en el cliente obligaría a exponerlo en
   alguna respuesta. Para este panel solo hace falta el nombre; el rol
   se usa en el servidor.
   ========================================================= */

export interface Usuario {
  nombre: string;
  email: string;

  /* Si esta sesión es de soporte, y por qué entra.
     Lo envía /api/profile. Ver la nota del bloque `soporte` en esa
     ruta: es para la banda de arriba, no para ampliar nada. */
  soporte?: { activo: boolean; motivo?: string; cliente?: string };
}

interface ContextoUsuario {
  usuario: Usuario | null;
  cargando: boolean;
}

const Contexto = createContext<ContextoUsuario>({ usuario: null, cargando: true });

export function UsuarioProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        if (!r.ok) throw new Error("profile " + r.status);
        const datos = (await r.json()) as { data?: Usuario };
        if (vivo) setUsuario(datos.data ?? null);
      } catch {
        /* Si falla, el nombre sale vacío y se muestra "Cliente". No es
           motivo para romper la página entera: la identidad es cosmetica
           y el proxy ya garantiza que hay sesión y suscripción. */
        if (vivo) setUsuario(null);
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  return <Contexto.Provider value={{ usuario, cargando }}>{children}</Contexto.Provider>;
}

export const useUsuario = () => useContext(Contexto);