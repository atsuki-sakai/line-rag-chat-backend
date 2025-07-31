import { z } from "zod";
import { lineMessages, type LineMessage, type InsertLineMessage } from "../../db/schema";

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
  answer: z.string(),
  conversation_id: z.string(),
  created_at: z.number(),
  id: z.string(),
  metadata: z.record(z.any()),
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
export type DifyRequest = z.infer<typeof difyRequest>;
export type DifyResponse = z.infer<typeof difyResponse>;
export type LineMessageRequest = z.infer<typeof lineMessageRequest>;

export { lineMessages, type LineMessage, type InsertLineMessage };