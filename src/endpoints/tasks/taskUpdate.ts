import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { HandleArgs } from "../../types";
import { tasks, task } from "./base";
import { eq } from "drizzle-orm";

export class TaskUpdate extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Tasks"],
    summary: "Update a Task",
    request: {
      params: z.object({
        id: z.string().transform(Number),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().optional(),
              slug: z.string().optional(),
              description: z.string().optional(),
              completed: z.boolean().optional(),
              due_date: z.string().datetime().optional(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Returns the updated task",
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
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;

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

    const updateData = Object.fromEntries(
      Object.entries(data.body).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(updateData).length === 0) {
      return c.json({
        success: true,
        result: existingTask[0],
      });
    }

    const result = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    return c.json({
      success: true,
      result: result[0],
    });
  }
}
