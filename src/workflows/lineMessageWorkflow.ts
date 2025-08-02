import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";
import { type LineMessageWorkflowParams } from "../types";
import { DifyService } from "../services/difyService";

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

export class LineMessageWorkflow extends WorkflowEntrypoint<Env, LineMessageWorkflowParams> {
  async run(event: WorkflowEvent<LineMessageWorkflowParams>, step: WorkflowStep) {
    
    const { userId, messageType, messageContent, imageUrl, env } = event.payload;



    if (!userId || userId === undefined) {
      console.error("Critical: userId is undefined or null");
      throw new Error("userId is required for workflow execution");
    }

    const db = this.env.DB;

    // Step 1: Get or create conversation ID with retry
    const conversationId = await step.do("get-conversation-id", async () => {
      return await this.getOrCreateConversationId(db, userId);
    });

    // Step 2: Process message with Dify using service
    const difyResult = await step.do("process-dify", async () => {
      if (!messageContent) {
        return { answer: "", conversation_id: conversationId };
      }

      const difyService = new DifyService(env.DIFY_API_ENDPOINT, env.DIFY_API_KEY);
      return await difyService.processMessage(messageContent, conversationId, userId, imageUrl);
    });

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
          this.pushToLine(env.LINE_CHANNEL_ACCESS_TOKEN, userId, difyResult.answer)
        ]);

        // 結果ログ
        if (dbResult.status !== 'fulfilled') {
          console.error(`❌ Database save failed for user: ${userId}:`, dbResult.reason);
        }

        if (lineResult.status !== 'fulfilled') {
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
        
        return messageRecord;
      });
    }

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
      
      // Check if existing conversation_id is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (existingId && uuidRegex.test(existingId)) {
        return existingId;
      }
    }
    return '';
  }


  private async pushToLine(accessToken: string, userId: string, message: string) {
    // メッセージ長さ制限（LINEの上限5000文字）
    if (message.length > 5000) {
      console.warn("LINE message too long, truncating:", message.length);
      message = message.substring(0, 4900) + "...\n（メッセージが長すぎたため省略されました）";
    }
    
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
        console.error("LINE Push API error:", errorText);
        throw new Error(`LINE API error: ${response.status}`);
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