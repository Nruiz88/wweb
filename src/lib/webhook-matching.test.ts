import { describe, expect, it } from "vitest";
import { isWithinSchedule, matchKeyword, matchRegex } from "./webhook-matching";

describe("matchKeyword", () => {
  it("matchea keyword en cualquier parte del mensaje", () => {
    expect(matchKeyword("Me pasas el PRECIO por favor", "precio")).toBe(true);
  });

  it("es case-insensitive", () => {
    expect(matchKeyword("HOLA", "hola")).toBe(true);
  });

  it("no matchea si no esta", () => {
    expect(matchKeyword("buenos dias", "precio")).toBe(false);
  });
});

describe("matchRegex", () => {
  it("matchea patron valido", () => {
    expect(matchRegex("Mi horario es de 9am", "horario.*9am")).toBe(true);
  });

  it("bloquea regex inseguras (anti-ReDoS)", () => {
    expect(matchRegex("test", "^(a+)+$")).toBe(false);
  });

  it("devuelve false en errores de compilacion", () => {
    expect(matchRegex("test", "([")).toBe(false);
  });
});

describe("isWithinSchedule", () => {
  it("sin schedule siempre activo", () => {
    expect(isWithinSchedule(null)).toBe(true);
    expect(isWithinSchedule(undefined)).toBe(true);
  });

  it("sin horario definido activo", () => {
    expect(isWithinSchedule({})).toBe(true);
  });

  it("horario normal valida dentro/fuera", () => {
    expect(isWithinSchedule({ from: "00:00", to: "23:59" })).toBe(true);
  });

  it("horario cruzando medianoche", () => {
    expect(isWithinSchedule({ from: "22:00", to: "06:00" })).toBe(true);
  });
});