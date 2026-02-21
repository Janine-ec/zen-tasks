# Zen Tasks — Claude Code Context

A single-user zen task manager. You talk to an AI assistant to add and manage tasks. The AI handles complexity — you never stare at a long list.

## Architecture

```
task-app/
├── api/          # Next.js app (TypeScript) — deployed to Vercel
├── frontend/     # Vanilla JS SPA — deployed to GitHub Pages
├── database/     # Supabase schema + seed SQL
└── docs/         # Setup guide
```

**Request flow:**
```
Frontend (GitHub Pages) → Next.js API (Vercel) → Supabase (Postgres)
                                               → Anthropic Claude API
                                               → Google Calendar API
                                               → Telegram Bot API
```

**API routes** (`api/src/app/api/`):
- `POST /api/task-agent` — main chat endpoint (add, complete, start, delete, snooze, suggest tasks)
- `GET  /api/list-tasks` — returns tasks by status
- `GET  /api/cron/nudge` — smart nudge cron (runs every 30 min via Vercel cron, 8am–9pm)
- `POST /api/telegram/webhook` — handles Telegram button callbacks and free-text replies

**Lib layer** (`api/src/lib/`):
- `anthropic.ts` — Claude API client + JSON parsing helpers
- `supabase.ts` — all DB operations (tasks, nudges, users)
- `google-calendar.ts` — OAuth2 client, event fetching, free/busy slots
- `telegram.ts` — sendMessage, answerCallbackQuery, sendNudge (with inline buttons)
- `prompts.ts` — all AI system prompts
- `time-context.ts` — time-of-day awareness (early_morning/morning/afternoon/evening/night)
- `types.ts` — all TypeScript interfaces and enums
- `middleware.ts` — CORS

## Design Principles

- **Lib layer is the boundary.** All external service calls (DB, AI, calendar, Telegram) go through `lib/`. Route handlers orchestrate; lib functions do the work.
- **Simple over clever.** Prefer readable code. No premature abstraction. Three similar lines is better than a helper that will only be called once.
- **Don't over-engineer.** Only add what's needed now. No feature flags, no backwards-compat shims, no speculative generality.
- **Soft deletes only.** Tasks are never physically removed — use `status: 'deleted'`.
- **AI fallback always.** If JSON parsing fails, show the raw AI text as a chat message. Never lose user input.
- **Single user for now.** RLS is intentionally open (`USING (true)`). Multi-user auth is a future concern — don't design for it prematurely.

## Code Conventions

- TypeScript strict mode is on — no disabling it
- No `any` types (ESLint warns). Use proper interfaces from `types.ts`
- Single quotes, 2-space indent, 100-char line width (enforced by Prettier)
- `_varName` prefix for intentionally unused variables
- `no-console` is a warning not an error — keep `console.error` in catch blocks, remove debug logs before committing

## Testing Policy

- **All new `lib/` functions need tests.** This is non-negotiable.
- Test file lives next to the source file: `foo.ts` → `foo.test.ts`
- Use Vitest. Mock external services (Supabase, Anthropic, fetch) — never call real APIs in tests.
- Use `vi.hoisted()` for mock variables referenced inside `vi.mock()` factories.
- Use `vi.setSystemTime()` (with `vi.useFakeTimers()`) for any time-dependent logic.
- Route handlers don't need unit tests — they're covered by the lib tests + manual testing.

## Key Commands

```bash
npm test              # run all tests once
npm run test:watch    # watch mode while developing
npm run lint          # ESLint check
npm run lint:fix      # ESLint with auto-fix
npm run format        # Prettier format all src files
npm run typecheck     # TypeScript check without building
npm run dev           # local dev server (http://localhost:3000)
npm run build         # production build
```

## Environment Variables

All live in `api/.env.local` (never committed). Required:
```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
CRON_SECRET=          # arbitrary secret — passed as Bearer token by Vercel cron
```

## Current State

Migration from n8n to Next.js is complete. The app is live:
- API: `https://zen-tasks-api.vercel.app/api`
- Frontend: GitHub Pages (static)
- DB: Supabase cloud

## What's Next (Roadmap)

- **Follow-up cron**: check `follow_up_at` on in-progress tasks and nudge for completion confirmation
- **In-app notifications**: `notifications` table + Supabase Realtime is ready — add Supabase JS client to frontend
- **Multi-user auth**: Enable Supabase Auth, tighten RLS to `USING (auth.uid() = user_id)`, add login page

## What NOT To Do

- Don't call Supabase, Anthropic, Google, or Telegram directly from route handlers — always go through `lib/`
- Don't use `npm audit fix --force` — the audit warnings are all in dev dependencies (ESLint/minimatch) and force-fixing will break things
- Don't commit `.env.local`
- Don't add tests for route handlers — test the lib functions they call instead
- Don't physically delete tasks — set `status: 'deleted'`
