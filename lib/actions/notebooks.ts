"use server";

import { db } from "@/lib/db";
import { notebooks, notes, users } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUserId, ownsNotebook, requireUser } from "@/lib/auth/visitor";

// Scoped by the session user, never by an id the client supplies (see lib/auth/visitor.ts).

export async function getNotebooks(userId: string) {
  const uid = await requireUser(userId);
  return await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.userId, uid))
    .orderBy(desc(notebooks.createdAt));
}

export async function createNotebook(userId: string, title: string) {
  const uid = await requireUser(userId);
  // The users row is created on first write (reads no longer create it).
  await db.insert(users).values({ id: uid, name: "Demo User", email: `${uid}@orbit.local` }).onConflictDoNothing();
  const [newNotebook] = await db
    .insert(notebooks)
    .values({
      title,
      userId: uid,
    })
    .returning();

  revalidatePath("/");
  return newNotebook;
}

export async function renameNotebook(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const uid = await getUserId();
  await db.update(notebooks).set({ title: trimmed }).where(and(eq(notebooks.id, id), eq(notebooks.userId, uid)));
  revalidatePath("/");
}

// notes.notebook_id cascades on delete, so the notes are moved out to "Notes" (null) first.
// Deleting a notebook never deletes its notes.
export async function deleteNotebook(id: string) {
  const uid = await getUserId();
  if (!(await ownsNotebook(uid, id))) return;
  await db.update(notes).set({ notebookId: null }).where(and(eq(notes.notebookId, id), eq(notes.userId, uid)));
  await db.delete(notebooks).where(and(eq(notebooks.id, id), eq(notebooks.userId, uid)));
  revalidatePath("/");
}
