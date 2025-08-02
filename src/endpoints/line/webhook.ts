import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { lineWebhookBody, type LineWebhookEvent } from "./base";
import { AppContext, type LineMessageWorkflowParams } from "../../types";
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

    // Request size limit check (8MB)
    const contentLength = c.req.header("content-length");
    if (contentLength && parseInt(contentLength) > 8 * 1024 * 1024) {
      console.error("Request too large:", contentLength);
      return c.json({ error: "Request too large" }, 413);
    }
    
    // Get raw body for signature verification
    const rawBody = await c.req.text();
    const signature = c.req.header("x-line-signature");
    
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

    // Start Workflow for each message event
    c.executionCtx.waitUntil((async () => {
      try {
        for (const event of events) {
          if (event.type === "message" && event.message && event.source.userId) {
            await this.startWorkflow(c, event);
          }
        }
      } catch (error) {
        console.error("Critical error in Workflow startup:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    })());

    return c.json({});
  }

  private verifySignature(body: string, signature: string, secret: string): boolean {
    const hash = crypto
      .createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("base64");
    
    if (signature !== hash) {
      console.error("Signature verification failed - mismatch detected");
    }
    
    return signature === hash;
  }

  private async startWorkflow(c: AppContext, event: LineWebhookEvent) {
    if (!event.message || !event.source.userId) return;

    const userId = event.source.userId;
    const messageType = event.message.type;
    const messageContent = event.message.text || null;
    
    let imageUrl: string | null = null;
    if (messageType === "image" && event.message.contentProvider?.originalContentUrl) {
      imageUrl = event.message.contentProvider.originalContentUrl;
    }

    const workflowParams: LineMessageWorkflowParams = {
      userId,
      messageType,
      messageContent,
      imageUrl,
      env: c.env
    };

    try {
      const workflowBinding = c.env.LINE_MESSAGE_WORKFLOW;
      
      await workflowBinding.create({
        params: workflowParams
      });

    } catch (error) {
      console.error(`Failed to create Workflow instance for user: ${userId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

}