import { OpenAPIRoute, Query } from "chanfana";
import { z } from "zod";
import { HandleArgs } from "../../types";
import { tasks, task } from "./base";
import { desc, like, or, sql } from "drizzle-orm";

export class TaskList extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Tasks"],
    summary: "List Tasks",
    request: {
      query: z.object({
        search: z.string().optional(),
        page: z.string().transform(Number).default("1"),
        limit: z.string().transform(Number).default("10"),
      }),
    },
    responses: {
      "200": {
        description: "Returns a list of tasks",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              result: z.array(task),
              result_info: z.object({
                page: z.number(),
                per_page: z.number(),
                count: z.number(),
                total_count: z.number(),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: HandleArgs[0]) {
    const db = c.get("db");
    const { search, page, limit } = await this.getValidatedData<typeof this.schema>();

    let query = db.select().from(tasks);
    
    if (search) {
      query = query.where(
        or(
          like(tasks.name, `%${search}%`),
          like(tasks.slug, `%${search}%`),
          like(tasks.description, `%${search}%`)
        )
      );
    }

    const offset = (page - 1) * limit;
    const results = await query
      .orderBy(desc(tasks.id))
      .limit(limit)
      .offset(offset);

    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .then(result => result[0].count);

    return c.json({
      success: true,
      result: results,
      result_info: {
        page,
        per_page: limit,
        count: results.length,
        total_count: totalCount,
      },
    });
  }
}
