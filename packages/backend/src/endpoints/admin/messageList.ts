import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";
import { z } from "zod";
import { lineMessages } from "../../db/schema";
import { desc, sql, eq, and } from "drizzle-orm";
import { AppContext } from "../../types";

export class MessageList extends OpenAPIRoute {
  schema: OpenAPIRouteSchema = {
    tags: ["Admin"],
    summary: "Get all LINE messages from D1 database",
    request: {
      query: z.object({
        limit: z.string().optional().default("50"),
        offset: z.string().optional().default("0"),
        conversation_id: z.string().optional(),
        user_id: z.string().optional()
      })
    },
    responses: {
      "200": {
        description: "List of LINE messages",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              data: z.object({
                messages: z.array(z.object({
                  id: z.number(),
                  conversation_id: z.string(),
                  user_id: z.string(),
                  message_type: z.string(),
                  message_content: z.string().nullable(),
                  image_url: z.string().nullable(),
                  dify_response: z.string().nullable(),
                  created_at: z.string(),
                  updated_at: z.string()
                })),
                total: z.number(),
                limit: z.number(),
                offset: z.number()
              })
            })
          }
        }
      }
    }
  };

  async handle(c: AppContext) {
    const db = c.get("db");
    const limit = c.req.query("limit") || "50";
    const offset = c.req.query("offset") || "0";
    const conversation_id = c.req.query("conversation_id");
    const user_id = c.req.query("user_id");

    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    let whereConditions = [];
    if (conversation_id) {
      whereConditions.push(eq(lineMessages.conversation_id, conversation_id));
    }
    if (user_id) {
      whereConditions.push(eq(lineMessages.user_id, user_id));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [messages, totalResult] = await Promise.all([
      db.select()
        .from(lineMessages)
        .where(whereClause)
        .orderBy(desc(lineMessages.created_at))
        .limit(limitNum)
        .offset(offsetNum),
      db.select({ count: sql<number>`count(*)` })
        .from(lineMessages)
        .where(whereClause)
    ]);

    const total = totalResult[0]?.count || 0;

    return c.json({
      success: true,
      data: {
        messages,
        total,
        limit: limitNum,
        offset: offsetNum
      }
    });
  }
}