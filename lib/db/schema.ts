import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  jsonb,
  pgTable,
  smallint,
  text,
  unique,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";


export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


export const notebooks = pgTable("notebooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull().default("Untitled"),
  icon: text("icon").default("FileText"),
  iconColor: text("icon_color").default("#ffffff"), 
  content: jsonb("content").$type<any[]>().default([]),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  notebookId: uuid("notebook_id").references(() => notebooks.id, {
    onDelete: "cascade",
  }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Saved AI chats, each permanently tied to one note. `slot` (1..3, unique per note) is what enforces the
// three-chats-per-note limit in the database itself: a fourth insert has no free slot and cannot succeed,
// even when requests race. Messages hold plain text only; proposals are never stored (see lib/ai/conversations.ts).
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slot: smallint("slot").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("ai_conversations_note_slot_unique").on(t.noteId, t.slot), check("ai_conversations_slot_range", sql`${t.slot} between 1 and 3`)]
);

export const aiMessages = pgTable("ai_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => aiConversations.id, { onDelete: "cascade" }),
  seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity().notNull(),
  role: text("role").notNull(), // "user" | "assistant"
  kind: text("kind"), // null (ordinary answer / clarifying question) | "proposal" | "notice"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notebookRelations = relations(notebooks, ({ many, one }) => ({
  notes: many(notes),
  user: one(users, {
    fields: [notebooks.userId],
    references: [users.id],
  }),
}));

export const noteRelations = relations(notes, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [notes.notebookId],
    references: [notebooks.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));

// Dashboard calendar events. `eventDate` is a plain calendar date (no time zone), read and written as "YYYY-MM-DD".
// (No auth yet: events are scoped by user id like notes, which is not per-user authorization.)
export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  description: text("description").notNull().default(""),
  // Optional times as "HH:MM" (no time zone). allDay events carry no times.
  allDay: boolean("all_day").notNull().default(true),
  startTime: text("start_time"),
  endTime: text("end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Types
export type User = typeof users.$inferSelect;
export type Notebook = typeof notebooks.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type AiMessage = typeof aiMessages.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;