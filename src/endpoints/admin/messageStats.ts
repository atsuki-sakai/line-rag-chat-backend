import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";
import { z } from "zod";
import { lineMessages } from "../../db/schema";
import { sql } from "drizzle-orm";
import { AppContext } from "../../types";

export class MessageStats extends OpenAPIRoute {
  schema: OpenAPIRouteSchema = {
    tags: ["Admin"],
    summary: "Get database statistics for performance monitoring",
    responses: {
      "200": {
        description: "Database statistics",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                total_messages: z.number(),
                unique_users: z.number(),
                unique_conversations: z.number(),
                messages_by_type: z.array(z.object({
                  message_type: z.string(),
                  count: z.number()
                })),
                recent_activity: z.object({
                  last_24h: z.number(),
                  last_7d: z.number(),
                  last_30d: z.number()
                }),
                performance_warning: z.boolean(),
                recommendation: z.string().optional()
              })
            })
          }
        }
      }
    }
  };

  async handle(c: AppContext) {
    const db = c.get("db");

    try {
      // 並列でクエリ実行（パフォーマンス向上）
      const [
        totalResult,
        uniqueUsersResult,
        uniqueConversationsResult,
        messageTypesResult,
        recent24hResult,
        recent7dResult,
        recent30dResult
      ] = await Promise.all([
        // 総メッセージ数
        db.select({ count: sql<number>`count(*)` }).from(lineMessages),
        
        // ユニークユーザー数
        db.select({ count: sql<number>`count(distinct user_id)` }).from(lineMessages),
        
        // ユニーク会話数
        db.select({ count: sql<number>`count(distinct conversation_id)` }).from(lineMessages),
        
        // メッセージタイプ別集計
        db.select({
          message_type: lineMessages.message_type,
          count: sql<number>`count(*)`
        })
        .from(lineMessages)
        .groupBy(lineMessages.message_type),
        
        // 過去24時間
        db.select({ count: sql<number>`count(*)` })
        .from(lineMessages)
        .where(sql`datetime(created_at) >= datetime('now', '-1 day')`),
        
        // 過去7日
        db.select({ count: sql<number>`count(*)` })
        .from(lineMessages)
        .where(sql`datetime(created_at) >= datetime('now', '-7 days')`),
        
        // 過去30日
        db.select({ count: sql<number>`count(*)` })
        .from(lineMessages)
        .where(sql`datetime(created_at) >= datetime('now', '-30 days')`)
      ]);

      const totalMessages = totalResult[0]?.count || 0;
      const uniqueUsers = uniqueUsersResult[0]?.count || 0;
      const uniqueConversations = uniqueConversationsResult[0]?.count || 0;

      // パフォーマンス警告とレコメンデーション
      let performanceWarning = false;
      let recommendation = undefined;

      if (totalMessages > 50000) {
        performanceWarning = true;
        recommendation = "50K件を超えました。インデックス追加やデータアーカイブを検討してください。";
      } else if (totalMessages > 10000) {
        performanceWarning = true;
        recommendation = "10K件を超えました。定期的なデータクリーンアップを推奨します。";
      }

      return c.json({
        success: true,
        data: {
          total_messages: totalMessages,
          unique_users: uniqueUsers,
          unique_conversations: uniqueConversations,
          messages_by_type: messageTypesResult,
          recent_activity: {
            last_24h: recent24hResult[0]?.count || 0,
            last_7d: recent7dResult[0]?.count || 0,
            last_30d: recent30dResult[0]?.count || 0
          },
          performance_warning: performanceWarning,
          recommendation
        }
      });

    } catch (error) {
      console.error("Stats query error:", error);
      return c.json({
        success: false,
        error: "Failed to fetch statistics"
      }, 500);
    }
  }
}