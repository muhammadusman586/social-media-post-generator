# CLAUDE.md

@AGENTS.md

## Commands

```bash
npm run dev          # Next dev server (Clerk keyless mode if no keys)
npm run build        # production build; must pass with no .env
npm run lint         # ESLint
npm run test         # Vitest (src/**/*.test.ts)
npm run db:generate  # drizzle-kit generate after editing src/db/schema.ts
npm run db:migrate   # apply migrations to DATABASE_URL
npm run db:seed      # default sources + reflection questions (idempotent)
npm run trigger:dev  # Trigger.dev dev server (needs `npx trigger.dev@4.8.5 login`)
```

Env vars: `.env.example` (copy to `.env.local`), documented in `src/lib/env.ts`.

## Architecture

Read [docs/architecture.md](docs/architecture.md) (stack, folders, schema, conventions,
ownership map) and [docs/requirements.md](docs/requirements.md) (product spec).

## Rules

- Single user, mobile-first: one owner (Clerk id in `OWNER_CLERK_USER_ID`), used mostly
  on an iPhone. Design for a narrow screen first.
- No AI slop: drafts never invent the user's experience, opinions or results. They use
  only the radar item and the user's answers, and leave `[ADD: ...]` for anything missing.
  Follow the `no-ai-slop` skill for generated and UI copy.
- All LLM calls are server-side, through `getModel()` in `src/lib/ai.ts`.
- Use ctx7 for library docs (`npx ctx7@latest library <name> "<q>"`, then `docs`), and the
  bundled docs in `node_modules/next/dist/docs/` and `node_modules/ai/docs/`.
- Builds and tests must never need secrets: no env reads or DB connections at import time.
