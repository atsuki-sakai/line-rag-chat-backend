import { OpenAPIRoute, OpenAPIRouteSchema } from "chanfana";

export abstract class MessageAdminRoute extends OpenAPIRoute {
  getSchema(): OpenAPIRouteSchema {
    return {
      tags: ["Admin"],
      summary: "Admin endpoint for message management",
      responses: {
        "200": {
          description: "Successful response",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  data: { type: "object" }
                }
              }
            }
          }
        }
      }
    };
  }
}

export interface Env {
  DB: D1Database;
}