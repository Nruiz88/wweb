/* =========================================================
   La dirección del panel de Nexo Studio
   ---------------------------------------------------------
   El bot y el panel son dos servicios distintos en dos dominios
   distintos, pero el bot necesita volver al panel: cuando un ticket
   llega corrupto, cuando se cierra sesión, cuando la suscripción
   caduca y cuando alguien tiene que revisar su cuenta.

   Antes esas cuatro pantallas llevaban el dominio escrito a fuego
   ("https://panel.midominio.com"). El resultado era que en el
   despliegue real el botón decía "Volver al panel" y no llevaba a
   ningún sitio: el dominio de ejemplo se había quedado puesto.

   Por eso la URL sale de una variable, NEXT_PUBLIC_PANEL_URL.

   El prefijo NEXT_PUBLIC_ no es opcional aquí: estas pantallas se
   pintan en el navegador, donde el process.env del servidor no
   existe. Next.js lo sustituye al compilar, y eso tiene un precio:
   el valor queda DENTRO del JavaScript que baja el usuario, así que
   no puede ser un secreto. No lo es: es la dirección pública del
   panel. Lo que NO puede acabar en el bundle es SERVICE_SECRET.
   ========================================================= */

const configurada = (process.env.NEXT_PUBLIC_PANEL_URL || "").trim().replace(/\/+$/, "");

/* Si no está puesta, se usa el dominio de desarrollo. Es un valor que
   se ve enseguida al probar, y peor que un dominio equivocado es un
   enlace que no lleva a ninguna parte. */
const PANEL = configurada || "http://127.0.0.1:3000";

/* La pantalla de servicios del cliente, que es a donde se vuelve
   siempre: tanto si el problema es de la suscripción como si solo es
   que el enlace del bot llegó mal. */
export const MIS_SERVICIOS = PANEL + "/panel/mis-servicios";

export const MI_CUENTA = PANEL + "/panel/mi-cuenta";