import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  text,
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

// Types
export type User = typeof users.$inferSelect;
export type Notebook = typeof notebooks.$inferSelect;
export type Note = typeof notes.$inferSelect;