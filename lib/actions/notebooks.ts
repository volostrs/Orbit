"use server";

import { db } from "@/lib/db";
import { notebooks } from "@/lib/db/schema";
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

export async function deleteNotebook(id: string) {
  await db.delete(notebooks).where(eq(notebooks.id, id));
  revalidatePath("/");
}
