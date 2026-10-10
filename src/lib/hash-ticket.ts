/* =========================================================
   Leer el ticket del fragmento
   ---------------------------------------------------------
   Un archivo para una línea. Existe porque esa línea estuvo mal y costó
   que nadie pudiera entrar al bot.

   QUÉ PASÓ
   --------
   La página hacía esto:

       window.location.hash.replace(/^#/, "").trim()

   Eso quita la almohadilla pero deja el `ticket=` pegado: el servidor
   recibía `ticket=eyJ1aWQi...` en vez de `eyJ1aWQi...`. No es base64url,
   así que la verificación fallaba y la respuesta era 401. Siempre.

   O sea: la entrada al bot NO funcionó nunca desde un navegador. Y todas
   las pruebas给出的 verde, porque las pruebas hacen el POST ellas
   mismas con el ticket ya limpio y se saltan el fragmento entero. Nadie
   ejecutó esta línea hasta que una persona lo hizo.

   POR QUÉ ESTÁ EN UN ARCHIVO Y NO EN LA PÁGINA
   --------------------------------------------
   Para que se pueda probar de verdad. Importar el componente entero
   arrastraría React y el `useEffect` no se puede ejecutar sin un DOM. Con
   el parseo aquí, la prueba usa ESTE código y no una copia: cuando la
   página llame a esta función, lo que se prueba es lo que corre.

   Es lo contrario de lo que se suele hacer, que es copiar el código a la
   prueba: esa copia se queda vieja el primer día que cambia el original
   y sigue dando verde mientras el bug vuelve. */
export function ticketDelHash(hash: string): string {
  const bruto = (hash || "").replace(/^#/, "").trim();

  /* El `&` corta por si el fragmento trae más pares. Hoy no los trae,
     pero mandarlos pegados haría que el servidor lo rechazara por algo
     que no es el ticket. */
  return bruto.replace(/^ticket=/, "").split("&")[0].trim();
}

/**
 * ¿El enlace trae un ticket usable?
 *
 * Distinto de "el hash está vacío": un enlace puede traer texto que no es
 * un ticket (un enlace viejo, una URL mal pegada) y eso tiene que
 * llegar al servidor para que lo rechace con su mensaje, no desaparecer
 * aquí y que la página asuma que no hay enlace.
 */
export function hayTicket(hash: string): boolean {
  return ticketDelHash(hash).length > 0;
}