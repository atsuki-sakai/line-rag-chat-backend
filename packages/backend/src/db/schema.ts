import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull(),
  due_date: text("due_date").notNull(),
});

export const lineMessages = sqliteTable("line_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversation_id: text("conversation_id").notNull(),
  user_id: text("user_id").notNull(),
  message_type: text("message_type").notNull(),
  message_content: text("message_content"),
  image_url: text("image_url"),
  dify_response: text("dify_response"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;
export type LineMessage = typeof lineMessages.$inferSelect;
export type InsertLineMessage = typeof lineMessages.$inferInsert;