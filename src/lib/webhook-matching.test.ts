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
    const noon = new Date("2026-08-27T12:00:00");
    expect(isWithinSchedule({ from: "09:00", to: "18:00" }, noon)).toBe(true);
    expect(isWithinSchedule({ from: "09:00", to: "18:00" }, new Date("2026-08-27T20:00:00"))).toBe(false);
  });

  it("horario cruzando medianoche: dentro del rango (23:30)", () => {
    const now = new Date("2026-08-27T23:30:00");
    expect(isWithinSchedule({ from: "22:00", to: "06:00" }, now)).toBe(true);
  });

  it("horario cruzando medianoche: fuera del rango (12:00)", () => {
    const now = new Date("2026-08-27T12:00:00");
    expect(isWithinSchedule({ from: "22:00", to: "06:00" }, now)).toBe(false);
  });
});