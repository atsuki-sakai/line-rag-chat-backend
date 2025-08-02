import { Hono } from "hono";
import { fromHono } from "chanfana";
import { LineWebhook } from "./webhook";

export const lineRouter = fromHono(new Hono());

lineRouter.post("/webhook", LineWebhook);