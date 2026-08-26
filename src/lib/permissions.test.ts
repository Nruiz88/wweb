import { describe, expect, it } from "vitest";
import { canCreateInstance, hasAccessToFeature } from "./permissions";

describe("hasAccessToFeature", () => {
  it("starter tiene keywords y menus", () => {
    expect(hasAccessToFeature("starter", "keywords")).toBe(true);
    expect(hasAccessToFeature("starter", "menus")).toBe(true);
  });

  it("starter NO tiene calendar ni broadcasts", () => {
    expect(hasAccessToFeature("starter", "calendar")).toBe(false);
    expect(hasAccessToFeature("starter", "broadcasts")).toBe(false);
  });

  it("pro tiene keywords, menus, calendar, appointments y reminders", () => {
    for (const f of ["keywords", "menus", "calendar", "appointments", "reminders"]) {
      expect(hasAccessToFeature("pro", f)).toBe(true);
    }
  });

  it("community tiene group_moderation y broadcasts", () => {
    expect(hasAccessToFeature("community", "group_moderation")).toBe(true);
    expect(hasAccessToFeature("community", "broadcasts")).toBe(true);
  });

  it("feature desconocida devuelve false", () => {
    expect(hasAccessToFeature("starter", "holograms")).toBe(false);
  });
});

describe("canCreateInstance", () => {
  it("permite crear si hay cupo", () => {
    expect(canCreateInstance(0, 1)).toBe(true);
    expect(canCreateInstance(2, 5)).toBe(true);
  });

  it("bloquea si se alcanzo el limite", () => {
    expect(canCreateInstance(1, 1)).toBe(false);
    expect(canCreateInstance(5, 5)).toBe(false);
  });
});