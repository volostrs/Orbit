// Persistent AI chats. Server-only helpers shared by the chat route, the page loader and the server actions.
//
// Rules this file enforces:
// - A conversation belongs to exactly one note, and every lookup takes BOTH ids and checks they match.
// - At most MAX_CONVERSATIONS_PER_NOTE per note, guaranteed by the (note_id, slot) unique constraint, so
//   concurrent "first prompts" cannot create a fourth chat.
// - Only plain text is stored. A proposal is never persisted: the stored reply is just its explanatory text
//   (kind "proposal"), and the reviewable change itself exists only in the live session that produced it.
//   After a reload the reply is still shown, but nothing executable is restored.
// (No auth exists yet: this is scoping by note id, not per-user authorization.)

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiConversations, aiMessages, notes } from "@/lib/db/schema";
import type { AiConversation } from "@/lib/db/schema";

export const MAX_CONVERSATIONS_PER_NOTE = 3;
export const MAX_TITLE_LENGTH = 60;

export class ChatLimitError extends Error {
  constructor() {
    super(`A note can have at most ${MAX_CONVERSATIONS_PER_NOTE} saved chats. Open one of the existing chats or delete one first.`);
  }
}

export type ChatKind = "proposal" | "notice" | null;
export interface ChatSummary {
  id: string;
  noteId: string;
  title: string;
  updatedAt: string;
}
export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  kind?: "proposal" | "notice";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** Title from the first meaningful prompt: one line, trimmed, word-boundary cut with an ellipsis. */
export function titleFromPrompt(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "New chat";
  if (oneLine.length <= MAX_TITLE_LENGTH) return oneLine;
  const cut = oneLine.slice(0, MAX_TITLE_LENGTH - 1);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > 24 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}

const toSummary = (c: AiConversation): ChatSummary => ({ id: c.id, noteId: c.noteId, title: c.title, updatedAt: c.updatedAt.toISOString() });

export async function listChatsForNote(noteId: string): Promise<ChatSummary[]> {
  if (!isUuid(noteId)) return [];
  const rows = await db.select().from(aiConversations).where(eq(aiConversations.noteId, noteId)).orderBy(desc(aiConversations.updatedAt));
  return rows.map(toSummary);
}

/** All saved chats of a user's notes (for the AI Chats page). */
export async function listChatsForUser(userId: string): Promise<ChatSummary[]> {
  const rows = await db
    .select({ c: aiConversations })
    .from(aiConversations)
    .innerJoin(notes, eq(notes.id, aiConversations.noteId))
    .where(eq(notes.userId, userId))
    .orderBy(desc(aiConversations.updatedAt));
  return rows.map((r) => toSummary(r.c));
}

/** The conversation, only if it belongs to that note. */
export async function getOwnedConversation(noteId: string, conversationId: string): Promise<AiConversation | null> {
  if (!isUuid(noteId) || !isUuid(conversationId)) return null;
  const [c] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.noteId, noteId)));
  return c ?? null;
}

export async function listMessages(conversationId: string): Promise<StoredMessage[]> {
  const rows = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(asc(aiMessages.seq));
  return rows.map((m) => ({
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    ...(m.kind === "proposal" || m.kind === "notice" ? { kind: m.kind } : {}),
  }));
}

export async function addMessage(conversationId: string, role: "user" | "assistant", content: string, kind: ChatKind = null) {
  await db.insert(aiMessages).values({ conversationId, role, content, kind });
  await db.update(aiConversations).set({ updatedAt: new Date() }).where(eq(aiConversations.id, conversationId));
}

/**
 * Creates the conversation in the lowest free slot (1..3) in a single statement. If two requests race for
 * the same slot, the unique constraint rejects one and it simply tries the next free slot; once all three
 * are taken, ChatLimitError is thrown. A fourth chat cannot exist.
 */
export async function createConversation(noteId: string, title: string): Promise<AiConversation> {
  const t = titleFromPrompt(title);
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res: any = await db.execute(sql`
        insert into ai_conversations (note_id, title, slot)
        select ${noteId}::uuid, ${t}, s from generate_series(1, ${MAX_CONVERSATIONS_PER_NOTE}) s
        where not exists (select 1 from ai_conversations c where c.note_id = ${noteId}::uuid and c.slot = s)
        order by s limit 1
        returning id, note_id, title, slot, created_at, updated_at`);
      const row = (res.rows ?? res)[0];
      if (!row) throw new ChatLimitError();
      return {
        id: row.id,
        noteId: row.note_id,
        title: row.title,
        slot: row.slot,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    } catch (err) {
      if (err instanceof ChatLimitError) throw err;
      const e = err as any;
      const msg = `${e?.message ?? err} ${e?.cause?.message ?? ""} ${e?.code ?? ""} ${e?.cause?.code ?? ""}`;
      if (!/23505|unique|duplicate/i.test(msg)) throw err; // not a slot race: a real failure
    }
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(aiConversations).where(eq(aiConversations.noteId, noteId));
  if (n >= MAX_CONVERSATIONS_PER_NOTE) throw new ChatLimitError();
  throw new Error("Could not save the chat. Please try again.");
}

type ModelMessage = { role: "user" | "assistant"; content: string };

/**
 * Stores this turn's user message and returns the history the model should see: the ordinary messages of
 * THIS conversation only (no notices). With `retry`, a partial reply that followed the same user message is
 * dropped and that message is reused instead of duplicated.
 */
export async function recordUserTurn(conversationId: string, text: string, retry: boolean): Promise<ModelMessage[]> {
  const load = () => db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId)).orderBy(asc(aiMessages.seq));
  let rows = await load();
  const lastUser = retry ? [...rows].reverse().find((m) => m.role === "user" && m.kind !== "notice") : undefined;
  if (lastUser && lastUser.content === text) {
    const after = rows.filter((m) => m.seq > lastUser.seq);
    if (after.length) {
      await db.delete(aiMessages).where(inArray(aiMessages.id, after.map((m) => m.id)));
      rows = rows.filter((m) => m.seq <= lastUser.seq);
    }
  } else {
    await addMessage(conversationId, "user", text);
    rows = await load();
  }
  return rows
    .filter((m) => m.kind !== "notice")
    .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.content }));
}
