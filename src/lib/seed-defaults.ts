import { query, generateId, getAdmin } from "@/lib/db";

/**
 * Respuestas automáticas y menú base que se crean cuando se crea una
 * instancia.
 *
 * Por qué en la creación de la instancia y no en el registro o la activación
 * del plan: `auto_responses.instance_id` es NOT NULL con FK a `instances`. En el
 * registro todavía no hay instancia. Es el único momento en que sabemos
 * instance_id + user_id juntos.
 *
 * Idempotente: si la instancia ya tiene respuestas, no hace nada. Así se puede
 * llamar sin miedo.
 */

export interface SeedResult {
  created: number;
  skipped: boolean;
  responses: string[];
}

interface Draft {
  key: string;
  keyword: string;
  text: string;
  priority: number;
}

/**
 * Contenido pensado para un comercio chico argentino. Todo va con el nombre del
 * negocio substitution, y son 100% editables desde el panel: esto es un
 * punto de partida, no algo cerrado.
 */
function drafts(business: string): Draft[] {
  return [
    {
      key: "saludo",
      keyword: "hola",
      priority: 50,
      text:
        `¡Hola! 👋\n\n` +
        `Bienvenido a *${business}*.\n\n` +
        "¿En qué te podemos ayudar? Escribinos *menú* y te mostramos todas las opciones 😊",
    },
    {
      key: "horarios",
      keyword: "horario",
      priority: 40,
      text:
        `🕐 *Horarios de atención*\n\n` +
        "Lunes a Viernes de 9 a 18 h\n" +
        "Sábados de 9 a 13 h\n" +
        "Domingos cerrado\n\n" +
        "_Editá estos horarios desde el panel._",
    },
    {
      key: "ubicacion",
      keyword: "ubicacion",
      priority: 40,
      text:
        `📍 *Dónde estamos*\n\n` +
        "Cargá tu dirección desde el panel y la aparecemos acá con el link al mapa.\n\n" +
        "_While tanto, escribinos y te pasamos la ubicación._",
    },
    {
      key: "gracias",
      keyword: "gracias",
      priority: 30,
      text: "¡Gracias por escribir! 😊\n\nCualquier cosa estamos a mano.",
    },
  ];
}

export async function seedDefaults(
  instanceId: string,
  ownerUserId: string,
  business: string,
): Promise<SeedResult> {
  // Idempotencia: si ya hay algo cargado para esta instancia, no se toca.
  // Nadie quiere que un redeploy pise el trabajo del merchant.
  const existing = await query<{ n: number }>(
    "SELECT COUNT(*) AS n FROM bots_responses WHERE bot_id = ?",
    [instanceId]
  );
  if (Number(existing?.[0]?.n ?? 0) > 0) {
    return { created: 0, skipped: true, responses: [] };
  }

  // Los targets del menú se referencian por id, así que primero genero los ids.
  const ids = {
    turno: generateId(),
    productos: generateId(),
    humano: generateId(),
    menu: generateId(),
  };

  const texts: Array<{ id: string; keyword: string; text: string; priority: number }> = [
    {
      id: ids.turno,
      keyword: "turno",
      priority: 20,
      text:
        "🕐 *Turnos*\n\n" +
        "Escribinos la palabra *turno* y te muestro la disponibilidad para que elijas día y hora 📅",
    },
    {
      id: ids.productos,
      keyword: "productos",
      priority: 20,
      text:
        "🛒 *Nuestros productos*\n\n" +
        (business
          ? `Escribinos *menú* o *precios* y te muestramos el catálogo de ${business}.`
          : "Escribinos *menú* y te muestramos el catálogo."),
    },
    {
      id: ids.humano,
      keyword: "hablar",
      priority: 10,
      text:
        "💬 *Hablar con alguien*\n\n" +
        "Te leemos enseguida. Mientras tanto podés escribir *horario* o *ubicación* y te respondemos al instante.",
    },
  ];

  const inserted: string[] = [];

  /* El id se genera AQUÍ, no en la base, y es a propósito.

     El menú de abajo referencia estas respuestas por `target_id`
     (ids.turno, ids.productos, ids.humano). Si la base generase los
     ids, esos punteros apuntarían a filas que no existen: el menú se
     crearía roto y sin ningún error que lo delatara. */
  for (const t of texts) {
    await getAdmin().from("bots_responses").insert({
      id: t.id,
      bot_id: instanceId,
      keyword: t.keyword,
      response_text: t.text,
      response_type: "text",
      is_active: true,
      priority: t.priority,
    });
    inserted.push(t.keyword);
  }

  for (const d of drafts(business)) {
    await getAdmin().from("bots_responses").insert({
      id: generateId(),
      bot_id: instanceId,
      keyword: d.keyword,
      response_text: d.text,
      response_type: "text",
      is_active: true,
      priority: d.priority,
    });
    inserted.push(d.keyword);
  }

  // El menú base apunta a las respuestas de arriba por target_id.
  const menuConfig = {
    title: `${business || "Menú"} — ¿qué necesitás?`,
    description: "Elegí una opción y te ayudamos al toque 👇",
    footer: "Boti · tu asistente",
    buttons: [
      { id: "b_turno", text: "🕐 Sacar un turno", target_id: ids.turno },
      { id: "b_productos", text: "🛒 Ver productos", target_id: ids.productos },
      { id: "b_humano", text: "💬 Hablar con alguien", target_id: ids.humano },
    ],
  };

  await getAdmin().from("bots_responses").insert({
    id: ids.menu,
    bot_id: instanceId,
    keyword: "menu",
    response_text: "[menú base]",
    response_type: "menu",
    // jsonb: se pasa el objeto, no un JSON.stringify.
    menu_config: menuConfig,
    is_active: true,
    priority: 15,
  });
  inserted.push("menu");

  return { created: inserted.length, skipped: false, responses: inserted };
}
