import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";
import { z } from "zod";
import { lineMessages } from "../../db/schema";
import { eq, and, lt, inArray, count } from "drizzle-orm";
import { AppContext } from "../../types";

export class MessageDelete extends OpenAPIRoute {
  schema: OpenAPIRouteSchema = {
    tags: ["Admin"],
    summary: "Delete LINE messages (single, batch, or bulk)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              delete_type: z.enum(["single", "batch", "bulk"]),
              // Single delete
              message_id: z.number().optional(),
              // Batch delete
              message_ids: z.array(z.number()).optional(),
              // Bulk delete
              conversation_id: z.string().optional(),
              user_id: z.string().optional(),
              older_than_days: z.number().optional(),
              // Safety confirmation
              confirm: z.boolean().default(false)
            })
          }
        }
      }
    },
    responses: {
      "200": {
        description: "Delete operation result",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              deleted_count: z.number(),
              message: z.string()
            })
          }
        }
      }
    }
  };

  async handle(c: AppContext) {
    const db = c.get("db");
    const body = await c.req.json();
    const { delete_type, message_id, message_ids, conversation_id, user_id, older_than_days, confirm } = body;

    // Safety check
    if (!confirm) {
      return c.json({
        success: false,
        deleted_count: 0,
        message: "削除操作には confirm: true が必要です"
      }, 400);
    }

    try {
      let deletedCount = 0;
      let message = "";

      switch (delete_type) {
        case "single":
          if (!message_id) {
            return c.json({
              success: false,
              deleted_count: 0,
              message: "message_id が必要です"
            }, 400);
          }

          const singleResult = await db.delete(lineMessages)
            .where(eq(lineMessages.id, message_id));
          
          deletedCount = singleResult.meta.changes;
          message = `メッセージID ${message_id} を削除しました`;
          break;

        case "batch":
          if (!message_ids || message_ids.length === 0) {
            return c.json({
              success: false,
              deleted_count: 0,
              message: "message_ids が必要です"
            }, 400);
          }

          if (message_ids.length > 1000) {
            return c.json({
              success: false,
              deleted_count: 0,
              message: "一度に削除できるのは1000件までです"
            }, 400);
          }

          // バッチ削除（複数のIDを指定）
          const batchResult = await db.delete(lineMessages)
            .where(inArray(lineMessages.id, message_ids));

          deletedCount = batchResult.meta.changes;
          message = `${message_ids.length}件のメッセージを削除しました（実際の削除数: ${deletedCount}）`;
          break;

        case "bulk":
          let whereConditions = [];
          let description = [];

          if (conversation_id) {
            whereConditions.push(eq(lineMessages.conversation_id, conversation_id));
            description.push(`会話ID: ${conversation_id}`);
          }

          if (user_id) {
            whereConditions.push(eq(lineMessages.user_id, user_id));
            description.push(`ユーザーID: ${user_id}`);
          }

          if (older_than_days) {
            // 現在の日時から指定日数を引いた日付を計算
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - older_than_days);
            const cutoffDateString = cutoffDate.toISOString();

            whereConditions.push(lt(lineMessages.created_at, cutoffDateString));
            description.push(`${older_than_days}日以前`);
          }

          if (whereConditions.length === 0) {
            return c.json({
              success: false,
              deleted_count: 0,
              message: "一括削除には少なくとも1つの条件が必要です"
            }, 400);
          }

          const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

          // 削除前に件数確認
          const countResult = await db.select({ count: count() })
            .from(lineMessages)
            .where(whereClause);
          
          const targetCount = countResult[0]?.count || 0;

          if (targetCount > 10000) {
            return c.json({
              success: false,
              deleted_count: 0,
              message: `対象件数が多すぎます (${targetCount}件)。より具体的な条件を指定してください`
            }, 400);
          }

          // 実際の削除実行
          const bulkResult = await db.delete(lineMessages)
            .where(whereClause);

          deletedCount = bulkResult.meta.changes;
          message = `条件 [${description.join(', ')}] で ${deletedCount}件のメッセージを削除しました`;
          break;

        default:
          return c.json({
            success: false,
            deleted_count: 0,
            message: "無効な delete_type です"
          }, 400);
      }

      console.log(`Delete operation completed: ${message} (${deletedCount} records)`);

      return c.json({
        success: true,
        deleted_count: deletedCount,
        message: message
      });

    } catch (error) {
      console.error("Delete operation failed:", error);
      return c.json({
        success: false,
        deleted_count: 0,
        message: `削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`
      }, 500);
    }
  }
}

export class MessageDeletePreview extends OpenAPIRoute {
  schema: OpenAPIRouteSchema = {
    tags: ["Admin"],
    summary: "Preview delete operation (dry run)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              conversation_id: z.string().optional(),
              user_id: z.string().optional(),
              older_than_days: z.number().optional()
            })
          }
        }
      }
    },
    responses: {
      "200": {
        description: "Delete preview result",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              target_count: z.number(),
              preview: z.array(z.object({
                id: z.number(),
                user_id: z.string(),
                conversation_id: z.string(),
                created_at: z.string()
              })),
              warning: z.string().optional()
            })
          }
        }
      }
    }
  };

  async handle(c: AppContext) {
    try {
      const db = c.get("db");
      const body = await c.req.json();
      const { conversation_id, user_id, older_than_days } = body;
      
      console.log('Delete preview request:', { conversation_id, user_id, older_than_days });

      let whereConditions = [];

      if (conversation_id) {
        whereConditions.push(eq(lineMessages.conversation_id, conversation_id));
      }

      if (user_id) {
        whereConditions.push(eq(lineMessages.user_id, user_id));
      }

      if (older_than_days) {
        // 現在の日時から指定日数を引いた日付を計算
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - older_than_days);
        const cutoffDateString = cutoffDate.toISOString();
        
        whereConditions.push(lt(lineMessages.created_at, cutoffDateString));
      }

      if (whereConditions.length === 0) {
        return c.json({
          success: false,
          target_count: 0,
          preview: [],
          warning: "少なくとも1つの条件を指定してください"
        });
      }

      const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

      const [countResult, previewResult] = await Promise.all([
        db.select({ count: count() })
          .from(lineMessages)
          .where(whereClause),
        db.select({
          id: lineMessages.id,
          user_id: lineMessages.user_id,
          conversation_id: lineMessages.conversation_id,
          created_at: lineMessages.created_at
        })
          .from(lineMessages)
          .where(whereClause)
          .limit(10)
      ]);
      
      const targetCount = countResult[0]?.count || 0;
      let warning = undefined;

      if (targetCount > 10000) {
        warning = "削除対象が10,000件を超えています。より具体的な条件を推奨します。";
      } else if (targetCount > 1000) {
        warning = "削除対象が1,000件を超えています。実行前に十分確認してください。";
      }

      return c.json({
        success: true,
        target_count: targetCount,
        preview: previewResult,
        warning
      });
      
    } catch (error) {
      console.error('Delete preview error:', error);
      return c.json({
        success: false,
        target_count: 0,
        preview: [],
        warning: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`
      }, 500);
    }
  }
}