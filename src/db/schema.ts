import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// LINE Message Table
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

export type LineMessage = typeof lineMessages.$inferSelect;
export type InsertLineMessage = typeof lineMessages.$inferInsert;