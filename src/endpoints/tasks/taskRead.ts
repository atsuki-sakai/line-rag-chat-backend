import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { HandleArgs } from "../../types";
import { tasks, task } from "./base";
import { eq } from "drizzle-orm";

export class TaskRead extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Tasks"],
    summary: "Get a single Task",
    request: {
      params: z.object({
        id: z.string().transform(Number),
      }),
    },
    responses: {
      "200": {
        description: "Returns the requested task",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              result: task,
            }),
          },
        },
      },
      "404": {
        description: "Task not found",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              errors: z.array(z.object({
                code: z.number(),
                message: z.string(),
              })),
            }),
          },
        },
      },
    },
  };

  async handle(c: HandleArgs[0]) {
    const db = c.get("db");
    const { params } = await this.getValidatedData<typeof this.schema>();
    const { id } = params;

    const result = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (result.length === 0) {
      return c.json({
        success: false,
        errors: [{ code: 7404, message: "Task not found" }],
      }, 404);
    }

    return c.json({
      success: true,
      result: result[0],
    });
  }
}
