"use server";

import { db } from "@/lib/db";
import { notebooks, notes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getNotebooks(userId: string) {
  return await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.userId, userId))
    .orderBy(desc(notebooks.createdAt));
}

export async function createNotebook(userId: string, title: string) {
  const [newNotebook] = await db
    .insert(notebooks)
    .values({
      title,
      userId,
    })
    .returning();

  revalidatePath("/");
  return newNotebook;
}

export async function renameNotebook(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await db.update(notebooks).set({ title: trimmed }).where(eq(notebooks.id, id));
  revalidatePath("/");
}

// notes.notebook_id cascades on delete, so the notes are moved out to "Notes" (null) first.
// Deleting a notebook never deletes its notes.
export async function deleteNotebook(id: string) {
  await db.update(notes).set({ notebookId: null }).where(eq(notes.notebookId, id));
  await db.delete(notebooks).where(eq(notebooks.id, id));
  revalidatePath("/");
}
