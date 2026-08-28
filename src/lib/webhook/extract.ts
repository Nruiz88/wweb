/** Extract text from plain text, media captions, etc. */
export function extractMessageText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";

  if (typeof message.conversation === "string") return message.conversation;

  const ext = message.extendedTextMessage as Record<string, unknown> | undefined;
  if (typeof ext?.text === "string") return ext.text;

  const mediaKeys = ["imageMessage", "videoMessage", "documentMessage", "audioMessage"];
  for (const key of mediaKeys) {
    const media = message[key] as Record<string, unknown> | undefined;
    if (typeof media?.caption === "string") return media.caption;
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
