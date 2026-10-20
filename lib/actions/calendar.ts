"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { calendarEvents, users, type CalendarEvent } from "@/lib/db/schema";

// Calendar events for the Calendar page and the Dashboard calendar widget. No auth exists yet, so events are scoped by user id the same
// way notes are; this is not per-user authorization. Results are {ok} objects so the form can keep its input on failure.

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 1000;

// Times are optional ("HH:MM"). When allDay/startTime/endTime are all omitted (the Dashboard widget's form), an update
// leaves the event's existing time settings alone.
type Input = { title: string; date: string; description: string; allDay?: boolean; startTime?: string | null; endTime?: string | null };
type Clean = { title: string; date: string; description: string; times?: { allDay: boolean; startTime: string | null; endTime: string | null } };
type Result = { ok: true; event: CalendarEvent } | { ok: false; error: string };

const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function validate(input: Input): { ok: true; value: Clean } | { ok: false; error: string } {
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  const date = String(input.date ?? "");
  if (!title) return { ok: false, error: "Enter a title." };
  if (title.length > MAX_TITLE) return { ok: false, error: `Keep the title under ${MAX_TITLE} characters.` };
  if (description.length > MAX_DESCRIPTION) return { ok: false, error: `Keep the note under ${MAX_DESCRIPTION} characters.` };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const real = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10) === date;
  if (!real) return { ok: false, error: "Choose a valid date." };
  if (input.allDay === undefined && input.startTime === undefined && input.endTime === undefined) return { ok: true, value: { title, date, description } };
  if (input.allDay !== false) return { ok: true, value: { title, date, description, times: { allDay: true, startTime: null, endTime: null } } };
  const startTime = input.startTime || null;
  const endTime = input.endTime || null;
  if (!startTime) return { ok: false, error: "Choose a start time, or mark the event all day." };
  if (!TIME.test(startTime) || (endTime && !TIME.test(endTime))) return { ok: false, error: "Enter valid times." };
  if (endTime && endTime <= startTime) return { ok: false, error: "The end time must be after the start time." };
  return { ok: true, value: { title, date, description, times: { allDay: false, startTime, endTime } } };
}

async function ensureUserExists(userId: string) {
  await db.insert(users).values({ id: userId, name: "Demo User", email: `${userId}@orbit.local` }).onConflictDoNothing();
}

export async function listCalendarEvents(userId: string) {
  return db.select().from(calendarEvents).where(eq(calendarEvents.userId, userId)).orderBy(asc(calendarEvents.eventDate), asc(calendarEvents.createdAt));
}

export async function createCalendarEvent(userId: string, input: Input): Promise<Result> {
  const v = validate(input);
  if (!v.ok) return v;
  try {
    await ensureUserExists(userId);
    const [event] = await db
      .insert(calendarEvents)
      .values({ userId, title: v.value.title, eventDate: v.value.date, description: v.value.description, ...(v.value.times ?? {}) })
      .returning();
    revalidatePath("/");
    return { ok: true, event };
  } catch {
    return { ok: false, error: "Couldn't save the event. Try again." };
  }
}

// Updates the existing row (including a changed date), so editing never creates a second event.
export async function updateCalendarEvent(userId: string, id: string, input: Input): Promise<Result> {
  const v = validate(input);
  if (!v.ok) return v;
  try {
    const [event] = await db
      .update(calendarEvents)
      .set({ title: v.value.title, eventDate: v.value.date, description: v.value.description, ...(v.value.times ?? {}), updatedAt: new Date() })
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)))
      .returning();
    if (!event) return { ok: false, error: "That event no longer exists." };
    revalidatePath("/");
    return { ok: true, event };
  } catch {
    return { ok: false, error: "Couldn't save the event. Try again." };
  }
}

export async function deleteCalendarEvent(userId: string, id: string): Promise<{ ok: boolean }> {
  try {
    await db.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)));
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
