"use server";

import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { noteToMarkdown } from "@/lib/notes/text";

// Read-only: builds a Markdown copy of one note for download. Nothing is written.
export async function exportNoteMarkdown(id: string): Promise<{ filename: string; markdown: string } | null> {
  const [note] = await db.select({ title: notes.title, content: notes.content }).from(notes).where(eq(notes.id, id));
  if (!note) return null;
  const safe = (note.title || "Untitled").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim().slice(0, 80) || "note";
  return { filename: `${safe}.md`, markdown: noteToMarkdown(note.title, note.content) };
}
