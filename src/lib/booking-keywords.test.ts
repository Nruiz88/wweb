import { describe, expect, it } from "vitest";
import { matchPalabraAgenda, normalizarParaBuscar, PALABRAS_AGENDA } from "./booking-keywords";

describe("normalizarParaBuscar", () => {
  it("baja a minúsculas", () => {
    expect(normalizarParaBuscar("TURNO")).toBe("turno");
  });

  it("saca las tildes", () => {
    expect(normalizarParaBuscar("Turnó")).toBe("turno");
  });
});

describe("matchPalabraAgenda", () => {
  it("matchea 'turno' con y sin mayúsculas", () => {
    expect(matchPalabraAgenda("turno")).toEqual({ palabra: "turno", propia: false });
    expect(matchPalabraAgenda("TURNO")).toEqual({ palabra: "turno", propia: false });
    expect(matchPalabraAgenda("Turnó")).toEqual({ palabra: "turno", propia: false });
  });

  it("matchea dentro de una frase, no solo como palabra exacta", () => {
    // El cliente escribe "hola, quiero sacar un turno por favor".
    expect(matchPalabraAgenda("hola, quiero sacar un turno por favor")).not.toBeNull();
  });

  it("reconoce todas las palabras de siempre", () => {
    for (const k of PALABRAS_AGENDA) {
      expect(matchPalabraAgenda(k)).toEqual({ palabra: k, propia: false });
    }
  });

  it("no matchea un mensaje que no habla de turnos", () => {
    expect(matchPalabraAgenda("¿cuánto sale el pan?")).toBeNull();
  });

  it("ignora una palabra propia demasiado corta", () => {
    // Con una sola letra, la letra estaría en todos los mensajes y el bot
    // mostraría la agenda a todo lo que le escriban.
    expect(matchPalabraAgenda("hola qué tal", "a")).toBeNull();
    expect(matchPalabraAgenda("hola qué tal", "")).toBeNull();
    expect(matchPalabraAgenda("hola qué tal", null)).toBeNull();
  });

  it("matchea la palabra propia del cliente", () => {
    expect(matchPalabraAgenda("necesito una mesa", "mesa")).toEqual({ palabra: "mesa", propia: true });
  });

  it("la palabra propia no pisa las de siempre", () => {
    // Aunque el cliente configure "mesa", "turno" tiene que seguir
    // funcionando: es lo que la gente escribe sin que nadie le diga.
    expect(matchPalabraAgenda("turno", "mesa")).toEqual({ palabra: "turno", propia: false });
  });

  it("la palabra propia se compara sin tildes y sin mayúsculas", () => {
    expect(matchPalabraAgenda("NECESITO UNA MESA", "Mesa")).toEqual({ palabra: "mesa", propia: true });
    expect(matchPalabraAgenda("quiero un mesón", "meson")).toEqual({ palabra: "meson", propia: true });
  });
});