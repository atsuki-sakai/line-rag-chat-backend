import type { Context } from "hono";
import type { DrizzleDB } from "./db";

export type AppContext = Context<{ 
  Bindings: Env & {
    LINE_MESSAGE_WORKFLOW: Workflow;
  };
  Variables: {
    db: DrizzleDB;
  };
}>;
export type HandleArgs = [AppContext];
