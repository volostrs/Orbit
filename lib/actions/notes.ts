"use server";

import { db } from "@/lib/db";
import { notes, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
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

export async function createNote(userId: string, notebookId?: string) {
  await ensureUserExists(userId);

  const [newNote] = await db
    .insert(notes)
    .values({
      title: "Untitled Note",
      content: {},
      userId,
      notebookId: notebookId || null,
    })
    .returning();

  revalidatePath("/");
  return newNote;
}

export async function updateNote(
  id: string,
  title: string,
  content: Record<string, unknown> | unknown[],
  notebookId?: string | null
) {
  const [updated] = await db
    .update(notes)
    .set({
      title,
      content: content as any,
      notebookId,
      updatedAt: new Date(),
    })
    .where(eq(notes.id, id))
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
      title: `${originalNote.title} (Copy)`,
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