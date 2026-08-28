import { describe, expect, it } from "vitest";
import type { MenuConfig } from "./supabase/types";

/**
 * Pure helper extracted from the webhook logic:
 * Given a list of auto-responses and a tapped button text, find the
 * matching menu and return its target button.
 */
interface AutoResponseLike {
  id: string;
  response_type: string;
  menu_config: MenuConfig | null;
}

interface MatchedButton {
  target_id: string | null;
  button_text: string;
  source_menu_id: string;
}

function matchMenuButton(
  autoResponses: AutoResponseLike[],
  tappedText: string,
): MatchedButton | null {
  for (const ar of autoResponses) {
    if (ar.response_type !== "menu" || !ar.menu_config?.buttons) continue;
    const btn = (ar.menu_config.buttons as { id: string; text: string; target_id: string | null }[]).find(
      (b) => b.text === tappedText || b.id === tappedText,
    );
    if (btn) {
      return { target_id: btn.target_id, button_text: btn.text, source_menu_id: ar.id };
    }
  }
  return null;
}

const menuA: AutoResponseLike = {
  id: "m1",
  response_type: "menu",
  menu_config: {
    title: "¿En qué te puedo ayudar?",
    description: "Elegí una opción",
    buttons: [
      { id: "b_precios", text: "Precios", target_id: "t_precios" },
      { id: "b_horarios", text: "Horarios", target_id: "t_horarios" },
      { id: "b_contacto", text: "Contacto", target_id: null },
    ],
  },
};

const menuB: AutoResponseLike = {
  id: "m2",
  response_type: "menu",
  menu_config: {
    title: "Submenú",
    description: "",
    buttons: [
      { id: "b2_a", text: "Opción A", target_id: "t_a" },
    ],
  },
};

const textResponse: AutoResponseLike = {
  id: "t1",
  response_type: "text",
  keyword: "hola",
  menu_config: null,
  response_text: "¡Hola!",
} as unknown as AutoResponseLike;

describe("matchMenuButton", () => {
  it("matches button by display text", () => {
    const result = matchMenuButton([menuA], "Precios");
    expect(result).not.toBeNull();
    expect(result!.target_id).toBe("t_precios");
    expect(result!.source_menu_id).toBe("m1");
  });

  it("matches button by id", () => {
    const result = matchMenuButton([menuA], "b_contacto");
    expect(result).not.toBeNull();
    expect(result!.button_text).toBe("Contacto");
    expect(result!.target_id).toBeNull();
  });

  it("returns null when no menu matches", () => {
    const result = matchMenuButton([menuA], "No existe");
    expect(result).toBeNull();
  });

  it("ignores text-type responses", () => {
    const result = matchMenuButton([textResponse], "hola");
    expect(result).toBeNull();
  });

  it("searches across multiple menus", () => {
    const result = matchMenuButton([menuA, menuB], "Opción A");
    expect(result).not.toBeNull();
    expect(result!.source_menu_id).toBe("m2");
    expect(result!.target_id).toBe("t_a");
  });

  it("returns first match when button text appears in multiple menus", () => {
    const duplicate: AutoResponseLike = {
      id: "m3",
      response_type: "menu",
      menu_config: {
        title: "Otro",
        description: "",
        buttons: [{ id: "b_dup", text: "Precios", target_id: "other" }],
      },
    };
    const result = matchMenuButton([menuA, duplicate], "Precios");
    expect(result!.source_menu_id).toBe("m1");
  });

  it("handles empty auto-responses list", () => {
    expect(matchMenuButton([], "Precios")).toBeNull();
  });

  it("handles menu with null buttons array", () => {
    const emptyMenu: AutoResponseLike = {
      id: "m_empty",
      response_type: "menu",
      menu_config: { title: "Empty", description: "", buttons: [] },
    };
    expect(matchMenuButton([emptyMenu], "Precios")).toBeNull();
  });
});
