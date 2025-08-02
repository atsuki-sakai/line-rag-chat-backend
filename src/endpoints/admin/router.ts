import { Hono } from "hono";
import { fromHono } from "chanfana";
import { MessageList } from "./messageList";
import { MessageView } from "./messageView";
import { MessageCsv } from "./messageCsv";
import { MessageStats } from "./messageStats";
import { MessageDelete, MessageDeletePreview } from "./messageDelete";

export const adminRouter = fromHono(new Hono());

adminRouter.get("/messages", MessageList);
adminRouter.get("/dashboard", MessageView);
adminRouter.get("/messages/csv", MessageCsv);
adminRouter.get("/stats", MessageStats);
adminRouter.delete("/messages", MessageDelete);
adminRouter.post("/messages/delete-preview", MessageDeletePreview);