# Brand Studio: architecture

Product spec: [requirements.md](./requirements.md). This doc is the contract for the
parallel feature phase.

## Stack (versions pinned in package.json)

| Concern | Choice |
|---|---|
| App | Next.js 16 App Router, React 19, TypeScript strict, `src/` dir, alias `@/*` |
| UI | Tailwind 4 + shadcn/ui (`base-nova` style, Base UI primitives), lucide icons, sonner toasts |
| DB | Neon Postgres + Drizzle ORM (Neon HTTP driver), migrations in `drizzle/` |
| Auth | Clerk (`@clerk/nextjs` 7), owner-locked |
| AI | Vercel AI SDK (`ai` 7) + `@ai-sdk/openai`, model from `OPENAI_MODEL` |
| Jobs | Trigger.dev v4 (`@trigger.dev/sdk`), tasks in `src/trigger/` |
| Files | Vercel Blob (`@vercel/blob`) |
| Tests | Vitest (`src/**/*.test.ts`) |
| Diagrams | tldraw (installed by the diagrams agent, not yet) |

`cacheComponents` is **off**: pages that call `auth()` or the DB are plain dynamic
pages; no `<Suspense>` gymnastics needed. Next 16 calls middleware "proxy": `src/proxy.ts`.

## Folder layout

```
src/
  app/                    routes (pages are thin: fetch via queries, render feature components)
    layout.tsx            shell: ClerkProvider, <main> column, BottomNav, Toaster   [phase 0]
    manifest.ts           web app manifest (icons in public/)                       [phase 0]
    sign-in/, not-allowed/                                                          [phase 0]
  components/
    ui/                   shadcn components (add more with `npx shadcn@latest add x`)
    bottom-nav.tsx        Home / Radar / Posts / Settings                           [phase 0]
    placeholder.tsx       temporary page body; delete usages as you build
  db/
    schema.ts             ALL tables, enums, json types, relations                  [phase 0]
    index.ts              getDb(): lazy Drizzle client                              [phase 0]
    seed.ts               default sources + reflection questions                    [phase 0]
  features/<feature>/     actions.ts, queries.ts, components, lib, tests            [feature agents]
  lib/
    ai.ts                 getModel()                                                [phase 0]
    auth.ts               isOwner(), requireOwner()                                 [phase 0]
    env.ts                env(), requireEnv(), list of every env var                [phase 0]
    week.ts               weekOf() (Monday, Asia/Karachi), defaultPostType()        [phase 0]
    utils.ts              cn()                                                      [shadcn]
  proxy.ts                Clerk + owner lock                                        [phase 0]
  trigger/                Trigger.dev tasks
drizzle/                  generated SQL migrations (never edit by hand)
```

## Conventions

- **Server actions** live in `src/features/<feature>/actions.ts` (`"use server"`), and
  start with `await requireOwner()` from `@/lib/auth`. Route handlers do the same.
- **Data access** lives in `src/features/<feature>/queries.ts`. Pages and actions call
  these; no `getDb()` calls scattered through components.
- **All LLM calls are server-side** (actions, route handlers, Trigger tasks), via
  `getModel()` from `@/lib/ai` with `generateText` / `streamText`. Structured output:
  `output: Output.object({ schema })` with zod. Check `node_modules/ai/docs/` before
  writing AI SDK code; the API changes often.
- **Never invent the owner's experience.** Drafts use only facts from the radar item
  and the interview answers; missing facts become a visible `[ADD: ...]` placeholder.
- **DB:** `getDb()` from `@/db`. Neon HTTP driver: no interactive transactions, use
  `getDb().batch([...])`. Never call `getDb()` at module top level (breaks builds
  without `DATABASE_URL`).
- **Env:** read through `env()` / `requireEnv()` from `@/lib/env` on the server. Client
  code reads `process.env.NEXT_PUBLIC_*` literally. Never throw at import time.
- **Trigger.dev:** tasks are named exports in `src/trigger/`, unique `id`. Trigger them
  from app code with a type-only import: `tasks.trigger<typeof myTask>("my-task", payload)`.
  Tasks run on Trigger.dev, so they need their own env vars set in its dashboard.
- **Uploads:** Vercel Blob `put()` from a server action/route; store the URL in `uploads`.
- **UI:** mobile-first (iPhone). Use shadcn components and semantic tokens
  (`bg-background`, `text-muted-foreground`); `flex flex-col gap-*`, not `space-y-*`.
  The layout already provides page padding and bottom-nav clearance.
- **Tests:** colocate `*.test.ts` next to the code; no network in tests (mock LLM and
  Firecrawl).
- **Copy:** follow the `no-ai-slop` skill for any text the app shows or generates.

## Auth

- `src/proxy.ts` runs `clerkMiddleware`: every route except `/sign-in` and
  `/not-allowed` requires a signed-in user (`auth.protect()`), and that user's id must
  equal `OWNER_CLERK_USER_ID`. Others are redirected to `/not-allowed` (API routes get 403).
  Unset `OWNER_CLERK_USER_ID` means nobody gets in (fails closed).
- First run: sign in, `/not-allowed` shows your user id, put it in `OWNER_CLERK_USER_ID`.
  In the Clerk dashboard, restrict sign-ups so no one else can create an account.
- Without Clerk keys: `npm run build` works. `npm run dev` uses Clerk keyless mode
  (temporary keys written to `.clerk/`, gitignored). Production needs real keys.

## Schema summary (`src/db/schema.ts`)

DB columns are snake_case; TS keys camelCase (`casing: "snake_case"`). All ids are uuid.

| Table | Purpose / key columns |
|---|---|
| `profile` | single row: handle, bio, stack[], projects (text), topics[], avoid_topics[], never_mention[] |
| `voice_examples` | text, source `sample`/`final_post`, post_id?, platform? |
| `sources` | name, url?, query? (for kind `search`), kind `hn`/`github_trending`/`changelog`/`blog`/`search`, enabled |
| `radar_runs` | status `running`/`done`/`failed`, error, trigger_run_id, started_at, finished_at |
| `radar_items` | run_id, source_id?, **url unique**, title, summary, why_it_matters, suggested_type (post_type), score, shown, used |
| `reflections` | question, answer?, used, answered_at |
| `posts` | type `explain`/`tried`/`lessons`, status `draft`/`interview`/`drafted`/`posted`, week_of (date), title, radar_item_id?, reflection_id? |
| `interview_qas` | post_id, order (unique per post), question, answer? |
| `uploads` | post_id, kind `image`/`code`, blob_url?, code_text?, is_generated |
| `drafts` | post_id, platform `linkedin`/`x`/`instagram`, content jsonb (`DraftContent`), version (unique per post+platform), is_final, posted_at |
| `slop_flags` | draft_id, source `lint`/`llm`, rule, quote, suggestion, dismissed |
| `diagrams` | post_id (unique), spec jsonb (`DiagramSpec`), tldraw_snapshot jsonb, png_url |
| `slides` | post_id, order (unique per post), kind `title`/`text`/`diagram`/`code`/`quote`, content jsonb (`SlideContent`), png_url |

Child rows cascade on post delete. Relations are defined for `db.query.posts.findFirst({ with: { drafts: true } })`.
Schema changes: edit `schema.ts`, `npm run db:generate`, commit the SQL. Never `drizzle-kit push`.

## Ownership map (parallel phase)

| Feature | Owns |
|---|---|
| radar | `src/features/radar/**`, `src/trigger/radar*.ts`, `src/app/radar/**` |
| drafting (interview + drafts + slop check) | `src/features/interview/**`, `src/features/drafts/**`, `src/features/slop/**`, `src/app/posts/[id]/interview/**`, `src/app/posts/[id]/drafts/**` |
| diagrams | `src/features/diagrams/**`, `src/app/posts/[id]/diagram/**` |
| slides & post kit | `src/features/slides/**`, `src/features/postkit/**`, `src/app/posts/[id]/kit/**`, `src/app/api/slides/**` |
| home / profile / reflections / history | `src/features/profile/**`, `src/features/reflections/**`, `src/features/posts/**`, `src/app/page.tsx`, `src/app/posts/page.tsx`, `src/app/posts/[id]/page.tsx`, `src/app/settings/**` |

Shared files (`src/db/schema.ts`, `src/lib/**`, `src/app/layout.tsx`, `src/components/bottom-nav.tsx`,
`src/proxy.ts`, config files) are owned by phase 0. Feature agents must not edit them,
except to append clearly marked exports if unavoidable:

```ts
// --- added by <feature>: <reason> ---
```

Adding shadcn components (`src/components/ui/*`) and npm packages is allowed; mention
them in your report so merges are easy. Cross-feature reads go through the other
feature's `queries.ts`, not its internals.
