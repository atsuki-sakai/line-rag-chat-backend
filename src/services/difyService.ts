import type { AIService, AIResponse, DifyResponse } from "../types";

export class DifyService implements AIService {
  constructor(
    private apiEndpoint: string,
    private apiKey: string
  ) {}

  async processMessage(
    message: string,
    conversationId: string,
    userId: string,
    imageUrl?: string | null
  ): Promise<AIResponse> {
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

      if (imageUrl) {
        requestBody.files = [{
          type: "image",
          transfer_method: "remote_url",
          url: imageUrl,
        }];
      }
      // タイムアウト制御付きでfetch実行
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000000); // 100分タイムアウト
      
      const response = await fetch(`${this.apiEndpoint}/chat-messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Dify API error:", errorText);
        
        // Handle specific error cases
        if (response.status === 404 && errorText.includes("Conversation Not Exists")) {
          console.log("Conversation not found, retrying with new conversation");
          return this.processMessage(message, "", userId, imageUrl);
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
        console.error("Failed to parse Dify API response as JSON:", parseError);
        return { answer: "申し訳ございません。応答の解析に失敗しました。" };
      }
      
      // Validate that we have a meaningful answer
      if (!difyResult.answer || difyResult.answer.trim() === "") {
        console.warn("Dify API returned empty or undefined answer:", difyResult);
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
}