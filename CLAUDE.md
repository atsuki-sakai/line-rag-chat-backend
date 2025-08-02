# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Architecture

This is a Cloudflare Worker API built with:
- **Hono** - Web framework
- **Chanfana** - OpenAPI auto-generation and validation
- **Drizzle ORM** - Type-safe database queries for D1
- **Cloudflare Workflows** - Durable execution for LINE message processing
- **Vitest** - Testing framework with Workers pool

### Application Flow
1. LINE webhook receives messages → `src/endpoints/line/webhook.ts`
2. Webhook triggers `LineMessageWorkflow` with user parameters
3. Workflow processes message through Dify AI API and stores in D1
4. Response sent back to LINE user

## Essential Commands

```bash
# Development
npm run dev                    # Start local dev server with DB seeding (uses pnpm internally)
npm run seedLocalDb           # Apply migrations to local D1 database

# Database
npm run predeploy             # Apply migrations to remote D1 (auto-runs before deploy)
wrangler d1 migrations apply DB --local   # Apply to local DB
wrangler d1 migrations apply DB --remote  # Apply to remote DB

# Deployment
npm run deploy                # Deploy to Cloudflare (includes predeploy)
wrangler deploy              # Direct deploy without npm lifecycle

# Testing
npm test                     # Full test suite with dry-run deploy validation
npx vitest run --config tests/vitest.config.mts  # Run tests only

# Schema & Types
npm run schema               # Generate OpenAPI schema with chanfana
npm run cf-typegen          # Generate Cloudflare Worker types
```

## Critical Implementation Details

### Cloudflare Workflows Integration
- **Creating instances**: Use `params` NOT `payload` when calling `workflowBinding.create({ params: workflowParams })`
- **Accessing data**: Inside workflows, use `event.payload` to access parameters
- **Environment typing**: Define `WorkflowEnv` interface and extend `WorkflowEntrypoint<WorkflowEnv, ParamsType>`

### D1 Database Constraints
- **Never pass `undefined`** to D1 bind parameters - always provide fallback values:
  ```typescript
  message_content: messageContent || null,
  image_url: imageUrl || null,
  dify_response: difyResult.answer || ""
  ```
- Use Drizzle ORM for type safety, but raw SQL for complex workflows
- Database is accessed via middleware that adds `c.get("db")` to context

### Project Structure Patterns
- **Endpoints**: Organized by domain (`/admin`, `/line`) with dedicated routers
- **Admin Features**: Message management, statistics, CSV export in `src/endpoints/admin/`
- **Workflows**: Separate directory for durable execution logic
- **Types**: Shared interfaces in `src/types.ts` and inferred from schema
- **Testing**: Integration tests mirror endpoint structure in `tests/integration/`

### Environment Configuration
- Environment variables in `wrangler.jsonc` → `vars` section
- D1 database binding named `"DB"` (database_name: "line-rag-chat-db")
- Workflow binding named `"LINE_MESSAGE_WORKFLOW"` (class_name: "LineMessageWorkflow")
- Development uses single environment (no production env)
- Observability enabled in wrangler config
- Node.js compatibility flag enabled

### LINE Integration Specifics
- Webhook validation uses HMAC-SHA256 signature verification
- Workflow handles: conversation management, Dify AI processing, response formatting
- Database stores conversation history with user mapping

### Admin Features Implementation
- **Message Management**: CRUD operations for LINE messages with pagination
- **Statistics**: Real-time message counts and user metrics
- **CSV Export**: Bulk data export functionality for analysis
- **Performance**: Optimized queries using window functions and proper indexing

## Testing Architecture

Tests use `@cloudflare/vitest-pool-workers` with:
- Database migrations applied in setup (`tests/apply-migrations.ts`)
- Isolated test environment with real Worker runtime
- Integration tests validate full request/response cycles
- Single worker configuration for test stability
- Experimental compatibility flags enabled for testing

## Workflow Implementation Details

### LineMessageWorkflow Architecture
- **Step 1**: Get or create conversation ID with database validation
- **Step 2**: Process message through Dify AI API with 10-minute timeout
- **Step 3**: Parallel execution of database save and LINE push using `Promise.allSettled`
- **Error Handling**: Graceful degradation - continues if one operation fails
- **Message Limits**: 10,000 chars for Dify, 5,000 chars for LINE (auto-truncation)
- **Conversation Management**: UUID validation for existing conversations, empty string for new ones

### Performance Optimizations
- Parallel database save and LINE push operations
- Timeout controls for external API calls (Dify: 10min, LINE: 20sec)
- Message content caching and preview logging
- Proper abort signal handling for fetch operations