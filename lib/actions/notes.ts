"use server";

import { db } from "@/lib/db";
import { notes, users } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getUserId, ownsNotebook, requireUser } from "@/lib/auth/visitor";

// Every action derives the user from the session (lib/auth/visitor.ts) and scopes each query by it, so a note id
// or userId supplied by the client can never reach another visitor's data.

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
  const uid = await requireUser(userId);
  return await db
    .select()
    .from(notes)
    .where(eq(notes.userId, uid))
    .orderBy(desc(notes.updatedAt));
}

export async function createNote(userId: string, notebookId?: string, title?: string) {
  const uid = await requireUser(userId);
  if (notebookId && !(await ownsNotebook(uid, notebookId))) throw new Error("Notebook not found.");
  await ensureUserExists(uid);

  const [newNote] = await db
    .insert(notes)
    .values({
      title: title?.trim() || "Untitled Note",
      content: [],
      userId: uid,
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
  const uid = await getUserId();
  if (notebookId && !(await ownsNotebook(uid, notebookId))) throw new Error("Notebook not found.");
  const mine = and(eq(notes.id, id), eq(notes.userId, uid));
  // A locked note rejects content writes (returns undefined), so a stale editor can't overwrite it.
  const [updated] = await db
    .update(notes)
    .set({
      title,
      content: content as any,
      notebookId,
      updatedAt: new Date(),
    })
    .where(content === undefined ? mine : and(mine, eq(notes.isLocked, false)))
    .returning();

  revalidatePath("/");
  return updated;
}

export async function toggleFavoriteNote(id: string, currentFavoriteStatus: boolean) {
  const uid = await getUserId();
  await db
    .update(notes)
    .set({ isFavorite: !currentFavoriteStatus, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, uid)));

  revalidatePath("/");
}

// Locking only flips the flag; it does not change updatedAt, since the content didn't change.
export async function setNoteLocked(id: string, locked: boolean) {
  const uid = await getUserId();
  await db.update(notes).set({ isLocked: locked }).where(and(eq(notes.id, id), eq(notes.userId, uid)));
  revalidatePath("/");
}

export async function updateNoteIcon(
  id: string,
  icon: string | null,
  iconColor?: string | null
) {
  const uid = await getUserId();
  await db
    .update(notes)
    .set({
      icon,
      iconColor,
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, id), eq(notes.userId, uid)));

  revalidatePath("/");
}

export async function duplicateNote(id: string) {
  const uid = await getUserId();
  const [originalNote] = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, uid)));
  if (!originalNote) return;

  const [duplicated] = await db
    .insert(notes)
    .values({
      title: `Copy of ${originalNote.title}`,
      icon: originalNote.icon,
      iconColor: originalNote.iconColor,
      content: originalNote.content,
      userId: uid,
      notebookId: originalNote.notebookId,
      isFavorite: false,
    })
    .returning();

  revalidatePath("/");
  return duplicated;
}

export async function moveNote(id: string, notebookId: string | null) {
  const uid = await getUserId();
  if (notebookId && !(await ownsNotebook(uid, notebookId))) throw new Error("Notebook not found.");
  await db
    .update(notes)
    .set({ notebookId, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, uid)));

  revalidatePath("/");
}

export async function deleteNote(id: string) {
  const uid = await getUserId();
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, uid)));
  revalidatePath("/");
}
