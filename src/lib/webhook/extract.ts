/** Extract text from plain text, media captions, etc. */
export function extractMessageText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";

  // Evolution a veces manda `data.message` como string plano, no como objeto.
  if (typeof message === "string") return message;

  if (typeof message.conversation === "string") return message.conversation;

  const ext = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (typeof ext?.text === "string") return ext.text;

  // Wrappers de "una vez" / efímero: el texto real está un nivel más adentro.
  for (const wrapper of ["viewOnceMessage", "viewOnceMessageV2", "ephemeralMessage", "ephemeralMessageV2"]) {
    const inner = message[wrapper] as Record<string, unknown> | undefined;
    const nested = inner?.message as Record<string, unknown> | undefined;
    if (nested) {
      const text = extractMessageText(nested);
      if (text) return text;
    }
  }

  const mediaKeys = ["imageMessage", "videoMessage", "documentMessage", "audioMessage"];
  for (const key of mediaKeys) {
    const media = message[key] as Record<string, unknown> | undefined;
    if (typeof media?.caption === "string") return media.caption;
    // Evolution 2.3.x: documento/audio con caption en documentWithCaptionMessage
    const withCaption = media?.message as Record<string, unknown> | undefined;
    if (withCaption) {
      const text = extractMessageText(withCaption);
      if (text) return text;
    }
  }

  const docWithCaption = message.documentWithCaptionMessage as Record<string, unknown> | undefined;
  if (docWithCaption) {
    const text = extractMessageText(docWithCaption.message as Record<string, unknown> | undefined);
    if (text) return text;
  }

  return "";
}

/** Extract text from button tap responses */
export function extractButtonText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";
  const btn = message.buttonsResponseMessage as Record<string, unknown> | undefined;
  if (btn && typeof btn.selectedDisplayText === "string") return btn.selectedDisplayText;
  if (btn && typeof btn.selectedButtonId === "string") return btn.selectedButtonId;
  return "";
}

/** Extract text from list tap responses */
export function extractListText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";
  const list = message.listResponseMessage as Record<string, unknown> | undefined;
  if (list && typeof list.title === "string") return list.title;
  const singleSelect = list?.singleSelectReply as Record<string, unknown> | undefined;
  if (singleSelect && typeof singleSelect.selectedRowId === "string") return singleSelect.selectedRowId;
  return "";
}

/** Get the raw selectedButtonId from a button tap message */
export function extractRawButtonId(message: Record<string, unknown> | undefined): string {
  if (!message) return "";
  const btn = message.buttonsResponseMessage as Record<string, unknown> | undefined;
  if (btn && typeof btn.selectedButtonId === "string") return btn.selectedButtonId;
  return "";
}
