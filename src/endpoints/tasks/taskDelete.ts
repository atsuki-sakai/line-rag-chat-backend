import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { HandleArgs } from "../../types";
import { tasks } from "./base";
import { eq } from "drizzle-orm";

export class TaskDelete extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Tasks"],
    summary: "Delete a Task",
    request: {
      params: z.object({
        id: z.string().transform(Number),
      }),
    },
    responses: {
      "200": {
        description: "Returns success message",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              result: z.object({
                message: z.string(),
              }),
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
    const { id } = await this.getValidatedData<typeof this.schema>();

    const existingTask = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (existingTask.length === 0) {
      return c.json({
        success: false,
        errors: [{ code: 7404, message: "Task not found" }],
      }, 404);
    }

    await db.delete(tasks).where(eq(tasks.id, id));

    return c.json({
      success: true,
      result: {
        message: "Task deleted successfully",
      },
    });
  }
}
