/* =========================================================
   Nexo Studio — Auth del bot
   ---------------------------------------------------------
   ESTE FICHERO ESTÁ VACÍO A PROPÓSITO. No lo borres sin leer esto.

   ANTES
   -----
   Aquí estaba todo el sistema de identidad del bot: bcrypt para las
   contraseñas, JWT firmado con `JWT_SECRET`, una cookie
   `wweb_session` de 30 días, y las consultas a la tabla `profiles` de
   MariaDB para crear y leer usuarios.

   AHORA
   -----
   Nada de eso. El bot no tiene usuarios propios:
     · la entrada es `src/lib/sesion.ts` (cookie `nexo_bot`)
     · el ticket se valida en `src/lib/tickets.ts`
     · la comprobación de "de quién son estos datos" la hace RLS

   El archivo se conserva vacío para que quien lo encuentre y pregunte
   por qué no hay nada, lea la respuesta aquí en vez de tener que
   buscar en el historial de git.

   Lo mismo con `src/lib/auth/client.ts`, `src/lib/auth/server.ts` y
   `src/lib/auth/middleware.ts`: quedan vacíos por la misma razón.

   QUÉ PASÓ CON LOS USUARIOS
   -------------------------
   Los usuarios del bot ahora son los clientes de Nexo Studio. Antes un
   cliente del bot era un usuario aparte, con su propia contraseña en su
   propia tabla, y podía no coincidir con el que tenía en el panel: dos
   sitios donde perder el acceso y dos sesiones que nadie knew unlink.

   Y el sistema de planes entero (`plans`, `subscriptions`,
   `plan_config`, `mercado_pago_config`) desapareció por lo mismo: el
   cobro lo hace Nexo Studio, en su tabla `suscripciones`. Un producto
   que cobra dos veces por lo mismo.

   ⚠️  LO QUE FALTA TODAVÍA
   -----------------------
   Este fichero estaba vacío pero SUS DEPENDIENTES (las rutas de
   `src/app/api/*` y las páginas de `(dashboard)`) todavía lo
   importaban, y ahora usan `getSession()` de `sesion.ts`. Quedan por
   migrar, así que el panel del bot todavía no arranca de punta a
   punta. Ver PENDIENTES.md.
   ========================================================= */

export {};