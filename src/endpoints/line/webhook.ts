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
    console.log("=== WEBHOOK HANDLER STARTED ===");
    
    // リクエストサイズ制限チェック (8MB)
    const contentLength = c.req.header("content-length");
    if (contentLength && parseInt(contentLength) > 8 * 1024 * 1024) {
      console.error("Request too large:", contentLength);
      return c.json({ error: "Request too large" }, 413);
    }
    
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
    
    console.log("Environment variable check:", {
      hasLineChannelSecret: !!c.env.LINE_CHANNEL_SECRET,
      lineChannelSecretLength: c.env.LINE_CHANNEL_SECRET?.length || 0,
      envKeys: Object.keys(c.env)
    });

    if (!this.verifySignature(rawBody, signature, c.env.LINE_CHANNEL_SECRET)) {
      console.error("Signature verification failed");
      return c.json({}, 403);
    }

    // Parse and validate body after signature verification
    const parsedBody = JSON.parse(rawBody);
    const { events } = parsedBody;

    // Immediately return 200 to prevent LINE timeout (2-second limit)
    console.log("Returning 200 OK to LINE webhook to prevent timeout");
    
    // Start Workflow for each message event
    c.executionCtx.waitUntil((async () => {
      console.log("Starting Workflow processing");
      try {
        for (const event of events) {
          if (event.type === "message" && event.message && event.source.userId) {
            console.log(`Starting Workflow for message event: ${event.message.type}`);
            await this.startWorkflow(c, event);
          } else {
            console.log(`Skipping non-message event: ${event.type}`);
          }
        }
        console.log("All Workflows started successfully");
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
    
    console.log("Signature verification details:", {
      receivedSignature: signature,
      calculatedHash: hash,
      secretLength: secret?.length || 0,
      bodyLength: body.length,
      matches: signature === hash
    });
    
    if (signature !== hash) {
      console.error("Signature verification failed - mismatch detected");
    } else {
      console.log("Signature verification successful");
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

    console.log("Environment variables:", JSON.stringify(c.env, null, 2));
    const workflowParams: LineMessageWorkflowParams = {
      userId,
      messageType,
      messageContent,
      imageUrl,
      env: c.env
    };

    console.log(`Creating Workflow instance for user: ${userId}, message: ${messageContent?.substring(0, 50)}`);
    console.log("Workflow parameters being sent:", JSON.stringify(workflowParams, null, 2));

    try {
      const workflowBinding = c.env.LINE_MESSAGE_WORKFLOW;
      console.log("Workflow binding available:", !!workflowBinding);
      
      const instance = await workflowBinding.create({
        params: workflowParams
      });

      console.log(`Workflow instance created: ${instance.id} for user: ${userId}`);
      
      // Optional: You can wait for workflow completion or just let it run
      // const result = await instance.waitForCompletion();
      
    } catch (error) {
      console.error(`Failed to create Workflow instance for user: ${userId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Fallback: could implement simple retry or error handling here
      throw error;
    }
  }

}