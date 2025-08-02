import type { Context } from "hono";
import type { DrizzleDB } from "./db";
import { z } from "zod";
import { lineMessages, type LineMessage, type InsertLineMessage } from "./db/schema";

export type AppContext = Context<{ 
  Bindings: Env & {
    LINE_MESSAGE_WORKFLOW: Workflow;
  };
  Variables: {
    db: DrizzleDB;
  };
}>;
export type HandleArgs = [AppContext];

// LINE Webhook Types
export const lineWebhookEvent = z.object({
  type: z.string(),
  mode: z.string().optional(),
  timestamp: z.number(),
  source: z.object({
    type: z.string(),
    userId: z.string(),
  }),
  webhookEventId: z.string(),
  deliveryContext: z.object({
    isRedelivery: z.boolean(),
  }),
  message: z.object({
    id: z.string(),
    type: z.enum(["text", "image"]),
    quoteToken: z.string().optional(),
    text: z.string().optional(),
    contentProvider: z.object({
      type: z.string(),
      originalContentUrl: z.string().optional(),
      previewImageUrl: z.string().optional(),
    }).optional(),
  }).optional(),
  replyToken: z.string(),
});

export const lineWebhookBody = z.object({
  destination: z.string(),
  events: z.array(lineWebhookEvent),
});

export const lineMessageRequest = z.object({
  to: z.string(),
  messages: z.array(z.object({
    type: z.literal("text"),
    text: z.string(),
  })),
});

export type LineWebhookEvent = z.infer<typeof lineWebhookEvent>;
export type LineWebhookBody = z.infer<typeof lineWebhookBody>;
export type LineMessageRequest = z.infer<typeof lineMessageRequest>;

// AI Service Interface
export interface AIService {
  processMessage(
    message: string,
    conversationId: string,
    userId: string,
    imageUrl?: string | null
  ): Promise<AIResponse>;
}

export interface AIResponse {
  answer: string;
  conversation_id?: string;
}

// Dify Types
export const difyRequest = z.object({
  inputs: z.record(z.string()),
  query: z.string(),
  response_mode: z.literal("blocking"),
  conversation_id: z.string().optional(),
  user: z.string(),
  files: z.array(z.object({
    type: z.literal("image"),
    transfer_method: z.literal("remote_url"),
    url: z.string(),
  })).optional(),
});

export const difyResponse = z.object({
  answer: z.string().optional(),
  conversation_id: z.string().optional(),
  created_at: z.number().optional(),
  id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type DifyRequest = z.infer<typeof difyRequest>;
export type DifyResponse = z.infer<typeof difyResponse>;

// Workflow Types
export interface LineMessageWorkflowParams {
  userId: string;
  messageType: string;
  messageContent: string | null;
  imageUrl: string | null;
  env: Env;
}

// Re-export database types
export { lineMessages, type LineMessage, type InsertLineMessage };
