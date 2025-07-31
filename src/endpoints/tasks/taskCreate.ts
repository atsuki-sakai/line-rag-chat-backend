import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { HandleArgs } from "../../types";
import { tasks, task, type InsertTask } from "./base";

export class TaskCreate extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Tasks"],
    summary: "Create a new Task",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string(),
              slug: z.string(),
              description: z.string(),
              completed: z.boolean(),
              due_date: z.string().datetime(),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Returns the created task",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              result: task,
            }),
          },
        },
      },
    },
  };

  async handle(c: HandleArgs[0]) {
    const db = c.get("db");
    const data = await this.getValidatedData<typeof this.schema>();

    const insertData: InsertTask = {
      name: data.body.name,
      slug: data.body.slug,
      description: data.body.description,
      completed: data.body.completed,
      due_date: data.body.due_date,
    };

    const result = await db.insert(tasks).values(insertData).returning();

    return c.json({
      success: true,
      result: result[0],
    });
  }
}
