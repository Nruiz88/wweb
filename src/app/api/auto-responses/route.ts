import { NextResponse } from "next/server";
import { getSession, botDeLaSesion, clienteDeLaSesion } from "@/lib/sesion";
import { rateLimitResponse } from "@/lib/rate-limit";
import { isSafeRegex } from "@/lib/regex-guard";
import { isValidId } from "@/lib/validation";

export const dynamic = "force-dynamic";

/* =========================================================
   Respuestas automáticas
   ---------------------------------------------------------
   El bot sale de `botDeLaSesion()` (RLS), no de `?instanceId=` con
   `verifyUserAccess`.

   Todo va con el cliente de Supabase: `query()` va a `ejecutar_sql`,
   que es de SOLO LECTURA, así que los INSERT/UPDATE/DELETE de antes
   no se ejecutarían.

   Y `user_id` desaparece de las respuestas: esa columna ya no existe.
   El "quién" en un bot es el teléfono que escribe, no el usuario del
   panel.

   Se sigue aceptando snake_case además de camelCase porque la UI de
   /menus manda las dos cosas según la pantalla, y normalizarlo aquí
   era lo que evitaba que un menú naciera como respuesta de texto.
   ========================================================= */

const COLUMNAS =
  "id, keyword, regex_pattern, response_text, response_media_url, response_type, menu_config, is_active, priority, schedule, created_at";

const TIPOS = ["text", "menu"];

/** Lee el cuerpo aceptando camelCase y snake_case. */
function normalizar(body: unknown) {
  const raw = (body ?? {}) as Record<string, unknown>;
  return {
    keyword: raw.keyword as string | undefined,
    regexPattern: (raw.regexPattern ?? raw.regex_pattern) as string | undefined,
    responseText: (raw.responseText ?? raw.response_text) as string | undefined,
    responseMediaUrl: (raw.responseMediaUrl ?? raw.response_media_url) as string | undefined,
    responseType: (raw.responseType ?? raw.response_type) as string | undefined,
    menuConfig: (raw.menuConfig ?? raw.menu_config) as Record<string, unknown> | undefined,
    isActive: (raw.isActive ?? raw.is_active) as boolean | undefined,
    /* El toggle de la UI manda { id, active }. */
    active: raw.active as boolean | undefined,
    priority: raw.priority as number | undefined,
    schedule: raw.schedule as Record<string, unknown> | undefined,
  };
}

async function contexto() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }) };

  const db = clienteDeLaSesion(session);
  if (!db) {
    return { error: NextResponse.json({ status: "error", error: "Sesión caducada" }, { status: 401 }) };
  }

  const bot = await botDeLaSesion(session);
  if (!bot) {
    return { error: NextResponse.json({ status: "error", error: "No tienes un bot" }, { status: 404 }) };
  }

  return { db, bot };
}

// GET /api/auto-responses?type=text|menu
export async function GET(request: Request) {
  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  const type = new URL(request.url).searchParams.get("type");

  let q = ctx.db
    .from("bots_responses")
    .select(COLUMNAS)
    .eq("bot_id", ctx.bot.id)
    .order("priority", { ascending: false });

  if (type && TIPOS.includes(type)) q = q.eq("response_type", type);

  const { data, error } = await q;
  if (error) return NextResponse.json({ status: "error", error: "No se pudieron leer las respuestas" }, { status: 500 });

  return NextResponse.json({ status: "success", data: data ?? [] });
}

// POST /api/auto-responses
export async function POST(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (rateLimitErr) return rateLimitErr;

  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { keyword, regexPattern, responseText, responseMediaUrl, responseType, menuConfig, isActive, priority, schedule } =
    normalizar(body);

  /* La UI de /menus manda `{ menu_config, is_active }` SIN
     `response_type`, así que caía en la rama de texto y moría con
     "responseText is required": no se podía crear ningún menú. Se
     infiere el tipo cuando viene un menu_config. */
  const tipo = responseType ?? (menuConfig ? "menu" : "text");

  if (!TIPOS.includes(tipo)) {
    return NextResponse.json({ status: "error", error: "response_type inválido" }, { status: 400 });
  }

  const botones = (menuConfig?.buttons ?? []) as unknown[];
  if (tipo === "menu" && botones.length === 0) {
    return NextResponse.json(
      { status: "error", error: "Un menú necesita al menos un botón" },
      { status: 400 }
    );
  }

  if (tipo !== "menu" && !responseText?.trim()) {
    return NextResponse.json(
      { status: "error", error: "Una respuesta de texto necesita su texto" },
      { status: 400 }
    );
  }

  if (regexPattern && !isSafeRegex(regexPattern)) {
    return NextResponse.json(
      { status: "error", error: "El patrón regex es inválido, muy largo o potencialmente peligroso" },
      { status: 400 }
    );
  }

  /* Para un menú la UI no pasa keyword, y la tabla exige keyword O
     regex_pattern. Antes se generaba `menu_<id>` con un idazarizado;
     ahora el id lo pone la base, así que la keyword se deriva de un
     random. Es interna: el menú se abre por su target_id, no por
     palabra clave. */
  const clave = keyword?.trim() || (tipo === "menu" ? `menu_${Math.random().toString(36).slice(2, 10)}` : null);

  if (!clave && !regexPattern?.trim()) {
    return NextResponse.json(
      { status: "error", error: "Necesitás una palabra clave o un patrón regex" },
      { status: 400 }
    );
  }

  const { data, error } = await ctx.db
    .from("bots_responses")
    .insert({
      bot_id: ctx.bot.id,
      keyword: clave,
      regex_pattern: regexPattern || null,
      response_text: responseText || "",
      response_media_url: responseMediaUrl || null,
      response_type: tipo,
      menu_config: menuConfig ?? null,
      is_active: isActive ?? true,
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
      schedule: schedule ?? null,
    })
    .select(COLUMNAS)
    .single();

  if (error) {
    /* 23514 es el CHECK (keyword OR regex_pattern). Se traduce a un
       mensaje útil en vez de un 500 opaco. */
    if (error.code === "23514") {
      return NextResponse.json(
        { status: "error", error: "Necesitás una palabra clave o un patrón regex" },
        { status: 400 }
      );
    }
    return NextResponse.json({ status: "error", error: "No se pudo guardar la respuesta" }, { status: 500 });
  }

  return NextResponse.json({ status: "success", data });
}

async function updateAutoResponse(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (rateLimitErr) return rateLimitErr;

  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = (body ?? {}) as { id?: unknown };
  if (typeof id !== "string" || !isValidId(id)) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const n = normalizar(body);

  if (n.regexPattern && !isSafeRegex(n.regexPattern)) {
    return NextResponse.json(
      { status: "error", error: "El patrón regex es inválido, muy largo o potencialmente peligroso" },
      { status: 400 }
    );
  }
  if (n.responseType !== undefined && !TIPOS.includes(n.responseType)) {
    return NextResponse.json({ status: "error", error: "response_type inválido" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (n.keyword !== undefined) updates.keyword = n.keyword;
  if (n.regexPattern !== undefined) updates.regex_pattern = n.regexPattern;
  if (n.responseText !== undefined) updates.response_text = n.responseText;
  if (n.responseMediaUrl !== undefined) updates.response_media_url = n.responseMediaUrl;
  if (n.responseType !== undefined) updates.response_type = n.responseType;
  if (n.menuConfig !== undefined) updates.menu_config = n.menuConfig;
  if (n.isActive !== undefined) updates.is_active = n.isActive;
  if (n.active !== undefined) updates.is_active = n.active;
  if (n.priority !== undefined) updates.priority = Number(n.priority);
  if (n.schedule !== undefined) updates.schedule = n.schedule;

  if (Object.keys(updates).length === 0) return NextResponse.json({ status: "success" });

  /* El `bot_id` va en el WHERE: no hay consulta aparte "de quién es
     esto". Antes sí la había, y el UPDATE siguiente no repetía el
     filtro. */
  const { data, error } = await ctx.db
    .from("bots_responses")
    .update(updates)
    .eq("id", id)
    .eq("bot_id", ctx.bot.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23514") {
      return NextResponse.json(
        { status: "error", error: "Necesitás una palabra clave o un patrón regex" },
        { status: 400 }
      );
    }
    return NextResponse.json({ status: "error", error: "No se pudo actualizar" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ status: "error", error: "Auto-response not found" }, { status: 404 });

  return NextResponse.json({ status: "success", data: { id, ...updates } });
}

// PUT: mismo handler que PATCH; la UI usa PATCH para editar y para el toggle.
export async function PUT(request: Request) {
  return updateAutoResponse(request);
}

export async function PATCH(request: Request) {
  return updateAutoResponse(request);
}

// DELETE /api/auto-responses?id=xxx
export async function DELETE(request: Request) {
  const rateLimitErr = await rateLimitResponse(request, "auto-responses", {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (rateLimitErr) return rateLimitErr;

  const ctx = await contexto();
  if (ctx.error) return ctx.error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !isValidId(id)) {
    return NextResponse.json({ status: "error", error: "id is required" }, { status: 400 });
  }

  const { data, error } = await ctx.db
    .from("bots_responses")
    .delete()
    .eq("id", id)
    .eq("bot_id", ctx.bot.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ status: "error", error: "No se pudo borrar" }, { status: 500 });
  if (!data) return NextResponse.json({ status: "error", error: "Auto-response not found" }, { status: 404 });

  return NextResponse.json({ status: "success" });
}