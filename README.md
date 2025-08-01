# OpenAPI Template

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/chanfana-openapi-template)

![OpenAPI Template Preview](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/91076b39-1f5b-46f6-7f14-536a6f183000/public)

<!-- dash-content-start -->

This is a Cloudflare Worker with OpenAPI 3.1 Auto Generation and Validation using [chanfana](https://github.com/cloudflare/chanfana) and [Hono](https://github.com/honojs/hono).

This is an example project made to be used as a quick start into building OpenAPI compliant Workers that generates the
`openapi.json` schema automatically from code and validates the incoming request to the defined parameters or request body.

This template includes various endpoints, a D1 database, and integration tests using [Vitest](https://vitest.dev/) as examples. In endpoints, you will find [chanfana D1 AutoEndpoints](https://chanfana.com/endpoints/auto/d1) and a [normal endpoint](https://chanfana.com/endpoints/defining-endpoints) to serve as examples for your projects.

Besides being able to see the OpenAPI schema (openapi.json) in the browser, you can also extract the schema locally no hassle by running this command `npm run schema`.

<!-- dash-content-end -->

> [!IMPORTANT]
> When using C3 to create this project, select "no" when it asks if you want to deploy. You need to follow this project's [setup steps](https://github.com/cloudflare/templates/tree/main/openapi-template#setup-steps) before deploying.

## Getting Started

Outside of this repo, you can start a new project with this template using [C3](https://developers.cloudflare.com/pages/get-started/c3/) (the `create-cloudflare` CLI):

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/openapi-template
```

A live public deployment of this template is available at [https://openapi-template.templates.workers.dev](https://openapi-template.templates.workers.dev)

## Setup Steps

1. Install the project dependencies with a package manager of your choice:
   ```bash
   npm install
   ```
2. Create a [D1 database](https://developers.cloudflare.com/d1/get-started/) with the name "openapi-template-db":
   ```bash
   npx wrangler d1 create openapi-template-db
   ```
   ...and update the `database_id` field in `wrangler.json` with the new database ID.
3. Run the following db migration to initialize the database (notice the `migrations` directory in this project):
   ```bash
   npx wrangler d1 migrations apply DB --remote
   ```
4. Deploy the project!
   ```bash
   npx wrangler deploy
   ```

## Testing

This template includes integration tests using [Vitest](https://vitest.dev/). To run the tests locally:

```bash
npm run test
```

Test files are located in the `tests/` directory, with examples demonstrating how to test your endpoints and database interactions.

## Cloudflare Workflows Implementation Notes

This project includes Cloudflare Workflows integration with LINE webhook processing. Key implementation considerations:

### ⚠️ Critical Issues Resolved

#### 1. Workflow Parameter Passing
**Issue**: Workflow instances received empty payload (`Event payload: {}`)
**Root Cause**: Incorrect API usage - used `payload` instead of `params`
**Solution**: 
```typescript
// ❌ Incorrect
await workflowBinding.create({ payload: workflowParams })

// ✅ Correct  
await workflowBinding.create({ params: workflowParams })
```

#### 2. D1 Database undefined Values
**Issue**: `D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'`
**Root Cause**: D1 doesn't accept `undefined` values in bind parameters
**Solution**: Always provide fallback values:
```typescript
// ❌ Incorrect - can pass undefined
message_content: messageContent,
image_url: imageUrl,
dify_response: difyResult.answer,

// ✅ Correct - fallback to null/empty string
message_content: messageContent || null,
image_url: imageUrl || null, 
dify_response: difyResult.answer || "",
```

#### 3. WorkflowEntrypoint Type Safety
**Issue**: `this.env.DB` was type `unknown`, causing TypeScript errors
**Solution**: Define proper environment interface:
```typescript
interface WorkflowEnv {
  DB: D1Database;
  DIFY_API_ENDPOINT: string;
  // ... other bindings
}

export class LineMessageWorkflow extends WorkflowEntrypoint<WorkflowEnv, LineMessageWorkflowParams> {
  // Now this.env.DB is properly typed as D1Database
}
```

### 🔧 Best Practices for Workflows

1. **Always validate input parameters early** in workflow execution
2. **Use proper null/undefined handling** for D1 database operations  
3. **Define environment interfaces** for type safety
4. **Use `params` not `payload`** when creating workflow instances
5. **Access parameters via `event.payload`** within workflow methods

### 📁 Project Structure

1. Your main router is defined in `src/index.ts`.
2. Each endpoint has its own file in `src/endpoints/`.
3. Workflows are in `src/workflows/` directory.
4. Integration tests are located in the `tests/` directory.
5. For more information read the [chanfana documentation](https://chanfana.com/), [Hono documentation](https://hono.dev/docs), [Cloudflare Workflows documentation](https://developers.cloudflare.com/workflows/), and [Vitest documentation](https://vitest.dev/guide/).
