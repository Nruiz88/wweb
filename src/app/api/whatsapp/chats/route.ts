import { NextResponse } from "next/server";
import { findChats, findContacts, type ChatContact } from "@/lib/evolution";

export const dynamic = "force-dynamic";

function mergeContacts(
  chats: ChatContact[],
  contacts: ChatContact[]
): ChatContact[] {
  const byJid = new Map<string, ChatContact>();

  for (const chat of chats) {
    byJid.set(chat.jid, { ...chat });
  }

  for (const contact of contacts) {
    const existing = byJid.get(contact.jid);
    if (!existing) {
      byJid.set(contact.jid, { ...contact });
      continue;
    }

    byJid.set(contact.jid, {
      ...existing,
      name: existing.pushName || contact.name || existing.name,
      pushName: existing.pushName || contact.pushName,
      profilePicUrl: existing.profilePicUrl || contact.profilePicUrl,
      isSaved: existing.isSaved ?? contact.isSaved,
    });
  }

  return [...byJid.values()].sort((a, b) => {
    const atA = typeof a.lastMessage?.at === "number" ? a.lastMessage.at : 0;
    const atB = typeof b.lastMessage?.at === "number" ? b.lastMessage.at : 0;
    return atB - atA;
  });
}

export async function GET() {
  const [chatsResult, contactsResult] = await Promise.all([
    findChats(),
    findContacts(),
  ]);

  if (!chatsResult.ok) {
    return NextResponse.json(
      { status: "error", error: chatsResult.message, data: null },
      { status: 502 }
    );
  }

  const chats = contactsResult.ok
    ? mergeContacts(chatsResult.data, contactsResult.data)
    : chatsResult.data;

  return NextResponse.json({
    status: "success",
    error: null,
    data: { chats },
  });
}
