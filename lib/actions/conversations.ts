"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { aiConversations } from "@/lib/db/schema";
import { addMessage, getOwnedConversation, titleFromPrompt } from "@/lib/ai/conversations";

// Every action takes the note id AND the conversation id and refuses unless the conversation belongs to
// that note. (No auth exists yet: this is scoping by note id, not per-user authorization.)

export async function renameConversation(noteId: string, conversationId: string, title: string) {
  const conv = await getOwnedConversation(noteId, conversationId);
  const next = titleFromPrompt(title);
  if (!conv || !title.trim()) return { ok: false as const };
  await db.update(aiConversations).set({ title: next }).where(and(eq(aiConversations.id, conv.id), eq(aiConversations.noteId, noteId)));
  revalidatePath("/");
  return { ok: true as const, title: next };
}

// Deleting a chat frees one of the note's three slots. The note itself is never touched.
export async function deleteConversation(noteId: string, conversationId: string) {
  const conv = await getOwnedConversation(noteId, conversationId);
  if (!conv) return { ok: false as const };
  await db.delete(aiConversations).where(and(eq(aiConversations.id, conv.id), eq(aiConversations.noteId, noteId)));
  revalidatePath("/");
  return { ok: true as const };
}

// Short system lines ("Changes applied", "Proposal rejected") are saved with the chat but never sent to the model.
export async function saveConversationNotice(noteId: string, conversationId: string, text: string) {
  const conv = await getOwnedConversation(noteId, conversationId);
  if (!conv) return { ok: false as const };
  await addMessage(conv.id, "assistant", text.slice(0, 300), "notice");
  return { ok: true as const };
}
