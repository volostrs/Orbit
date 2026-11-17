import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notebooks } from "@/lib/db/schema";
import { DEV_USER_ID, VISITOR_COOKIE, VISITOR_ID } from "./visitorId";

// Orbit has no accounts. In production each browser is an anonymous "visitor": proxy.ts gives it a random,
// HttpOnly cookie, and that cookie (never anything the client sends in an argument) decides whose data a
// request may touch. Every server action and API route calls getUserId() and scopes its queries by it.
export async function getUserId(): Promise<string> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (value && VISITOR_ID.test(value)) return value;
  if (process.env.NODE_ENV !== "production") return DEV_USER_ID;
  throw new Error("Missing visitor session. Orbit needs cookies enabled.");
}

// Server actions still receive a userId from the client for historical reasons. It is never trusted: it must
// match the session's id, otherwise the call is refused. Returns the session id.
export async function requireUser(claimed?: string): Promise<string> {
  const id = await getUserId();
  if (claimed !== undefined && claimed !== id) throw new Error("Forbidden");
  return id;
}

/** True only when the notebook exists and belongs to this user. */
export async function ownsNotebook(userId: string, notebookId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: notebooks.id })
    .from(notebooks)
    .where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId)));
  return !!row;
}
