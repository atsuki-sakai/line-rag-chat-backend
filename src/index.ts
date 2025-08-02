import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { lineRouter } from "./endpoints/line/router";
import { adminRouter } from "./endpoints/admin/router";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { createDb } from "./db";
import { LineMessageWorkflow } from "./workflows/lineMessageWorkflow";
import { basicAuth } from "hono/basic-auth";


// Start a Hono app
const app = new Hono<{ 
  Bindings: Env & {
    LINE_MESSAGE_WORKFLOW: Workflow;
    ADMIN_USER: string;
    ADMIN_PASSWORD: string;
  };
  Variables: {
    db: ReturnType<typeof createDb>;
  };
}>();

// Add Drizzle database middleware
app.use("*", async (c, next) => {
  const db = createDb(c.env.DB);
  c.set("db", db);
  await next();
});

app.onError((err, c) => {
  if (err instanceof ApiException) {
    return c.json(
      { success: false, errors: err.buildResponse() },
      err.status as ContentfulStatusCode,
    );
  }

  // --- HTTPException の処理を追加 ---
  // このようにしないとBasicAuthの認証がうまく動かない.
  if (err instanceof HTTPException) {
    return err.getResponse(); // 正しいレスポンスを返す
  }
  // ------------------------------------

  console.error("Global error handler caught:", err);
  // スタックトレースも出力 (任意)
  if (err.stack) {
    console.error("Error stack:", err.stack);
  }

  return c.json(
    {
      success: false,
      errors: [{ code: 7000, message: "Internal Server Error" }],
    },
    500,
  );
});

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
  schema: {
    info: {
      title: "LINE RAG Chat Backend API",
      version: "1.0.0",
      description: "API for LINE RAG Chat Backend with AI-powered messaging and task management",
    },
  },
});

// Register LINE Sub router
openapi.route("/line", lineRouter);


app.use("/admin/*", basicAuth({
  verifyUser: (username, password, c) => {
    // 環境変数が設定されているか確認 (堅牢性向上)
    const expectedUser = c.env.ADMIN_USER;
    const expectedPass = c.env.ADMIN_PASSWORD;

    if (expectedUser === undefined || expectedPass === undefined) {
        console.error("ADMIN_USER or ADMIN_PASSWORD is not set in environment variables.");
        return false;
    }
    return username === expectedUser && password === expectedPass;
  }
}));

adminRouter.get('/', (c) => {
  return c.redirect('/admin/dashboard');
});

openapi.route("/admin", adminRouter); 

// Export the Hono app
export default app;

// Export the Workflow class
export { LineMessageWorkflow };
