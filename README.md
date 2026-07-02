# PersonalAssist

*Type it once. Never forget it.*

A personal memory assistant: type a quick freeform message ("just donated blood — remind me when I can again", "got my flu shot", "Hamilton tickets March 14 row F") and Claude parses it into a structured record with dates, tags, and proposed reminders. You confirm the interpretation, it's saved, and push notifications fire when reminders come due. Ask questions about your own history ("when was my last tetanus shot?") any time.

## Stack

- **Next.js** (App Router) — frontend + API routes in one deploy (Vercel)
- **Prisma + PostgreSQL** (Neon free tier)
- **Anthropic Claude API** — message parsing (structured JSON output) + Q&A
- **Web Push** (VAPID) — reminder notifications, works as an installable PWA
- Single-user auth: `APP_PASSWORD` login → hashed bearer session token

## Setup

```bash
npm install

# 1. Create a Postgres DB (e.g. neon.tech) and copy the connection string
# 2. Generate VAPID keys for push:
npx web-push generate-vapid-keys

# 3. Copy .env.example → .env and fill everything in
# 4. Create the tables:
npm run db:push

# 5. Run it:
npm run dev   # http://localhost:3005
```

## Notifications

1. Log in, click **🔔 Notify me**, and accept the permission prompt (on iPhone: install to home screen first — Share → Add to Home Screen — then enable).
2. Something must call `GET /api/cron/notify` (with `Authorization: Bearer $CRON_SECRET`) on a schedule to deliver due reminders:
   - **Vercel Cron** — `vercel.json` ships a daily 13:00 UTC job. When `CRON_SECRET` is set in the Vercel project env, Vercel sends the auth header automatically. (Hobby plan crons are once-daily; fine for morning-of reminders.)
   - **GitHub Action** (optional, finer-grained) — `.github/workflows/notify.yml` pings every 30 minutes. Set the `APP_URL` and `CRON_SECRET` repository secrets to activate it; it no-ops if they're missing.

## Deploy (Vercel)

1. Push this repo to GitHub, import into Vercel.
2. Set all env vars from `.env.example` in the Vercel project settings.
3. Run `npm run db:push` locally against the production `DATABASE_URL` once (creates tables).
4. Deploy. Install the PWA on your phone and enable notifications.

## Cost note

Parsing/Q&A defaults to `claude-opus-4-8`. Messages are tiny so cost is low, but you can set `CLAUDE_MODEL=claude-haiku-4-5` for ~5x cheaper extraction. Set a spend cap in the Anthropic Console either way.
