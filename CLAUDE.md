# PersonalAssist — Claude Context

## Concept

Personal memory assistant. The user types short freeform messages about their life
("just donated blood — remind me when I can again", "got a flu shot today",
"Hamilton tickets March 14, row F 12–13", "Mom's birthday is June 3") and the app:

1. **Parses** the message with Claude into a structured entry (title, type, date,
   recurrence, tags, note, proposed reminders) via structured outputs
2. **Confirms** the interpretation with the user before saving (trust-building step)
3. **Stores** it in Postgres and **notifies** via Web Push when reminders come due
4. **Answers questions** over the stored entries ("when was my last tetanus shot?")

Single-user app for **snowwarrior1-alt**. Built in Claude Code sessions.

## Tech Stack

| Layer | Tech |
|---|---|
| App | Next.js 16 App Router (frontend + API routes, one deploy) |
| Language | TypeScript |
| ORM / DB | Prisma v5 / PostgreSQL (Supabase — pooler URL at runtime, `DIRECT_URL` for `db push`) |
| AI | Anthropic `@anthropic-ai/sdk` — `claude-opus-4-8` default (`CLAUDE_MODEL` env overrides; `claude-haiku-4-5` for cheap) |
| Push | `web-push` (VAPID), service worker at `public/sw.js`, installable PWA |
| Hosting | Vercel (API routes are short-lived — no long-running syncs) |
| Cron | Vercel Cron daily (vercel.json) + optional GitHub Action every 30 min |

## Repository Structure

```
PersonalAssist/
├── app/
│   ├── layout.tsx            Metadata + manifest
│   ├── page.tsx              Client shell: login gate, tabs (Capture/Timeline/Ask)
│   ├── globals.css           Teal (#0f766e) card UI
│   ├── lib/api.ts            Client fetch wrapper + token storage + push subscribe
│   ├── components/           Login, Capture (parse→confirm→save), Timeline, Ask
│   └── api/
│       ├── auth/login/       POST {password} → bearer token (sha256-hashed in DB)
│       ├── parse/            POST {message,now,timezone} → ParsedEntry draft (NOT saved)
│       ├── entries/          GET list · POST save confirmed draft (+future reminders)
│       ├── entries/[id]/     DELETE
│       ├── ask/              POST {question} → Claude answer over all entries
│       ├── push/subscribe/   POST Web Push subscription (upsert by endpoint)
│       └── cron/notify/      GET (Bearer CRON_SECRET) → send due reminders,
│                             reschedule yearly ones +1 year
├── lib/
│   ├── prisma.ts             Client singleton
│   ├── auth.ts               Sessions (sha256 token hash, 180d), constant-time compare
│   ├── claude.ts             parseMessage (output_config json_schema) + askQuestion
│   └── push.ts               web-push send-to-all, prunes dead subscriptions (404/410)
├── prisma/schema.prisma      Entry, Reminder, PushSubscription, Session
├── public/                   manifest.json, sw.js, icon.svg
└── vercel.json               Daily cron → /api/cron/notify
```

## Key design decisions

- **Two-step capture**: `/api/parse` returns the draft + a one-sentence `confirmation`;
  the user approves before `/api/entries` saves. Mis-parses get discarded, not stored.
- **Structured outputs**: `output_config: {format: {type: "json_schema", schema}}` on
  `messages.create` guarantees valid JSON — no prefills (they 400 on Opus 4.8), no regex.
- **Client sends `now` + IANA timezone** with each parse so relative dates ("in 8 weeks",
  "next Friday") resolve in the user's local time; dates are stored UTC.
- **Recurrence**: only `"yearly"` is mechanical (cron re-creates the reminder +1 year
  after sending). Interval facts ("again in 8 weeks") become one-shot reminders.
- **Auth**: single `APP_PASSWORD` → 180-day bearer token, only sha256 hash stored
  (same pattern as Do I Want To Know). Cron endpoint guarded by `CRON_SECRET`,
  compared constant-time.
- **Notification delivery** requires an external scheduler: Vercel Cron (daily,
  Hobby-plan limit) and/or the GitHub Action (30-min, needs APP_URL + CRON_SECRET
  repo secrets; exits 0 silently when unset).
- **iOS caveat**: web push on iPhone requires the PWA installed to the home screen
  (iOS 16.4+). The enable-notifications error message says so.

## Env vars (see .env.example)

`DATABASE_URL` (Supabase transaction pooler, `?pgbouncer=true&connection_limit=1`),
`DIRECT_URL` (Supabase direct connection — Prisma `directUrl`, needed for `db push`),
`ANTHROPIC_API_KEY`, `APP_PASSWORD`, `CRON_SECRET`,
`WEB_PUSH_PUBLIC_KEY`/`WEB_PUSH_PRIVATE_KEY`/`WEB_PUSH_SUBJECT`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY` (= public key, for the browser),
optional `CLAUDE_MODEL`.

## Running locally

```bash
npm install
npx web-push generate-vapid-keys   # once, into .env
npm run db:push                    # create tables (uses DATABASE_URL)
npm run dev                        # port 3005
```

Windows note: use `npm.cmd` in PowerShell (execution-policy), or run via Git Bash.

## Status (July 2026)

Initial scaffold complete and building. Not yet deployed. Future ideas:
attachments on entries (ticket PDFs/photos — needs Vercel Blob), entry editing,
recall over natural-language date ranges, shared household mode (multi-user).
