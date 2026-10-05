/* =========================================================
   Nexo Studio — La página de entrada, lo que hace el navegador
   ---------------------------------------------------------
   ESTA PRUEBA EXISTE POR UN BUG CONCRETO.

   La página /entrar leía el hash con `.replace(/^#/, "")`, lo que deja
   el prefijo `ticket=` pegado al principio. El servidor recibía
   `ticket=eyJ1aWQi...` en vez de `eyJ1aWQi...`, no lo reconocía como
   base64url, y contestaba 401 a todo el mundo.

   Es decir: la entrada al bot NUNCA funcionó desde un navegador. Y todas
   las pruebas pasaban, porque las pruebas hacen el POST ellas mismas y
   se saltan el fragmento entero. Este fichero es el que ejecutaba el
   código que estaba mal.

   El patrón que se repite aquí: lo que se puede probar sin navegador
   da verde, y el fallo que queda solo aparece al abrir el enlace.

   LA REGLA QUE APRENDE ESTE FICHERO
   ---------------------------------
   Todo lo que lee el hash tiene que estar probado contra un hash de
   verdad, con la misma forma que pone el panel. Un caso "corto" que se
   parece al bueno no lo detecta: el prefijo `ticket=` son 7 caracteres
   y un ticket mal cortado falla igual.
   ========================================================= */

import { describe, it, expect } from "vitest";
import { ticketDelHash, hayTicket } from "./hash-ticket";

/* El hash, tal cual lo pone el panel:
   https://bot.panel-niconqn.duckdns.org/entrar#ticket=<base64url>.<firma> */
const HASH_REAL = "#ticket=eyJ1aWQiOiIyOGQ1YWUyMS1lYjZmLTQzNzYtYWMwZS0yOTY3MWJhOWY4NjYiLCJjaWQiOiJhYmExNWM1OSIsInJvbCI6ImNsaWVudCIsInNpZCI6bnVsbCwiYXQiOiJ4IiwiaXQiOiIwIiwiZXhwIjoxNzkyMTI3NDgzLCJqdGkiOiJhYmMxIn0.Z2Kg6QgWr8tEUgeds8ft9cMbn0g8";

/* Con lo que el panel manda si algún día el fragmento trae más cosas
   detrás. El `?next=` va en la QUERY, no en el fragmento, así que hoy
   esto no ocurre — pero si el hash admite `ticket=x&otro=y`, el código
   tiene que quedarse con lo primero. */
const HASH_CON_NEXT = "#ticket=eyJ1aWQiOiJ4In0.Z2Kg6QgWr8tEUgeds8ft9cMbn0g8&otro=valor";

/**
 * ESTE ES EL CÓDIGO REAL, no una copia. La página importa
 * `ticketDelHash` de aquí, así que lo que se prueba es lo que corre.
 *
 * Antes la página tenía el parseo escrito dentro y la prueba lo copiaba.
 * Esa copia se queda vieja el primer día que el original cambia y sigue
 * dando verde mientras el bug vuelve. */
function leerTicket(hash: string): string {
  return ticketDelHash(hash);
}

/** Cómo lo hacía ANTES, que es el bug. Se deja para que se vea. */
function leerTicketConElBug(hash: string): string {
  return hash.replace(/^#/, "").trim();
}

describe("leer el ticket del hash", () => {
  it("quita el prefijo 'ticket=' y no solo la almohadilla", () => {
    /* Este es EL caso. Con el bug, esto devolvía
       'ticket=eyJ1aWQi...' y el servidor lo rechazaba siempre. */
    expect(leerTicket(HASH_REAL)).toBe(HASH_REAL.slice("#ticket=".length));
  });

  it("lo que devuelve es exactamente lo que firmó el panel", () => {
    const ticket = leerTicket(HASH_REAL);
    expect(ticket.startsWith("eyJ1aWQi")).toBe(true);
    expect(ticket).not.toContain("ticket=");
  });

  it("el resultado es base64url con un punto: lo que el verificador espera", () => {
    const ticket = leerTicket(HASH_REAL);
    /* base64url: solo letras, dígitos, guion y guion bajo. */
    expect(ticket).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("con más cosas en el hash, se queda con el ticket", () => {
    const ticket = leerTicket(HASH_CON_NEXT);
    expect(ticket).toBe(HASH_CON_NEXT.slice("#ticket=".length).split("&")[0]);
  });

  it("sin hash no devuelve nada, y la página manda al panel", () => {
    expect(leerTicket("")).toBe("");
    expect(leerTicket("#")).toBe("");
  });

  it("un ticket corto o corrupto NO se limpia por accidente", () => {
    /* Un hash que no empieza por 'ticket=' se devuelve tal cual, para
       que el servidor lo rechace. Silenciarlo y devolver "" haría que
       la página creyera que no hay enlace y mandara al panel, que es
       un fallo distinto y más difícil de ver. */
    expect(leerTicket("#basura")).toBe("basura");
  });

  it("hayTicket distingue 'no hay enlace' de 'el enlace está roto'", () => {
    /* Los dos tienen que ser falsos para la página, pero por motivos
       distintos: uno manda al panel, el otro deja que el servidor
       conteste. Lo que NO puede pasar es que un enlace roto se trate
       como si no existiera. */
    expect(hayTicket("")).toBe(false);
    expect(hayTicket("#")).toBe(false);
    expect(hayTicket("#ticket=")).toBe(false);
    expect(hayTicket("#basura")).toBe(true);
    expect(hayTicket(HASH_REAL)).toBe(true);
  });
});

describe("el bug que había", () => {
  /* No es una prueba del código actual: es la que demuestra por qué
     hace falta la de arriba. Si alguien "arregla" el parseo y vuelve a
     quitar solo la almohadilla, esto sigue dando verde y la otra se
     pone roja. */
  it("el parseo antiguo devolvía el prefijo pegado", () => {
    const malo = leerTicketConElBug(HASH_REAL);
    expect(malo.startsWith("ticket=")).toBe(true);
    expect(malo.length).toBe(leerTicket(HASH_REAL).length + "ticket=".length);
  });

  it("y ese resultado NO es lo que el verificador acepta", () => {
    /* La diferencia real: el verificador de lib/tickets.ts corta por el
       ÚLTIMO punto y hace base64url del cuerpo. Con 'ticket=' delante,
       el cuerpo no es base64url y falla. */
    const malo = leerTicketConElBug(HASH_REAL);
    const cuerpoMalo = malo.slice(0, malo.lastIndexOf("."));
    const cuerpoBueno = leerTicket(HASH_REAL).slice(0, leerTicket(HASH_REAL).lastIndexOf("."));

    /* Buffer.from no lanza con base64url inválido: devuelve basura en
       lugar de fallar. Por eso el bug se manifestaba como un JSON que no
       se podía leer, y no como un error visible. */
    const jsonMalo = Buffer.from(cuerpoMalo, "base64url").toString("utf8");
    const jsonBueno = Buffer.from(cuerpoBueno, "base64url").toString("utf8");

    expect(() => JSON.parse(jsonBueno)).not.toThrow();
    expect(() => JSON.parse(jsonMalo)).toThrow();
  });
});