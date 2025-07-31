import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { lineWebhookBody, type LineWebhookEvent, type InsertLineMessage, lineMessages, type DifyResponse } from "./base";
import { AppContext } from "../../types";
import { desc, eq } from "drizzle-orm";
import crypto from "node:crypto";

export class LineWebhook extends OpenAPIRoute {
  schema = {
    tags: ["Line"],
    summary: "Handle LINE webhook events",
    request: {
      body: {
        content: {
          "application/json": {
            schema: lineWebhookBody,
          },
        },
      },
      headers: z.object({
        "x-line-signature": z.string(),
      }),
    },
    responses: {
      200: {
        description: "Webhook processed successfully",
        content: {
          "application/json": {
            schema: z.object({}),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    console.log("=== WEBHOOK HANDLER STARTED ===");
    
    // Get raw body for signature verification
    const rawBody = await c.req.text();
    const signature = c.req.header("x-line-signature");
    
    console.log("Raw body and signature obtained:", {
      bodyLength: rawBody.length,
      hasSignature: !!signature
    });
    
    if (!signature) {
      console.error("Missing x-line-signature header");
      return c.json({}, 400);
    }
    
    if (!this.verifySignature(rawBody, signature, c.env.LINE_CHANNEL_SECRET)) {
      console.error("Signature verification failed");
      return c.json({}, 403);
    }

    // Parse and validate body after signature verification
    const parsedBody = JSON.parse(rawBody);
    const { events } = parsedBody;

    // Immediately return 200 to prevent LINE timeout (2-second limit)
    console.log("Returning 200 OK to LINE webhook to prevent timeout");
    
    // Process events asynchronously using waitUntil to avoid LINE timeout
    c.executionCtx.waitUntil((async () => {
      console.log("Starting background processing with waitUntil");
      try {
        for (const event of events) {
          if (event.type === "message" && event.message) {
            console.log(`Processing message event asynchronously: ${event.message.type}`);
            await this.handleMessageEvent(c, event);
          } else {
            console.log(`Skipping non-message event: ${event.type}`);
          }
        }
        console.log("Background processing completed successfully");
      } catch (error) {
        console.error("Critical error in background processing:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    })());

    return c.json({});
  }

  private verifySignature(body: string, signature: string, secret: string): boolean {
    const hash = crypto
      .createHmac("SHA256", secret)
      .update(body, "utf8")
      .digest("base64");
    
    // Only log signature failures in production
    if (signature !== hash) {
      console.error("Signature verification failed");
    }
    
    return signature === hash;
  }

  private async handleMessageEvent(c: AppContext, event: LineWebhookEvent) {
    if (!event.message || !event.source.userId) return;

    const userId = event.source.userId;
    const messageType = event.message.type;
    const messageContent = event.message.text || null;
    const conversationId = await this.getOrCreateConversationId(c, userId);
    
    let imageUrl: string | null = null;
    if (messageType === "image" && event.message.contentProvider?.originalContentUrl) {
      imageUrl = event.message.contentProvider.originalContentUrl;
    }

    // Process Dify API call first to get complete data
    let difyResponse = "";
    let actualConversationId = conversationId;
    
    if (messageContent) {
      console.log(`Processing message: "${messageContent}" for user: ${userId}`);
      try {
        const result = await this.sendToDify(c, messageContent, conversationId, userId, imageUrl);
        
        if (typeof result === 'string') {
          difyResponse = result;
          console.log(`Received string response: ${result.substring(0, 50)}...`);
        } else {
          difyResponse = result.answer;
          if (result.conversation_id) {
            actualConversationId = result.conversation_id;
          }
          console.log(`Received object response:`, {
            answer: result.answer?.substring(0, 50) || "No answer",
            conversation_id: result.conversation_id
          });
        }
      } catch (error) {
        console.error(`Error processing Dify request:`, error);
        difyResponse = "申し訳ございません。応答の処理中にエラーが発生しました。";
      }
    }

    // Single database insert with complete data
    const messageRecord: InsertLineMessage = {
      conversation_id: actualConversationId,
      user_id: userId,
      message_type: messageType,
      message_content: messageContent,
      image_url: imageUrl,
      dify_response: difyResponse,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const db = c.get("db");
    await db.insert(lineMessages).values(messageRecord);

    console.log(`Final processing:`, {
      hasReplyToken: !!event.replyToken,
      hasDifyResponse: !!difyResponse,
      responseLength: difyResponse.length,
      response: difyResponse.substring(0, 50)
    });

    if (difyResponse && userId) {
      console.log(`Sending push message to LINE user: ${userId}`);
      await this.pushToLine(c, userId, difyResponse);
    } else {
      console.warn(`Not sending message:`, {
        noUserId: !userId,
        noDifyResponse: !difyResponse
      });
    }
  }

  private async getOrCreateConversationId(c: AppContext, userId: string): Promise<string> {
    const db = c.get("db");
    const recentMessage = await db
      .select()
      .from(lineMessages)
      .where(eq(lineMessages.user_id, userId))
      .orderBy(desc(lineMessages.created_at))
      .limit(1);

    if (recentMessage.length > 0) {
      const existingId = recentMessage[0].conversation_id;
      console.log(`Found existing conversation_id: ${existingId} for user: ${userId}`);
      
      // Check if existing conversation_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(existingId)) {
        console.log(`Using existing valid conversation_id: ${existingId}`);
        return existingId;
      }
      console.log(`Invalid conversation_id format: ${existingId}, creating new conversation`);
    } else {
      console.log(`No existing messages found for user: ${userId}, creating new conversation`);
    }

    // Return empty string for new conversations (Dify API requirement)
    return '';
  }

  private async sendToDify(
    c: AppContext, 
    message: string, 
    conversationId: string, 
    userId: string,
    imageUrl: string | null = null
  ): Promise<{answer: string, conversation_id?: string} | string> {
    const startTime = Date.now();
    try {
      const requestBody: any = {
        inputs: {},
        query: message,
        response_mode: "blocking",
        user: userId,
      };

      // Always include conversation_id (empty string for new conversations)
      requestBody.conversation_id = conversationId;
      
      console.log(`Sending to Dify API:`, {
        conversation_id: conversationId,
        user: userId,
        query: message.substring(0, 50)
      });

      if (imageUrl) {
        requestBody.files = [{
          type: "image",
          transfer_method: "remote_url",
          url: imageUrl,
        }];
      }

      // Add timeout handling for Dify API calls (reduced to 15s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      console.log(`About to call Dify API at: ${c.env.DIFY_API_ENDPOINT}/chat-messages`);
      console.log(`Request timeout set to 15 seconds`);
      
      const response = await fetch(`${c.env.DIFY_API_ENDPOINT}/chat-messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${c.env.DIFY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log(`Dify API response received: ${response.status} ${response.statusText} (after ${Date.now() - startTime}ms)`);

      if (!response.ok) {
        const errorText = await response.text();
        // Optimized error logging for production
        console.error("Dify API error:", {
          status: response.status,
          error: errorText.substring(0, 200), // Limit error text length
          hasApiKey: !!c.env.DIFY_API_KEY
        });
        return "申し訳ございません。一時的にサービスが利用できません。";
      }

      const difyResult = await response.json() as DifyResponse;
      
      // Performance monitoring
      const duration = Date.now() - startTime;
      if (duration > 1000) { // Log only slow requests (>1s)
        console.warn(`Slow Dify API call: ${duration}ms`);
      }
      
      console.log(`Dify API response:`, {
        answer: difyResult.answer?.substring(0, 100) || "No answer",
        conversation_id: difyResult.conversation_id,
        duration: `${duration}ms`
      });
      
      // Return both the answer and conversation_id for saving to database
      return {
        answer: difyResult.answer || "回答を生成できませんでした。",
        conversation_id: difyResult.conversation_id
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Dify API error after ${duration}ms:`, {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        isAbortError: error instanceof Error && error.name === 'AbortError'
      });
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`Dify API timeout after ${duration}ms`);
        return "申し訳ございません。応答に時間がかかっています。";
      }
      return "申し訳ございます。一時的にサービスが利用できません。";
    }
  }

  private async pushToLine(c: AppContext, userId: string, message: string) {
    console.log(`LINE Push attempt:`, {
      userId: userId,
      messageLength: message.length,
      hasAccessToken: !!c.env.LINE_CHANNEL_ACCESS_TOKEN,
      tokenLength: c.env.LINE_CHANNEL_ACCESS_TOKEN?.length || 0
    });
    
    try {
      // Timeout handling for LINE API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: userId,
          messages: [{
            type: "text",
            text: message,
          }],
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("LINE Push API error:", {
          status: response.status,
          error: errorText.substring(0, 200)
        });
      } else {
        console.log("LINE Push message sent successfully");
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("LINE Push API timeout");
      } else {
        console.error("Error pushing to LINE:", error);
      }
    }
  }
}