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
    
    // ウィンドウ関数を使用してカウントとデータを1回のクエリで取得
    const baseQuery = db
      .select({
        id: tasks.id,
        name: tasks.name,
        slug: tasks.slug,
        description: tasks.description,
        completed: tasks.completed,
        due_date: tasks.due_date,
        total_count: sql<number>`count(*) over()`.as('total_count')
      })
      .from(tasks);
    
    // 検索条件があれば適用
    const finalQuery = search ? 
      baseQuery.where(
        or(
          like(tasks.name, `%${search}%`),
          like(tasks.slug, `%${search}%`),
          like(tasks.description, `%${search}%`)
        )
      ) : baseQuery;

    const results = await finalQuery
      .orderBy(desc(tasks.id))
      .limit(limit)
      .offset(offset);

    // 最初の行からtotal_countを取得（全行で同じ値）
    const totalCount = results.length > 0 ? results[0].total_count : 0;

    // total_countを除いたクリーンなデータを返す
    const cleanResults = results.map(({ total_count, ...task }) => task);

    return c.json({
      success: true,
      result: cleanResults,
      result_info: {
        page,
        per_page: limit,
        count: cleanResults.length,
        total_count: totalCount,
      },
    });
  }
}
