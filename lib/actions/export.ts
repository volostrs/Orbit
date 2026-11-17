"use server";

import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { noteToMarkdown } from "@/lib/notes/text";
import { getUserId } from "@/lib/auth/visitor";

// Read-only: builds a Markdown copy of one of the visitor's own notes for download. Nothing is written.
export async function exportNoteMarkdown(id: string): Promise<{ filename: string; markdown: string } | null> {
  const uid = await getUserId();
  const [note] = await db
    .select({ title: notes.title, content: notes.content })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, uid)));
  if (!note) return null;
  const safe = (note.title || "Untitled").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 80) || "note";
  return { filename: `${safe}.md`, markdown: noteToMarkdown(note.title, note.content) };
}
