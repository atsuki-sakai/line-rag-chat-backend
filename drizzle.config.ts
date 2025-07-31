import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    databaseId: "6bb69708-5035-4a0e-8632-0d5e159299a6",
    token: process.env.CLOUDFLARE_API_TOKEN!,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  },
});