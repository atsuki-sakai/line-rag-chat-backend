import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { type DifyResponse } from "../endpoints/line/base";

interface WorkflowEnv {
  DB: D1Database;
  DIFY_API_ENDPOINT: string;
  DIFY_API_KEY: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
}

interface InsertLineMessage {
  conversation_id: string;
  user_id: string;
  message_type: string;
  message_content: string | null;
  image_url: string | null;
  dify_response: string;
  created_at: string;
  updated_at: string;
}

export interface LineMessageWorkflowParams {
  userId: string;
  messageType: string;
  messageContent: string | null;
  imageUrl: string | null;
  replyToken?: string;
  DIFY_API_ENDPOINT: string;
  DIFY_API_KEY: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
}

export class LineMessageWorkflow extends WorkflowEntrypoint<WorkflowEnv, LineMessageWorkflowParams> {
  async run(event: WorkflowEvent<LineMessageWorkflowParams>, step: WorkflowStep) {
    console.log("=== WORKFLOW RUN METHOD CALLED ===");
    console.log("Event payload:", JSON.stringify(event.payload, null, 2));
    
    const { userId, messageType, messageContent, imageUrl, DIFY_API_ENDPOINT, DIFY_API_KEY, LINE_CHANNEL_ACCESS_TOKEN } = event.payload;

    // Validate critical parameters early
    console.log("Input parameter validation:", {
      userId: { value: userId, type: typeof userId, isUndefined: userId === undefined },
      messageType: { value: messageType, type: typeof messageType, isUndefined: messageType === undefined },
      messageContent: { value: messageContent, type: typeof messageContent, isUndefined: messageContent === undefined },
      imageUrl: { value: imageUrl, type: typeof imageUrl, isUndefined: imageUrl === undefined }
    });

    if (!userId || userId === undefined) {
      console.error("Critical: userId is undefined or null");
      throw new Error("userId is required for workflow execution");
    }

    console.log(`Starting workflow for user: ${userId}, message: ${messageContent?.substring(0, 50)}`);
    
    // Get DB from environment
    const db = this.env.DB;
    console.log("DB available:", !!db);

    // Step 1: Get or create conversation ID with retry
    console.log("Starting Step 1: Get conversation ID");
    const conversationId = await step.do("get-conversation-id", async () => {
      console.log("Executing get-conversation-id step");
      return await this.getOrCreateConversationId(db, userId);
    });
    console.log(`Step 1 completed. Conversation ID: ${conversationId}`);

    // Step 2: Process message with Dify (no timeout limit) with retry
    console.log("Starting Step 2: Process Dify");
    const difyResult = await step.do("process-dify", async () => {
      console.log("Executing process-dify step");
      if (!messageContent) {
        console.log("No message content, returning empty answer");
        return { answer: "", conversation_id: conversationId };
      }

      console.log(`Processing message with Dify: "${messageContent}" for user: ${userId}`);
      return await this.sendToDify(DIFY_API_ENDPOINT, DIFY_API_KEY, messageContent, conversationId, userId, imageUrl);
    });
    console.log(`Step 2 completed. Dify response length: ${difyResult.answer?.length || 0}`);

    // Step 3 & 4: データベース保存とLINE送信の並列実行最適化
    if (difyResult.answer && userId) {
      // 並列実行のためのPromise.allSettledを使用（一方が失敗しても他方は継続）
      await step.do("save-and-send-parallel", async () => {
        const finalConversationId = difyResult.conversation_id || conversationId || "";
        const finalUserId = userId || "";
        const finalMessageType = messageType || "";
        const finalMessageContent = messageContent || null;
        const finalImageUrl = imageUrl || null;
        const finalDifyResponse = difyResult.answer || "";
        const finalCreatedAt = new Date().toISOString();
        const finalUpdatedAt = new Date().toISOString();

        const messageRecord: InsertLineMessage = {
          conversation_id: finalConversationId,
          user_id: finalUserId,
          message_type: finalMessageType,
          message_content: finalMessageContent,
          image_url: finalImageUrl,
          dify_response: finalDifyResponse,
          created_at: finalCreatedAt,
          updated_at: finalUpdatedAt,
        };

        console.log("Starting parallel execution: Database save + LINE push");
        
        // 並列実行：データベース保存とLINE送信
        const [dbResult, lineResult] = await Promise.allSettled([
          // データベース保存
          db
            .prepare("INSERT INTO line_messages (conversation_id, user_id, message_type, message_content, image_url, dify_response, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(
              finalConversationId,
              finalUserId,
              finalMessageType,
              finalMessageContent,
              finalImageUrl,
              finalDifyResponse,
              finalCreatedAt,
              finalUpdatedAt
            )
            .run(),
          
          // LINE送信
          this.pushToLine(LINE_CHANNEL_ACCESS_TOKEN, userId, difyResult.answer)
        ]);

        // 結果ログ
        if (dbResult.status === 'fulfilled') {
          console.log(`✅ Database save completed for user: ${userId}`);
        } else {
          console.error(`❌ Database save failed for user: ${userId}:`, dbResult.reason);
        }

        if (lineResult.status === 'fulfilled') {
          console.log(`✅ LINE push completed for user: ${userId}`);
        } else {
          console.error(`❌ LINE push failed for user: ${userId}:`, lineResult.reason);
        }

        // 少なくとも一方が成功していれば継続
        if (dbResult.status === 'rejected' && lineResult.status === 'rejected') {
          throw new Error("Both database save and LINE push failed");
        }

        return {
          messageRecord,
          dbSuccess: dbResult.status === 'fulfilled',
          lineSuccess: lineResult.status === 'fulfilled'
        };
      });
    } else {
      // LINE送信なし、データベース保存のみ
      await step.do("save-to-database", async () => {
        const finalConversationId = difyResult.conversation_id || conversationId || "";
        const finalUserId = userId || "";
        const finalMessageType = messageType || "";
        const finalMessageContent = messageContent || null;
        const finalImageUrl = imageUrl || null;
        const finalDifyResponse = difyResult.answer || "";
        const finalCreatedAt = new Date().toISOString();
        const finalUpdatedAt = new Date().toISOString();

        const messageRecord: InsertLineMessage = {
          conversation_id: difyResult.conversation_id || conversationId || "",
          user_id: userId || "",
          message_type: messageType || "",
          message_content: messageContent || null,
          image_url: imageUrl || null,
          dify_response: difyResult.answer || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await db
          .prepare("INSERT INTO line_messages (conversation_id, user_id, message_type, message_content, image_url, dify_response, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(
            finalConversationId,
            finalUserId,
            finalMessageType,
            finalMessageContent,
            finalImageUrl,
            finalDifyResponse,
            finalCreatedAt,
            finalUpdatedAt
          )
          .run();
        
        console.log(`Message saved to database (no LINE response) for user: ${userId}`);
        return messageRecord;
      });
    }

    console.log(`Workflow completed for user: ${userId}`);
    return { success: true, userId, responseLength: difyResult.answer?.length || 0 };
  }

  private async getOrCreateConversationId(db: D1Database, userId: string): Promise<string> {
    console.log("Creating database connection in getOrCreateConversationId", {
      userId: userId,
      userIdType: typeof userId,
      isUndefined: userId === undefined,
      isNull: userId === null,
      isEmpty: userId === ""
    });
    
    if (!userId || userId === undefined) {
      console.error("userId is undefined or null in getOrCreateConversationId");
      throw new Error("userId is required for database operations");
    }
    
    const recentMessage = await db
      .prepare("SELECT * FROM line_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
      .bind(userId)
      .all();

    if (recentMessage.results && recentMessage.results.length > 0) {
      const existingId = (recentMessage.results[0] as any).conversation_id as string;
      console.log(`Found existing conversation_id: ${existingId} for user: ${userId}`);
      
      // Check if existing conversation_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (existingId && uuidRegex.test(existingId)) {
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
    apiEndpoint: string,
    apiKey: string,
    message: string,
    conversationId: string,
    userId: string,
    imageUrl: string | null = null
  ): Promise<{answer: string, conversation_id?: string}> {
    const startTime = Date.now();
    
    // メッセージ長さ制限（10,000文字）
    if (message.length > 10000) {
      console.warn("Message too long, truncating:", message.length);
      message = message.substring(0, 10000) + "...";
    }
    
    try {
      const requestBody: any = {
        inputs: {},
        query: message,
        response_mode: "blocking",
        user: userId,
        conversation_id: conversationId,
      };

      // メッセージプレビューをキャッシュ
      const messagePreview = message.length > 50 ? message.substring(0, 50) + "..." : message;

      console.log(`Sending to Dify API:`, {
        conversation_id: conversationId,
        user: userId,
        query: messagePreview
      });

      if (imageUrl) {
        requestBody.files = [{
          type: "image",
          transfer_method: "remote_url",
          url: imageUrl,
        }];
      }

      console.log(`About to call Dify API at: ${apiEndpoint}/chat-messages`);
      
      // タイムアウト制御付きでfetch実行
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10分タイムアウト
      
      const response = await fetch(`${apiEndpoint}/chat-messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log(`Dify API response received: ${response.status} ${response.statusText} (after ${Date.now() - startTime}ms)`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Dify API error:", {
          status: response.status,
          statusText: response.statusText,
          url: `${apiEndpoint}/chat-messages`,
          error: errorText.substring(0, 500),
          hasApiKey: !!apiKey,
          apiKeyLength: apiKey?.length || 0,
          requestBody: JSON.stringify(requestBody).substring(0, 300)
        });
        
        // Handle specific error cases
        if (response.status === 404 && errorText.includes("Conversation Not Exists")) {
          console.log("Conversation not found, retrying with new conversation");
          return this.sendToDify(apiEndpoint, apiKey, message, "", userId, imageUrl);
        } else if (response.status === 401) {
          return { answer: "申し訳ございません。認証エラーが発生しました。" };
        } else if (response.status === 403) {
          return { answer: "申し訳ございません。アクセス権限がありません。" };
        } else if (response.status === 429) {
          return { answer: "申し訳ございません。リクエスト制限に達しました。しばらく時間をおいて再度お試しください。" };
        } else if (response.status >= 500) {
          return { answer: "申し訳ございません。サーバーエラーが発生しました。" };
        }
        return { answer: "申し訳ございません。一時的にサービスが利用できません。" };
      }

      let difyResult: DifyResponse;
      try {
        difyResult = await response.json() as DifyResponse;
      } catch (parseError) {
        console.error("Failed to parse Dify API response as JSON:", {
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          responseStatus: response.status,
          responseHeaders: Object.fromEntries(response.headers.entries())
        });
        return { answer: "申し訳ございません。応答の解析に失敗しました。" };
      }
      
      const duration = Date.now() - startTime;
      console.log(`Dify API response:`, {
        answer: difyResult.answer?.substring(0, 100) || "No answer",
        conversation_id: difyResult.conversation_id || "No conversation_id",
        duration: `${duration}ms`,
        hasAnswer: !!difyResult.answer,
        answerLength: difyResult.answer?.length || 0
      });
      
      // Validate that we have a meaningful answer
      if (!difyResult.answer || difyResult.answer.trim() === "") {
        console.warn("Dify API returned empty or undefined answer:", {
          answer: difyResult.answer,
          fullResponse: difyResult
        });
        return { answer: "申し訳ございません。回答を生成できませんでした。" };
      }
      
      return {
        answer: difyResult.answer,
        conversation_id: difyResult.conversation_id
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // タイムアウトエラーの場合
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`Dify API timeout after ${duration}ms`);
        return { answer: "申し訳ございません。応答に時間がかかりすぎています。もう一度お試しください。" };
      }
      
      console.error(`Dify API error after ${duration}ms:`, {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      
      return { answer: "申し訳ございます。一時的にサービスが利用できません。" };
    }
  }

  private async pushToLine(accessToken: string, userId: string, message: string) {
    // メッセージ長さ制限（LINEの上限5000文字）
    if (message.length > 5000) {
      console.warn("LINE message too long, truncating:", message.length);
      message = message.substring(0, 4900) + "...\n（メッセージが長すぎたため省略されました）";
    }
    
    console.log(`LINE Push attempt:`, {
      userId: userId,
      messageLength: message.length,
      hasAccessToken: !!accessToken,
      tokenLength: accessToken?.length || 0
    });
    
    try {
      // タイムアウト制御付きでLINE API呼び出し
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒タイムアウト
      
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
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
        throw new Error(`LINE API error: ${response.status}`);
      } else {
        console.log("LINE Push message sent successfully");
      }
    } catch (error) {
      // タイムアウトエラーの場合
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("LINE Push API timeout");
        throw new Error("LINE Push API timeout");
      }
      
      console.error("Error pushing to LINE:", error);
      throw error; // Re-throw to trigger step retry
    }
  }
}