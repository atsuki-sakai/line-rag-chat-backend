import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";
import { z } from "zod";
import { lineMessages } from "../../db/schema";
import { desc, eq, and } from "drizzle-orm";
import { AppContext } from "../../types";

export class MessageCsv extends OpenAPIRoute {
  schema: OpenAPIRouteSchema = {
    tags: ["Admin"],
    summary: "Download LINE messages as CSV",
    request: {
      query: z.object({
        conversation_id: z.string().optional(),
        user_id: z.string().optional()
      })
    },
    responses: {
      "200": {
        description: "CSV file download",
        content: {
          "text/csv": {
            schema: z.string()
          }
        }
      }
    }
  };

  async handle(c: AppContext) {
    const db = c.get("db");
    const conversation_id = c.req.query("conversation_id");
    const user_id = c.req.query("user_id");
    const maxRecords = parseInt(c.req.query("limit") || "5000"); // 安全な上限設定

    let whereConditions = [];
    if (conversation_id) {
      whereConditions.push(eq(lineMessages.conversation_id, conversation_id));
    }
    if (user_id) {
      whereConditions.push(eq(lineMessages.user_id, user_id));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 大量データ対策：バッチ処理でストリーミング
    const batchSize = 1000;
    let offset = 0;
    let allMessages: any[] = [];
    let totalProcessed = 0;

    while (totalProcessed < maxRecords) {
      const currentBatchSize = Math.min(batchSize, maxRecords - totalProcessed);
      
      const batch = await db.select()
        .from(lineMessages)
        .where(whereClause)
        .orderBy(desc(lineMessages.created_at))
        .limit(currentBatchSize)
        .offset(offset);

      if (batch.length === 0) break;
      
      allMessages.push(...batch);
      totalProcessed += batch.length;
      offset += batch.length;

      // メモリ使用量チェック（概算）
      const estimatedMemoryMB = (allMessages.length * 0.5) / 1024; // 平均0.5KB/record
      if (estimatedMemoryMB > 50) { // 50MB制限
        console.warn(`CSV export stopped at ${allMessages.length} records due to memory limit`);
        break;
      }
    }

    const csv = this.generateCSV(allMessages);
    
    const filterSuffix = conversation_id ? `_conv_${conversation_id.substring(0, 8)}` : 
                        user_id ? `_user_${user_id.substring(0, 8)}` : '';
    const filename = `line_messages_${new Date().toISOString().split('T')[0]}${filterSuffix}.csv`;
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
        'X-Total-Records': allMessages.length.toString(),
        'X-Max-Records': maxRecords.toString()
      }
    });
  }

  private generateCSV(messages: any[]): string {
    const headers = [
      'ID',
      'Conversation ID',
      'User ID', 
      'Message Type',
      'Message Content',
      'Image URL',
      'AI Response',
      'Created At',
      'Updated At'
    ];

    const csvRows = [headers.join(',')];

    for (const msg of messages) {
      const row = [
        msg.id,
        this.escapeCsvField(msg.conversation_id),
        this.escapeCsvField(msg.user_id),
        this.escapeCsvField(msg.message_type),
        this.escapeCsvField(msg.message_content || ''),
        this.escapeCsvField(msg.image_url || ''),
        this.escapeCsvField(msg.dify_response || ''),
        this.escapeCsvField(msg.created_at),
        this.escapeCsvField(msg.updated_at)
      ];
      csvRows.push(row.join(','));
    }

    // Add BOM for proper UTF-8 encoding in Excel
    return '\ufeff' + csvRows.join('\n');
  }

  private escapeCsvField(field: string): string {
    if (field === null || field === undefined) {
      return '';
    }
    
    const stringField = String(field);
    
    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    
    return stringField;
  }
}