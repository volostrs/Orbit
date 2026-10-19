"use server";

import { db } from "@/lib/db";
import { notes, users } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function ensureUserExists(userId: string) {
  await db
    .insert(users)
    .values({
      id: userId,
      name: "Demo User",
      email: `${userId}@orbit.local`,
    })
    .onConflictDoNothing();
}

export async function getNotes(userId: string) {
  await ensureUserExists(userId);
  return await db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt));
}

export async function createNote(userId: string, notebookId?: string, title?: string) {
  await ensureUserExists(userId);

  const [newNote] = await db
    .insert(notes)
    .values({
      title: title?.trim() || "Untitled Note",
      content: [],
      userId,
      notebookId: notebookId || null,
    })
    .returning();

  revalidatePath("/");
  return newNote;
}

// Partial update: fields passed as undefined are left untouched (drizzle skips undefined). The editor
// relies on this so autosaving content never rewrites a title or notebook changed from the sidebar.
export async function updateNote(
  id: string,
  title?: string,
  content?: Record<string, unknown> | unknown[],
  notebookId?: string | null
) {
  // A locked note rejects content writes (returns undefined), so a stale editor can't overwrite it.
  const [updated] = await db
    .update(notes)
    .set({
      title,
      content: content as any,
      notebookId,
      updatedAt: new Date(),
    })
    .where(content === undefined ? eq(notes.id, id) : and(eq(notes.id, id), eq(notes.isLocked, false)))
    .returning();

  revalidatePath("/");
  return updated;
}

export async function toggleFavoriteNote(id: string, currentFavoriteStatus: boolean) {
  await db
    .update(notes)
    .set({ isFavorite: !currentFavoriteStatus, updatedAt: new Date() })
    .where(eq(notes.id, id));

  revalidatePath("/");
}

// Locking only flips the flag; it does not change updatedAt, since the content didn't change.
export async function setNoteLocked(id: string, locked: boolean) {
  await db.update(notes).set({ isLocked: locked }).where(eq(notes.id, id));
  revalidatePath("/");
}

export async function updateNoteIcon(
  id: string,
  icon: string | null,
  iconColor?: string | null
) {
  await db
    .update(notes)
    .set({
      icon,
      iconColor,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, id));

  revalidatePath("/");
}

export async function duplicateNote(id: string) {
  const [originalNote] = await db.select().from(notes).where(eq(notes.id, id));
  if (!originalNote) return;

  const [duplicated] = await db
    .insert(notes)
    .values({
      title: `Copy of ${originalNote.title}`,
      icon: originalNote.icon,
      iconColor: originalNote.iconColor,
      content: originalNote.content,
      userId: originalNote.userId,
      notebookId: originalNote.notebookId,
      isFavorite: false,
    })
    .returning();

  revalidatePath("/");
  return duplicated;
}

export async function moveNote(id: string, notebookId: string | null) {
  await db
    .update(notes)
    .set({ notebookId, updatedAt: new Date() })
    .where(eq(notes.id, id));

  revalidatePath("/");
}

export async function deleteNote(id: string) {
  await db.delete(notes).where(eq(notes.id, id));
  revalidatePath("/");
}