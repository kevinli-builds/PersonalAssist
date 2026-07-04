# PersonalAssist — Product / Design / Engineering Brief

_Written 2026-07-03 by a Claude portfolio review session. Audience: a future Opus
session. Read `CLAUDE.md` first (two-step capture, structured outputs, shared
Supabase project with Furnisher via the `personalassist` schema, timezone rules).
The app is **scaffolded but not deployed** — deployment dominates the roadmap.
Verify current state before implementing._

---

## 1. Product roadmap (PM)

This is a single-user tool; "drawing users" means making it indispensable to its
one user. The core loop (capture → confirm → reminded → recall) is built but
unproven in daily life. Priority: get it live, then remove friction from capture
and recall — the two verbs that decide whether it gets used.

### P0 — Deploy + wire the schedulers
**Instructions for Opus:**
- Deploy to Vercel: set all env vars from `.env.example` (generate VAPID keys if
  not done), `npm run db:push` against the Supabase pooler, verify `vercel.json`
  daily cron hits `/api/cron/notify` with `CRON_SECRET`.
- Enable the 30-minute GitHub Action (repo secrets `APP_URL` + `CRON_SECRET`) —
  daily-only cron makes reminders up to 24h late, which kills trust in a
  reminders app.
- Install as PWA on the user's phone (iOS requires home-screen install for push —
  the UI already explains this) and send a test reminder end-to-end.

### P1 — Entry editing (currently save-or-delete only)
A mis-parsed date shouldn't force delete-and-retype.
**Instructions for Opus:** `PATCH /api/entries/[id]` (title, date, note, tags,
reminders), edit affordance in the Timeline component reusing the Capture
confirm-card UI. Auth via the existing bearer check.

### P1 — Timeline search + filters
Recall via Ask (LLM) is expensive and slow for "show me all health entries."
Add a client-side text filter + type/tag chips to Timeline; entries are already
all fetched. Cheap, huge daily-use win.

### P2 — Better recurrence
Only `yearly` is mechanical today. Add `monthly` and `every N weeks/days`
(schema: replace the recurrence string with `{unit, interval}` or extend the
enum; the cron reschedule logic in `/api/cron/notify` generalizes from the
yearly +1y case). Parse prompt: extend the json_schema so Claude can emit it.

### P2 — Email-in capture (friction killer)
Typing in an app is friction; forwarding an email or texting yourself is not.
Options, ranked: (a) a dedicated inbound address via Cloudflare Email Workers
or Resend inbound → webhook → `/api/parse` + auto-save with a "review" flag;
(b) iOS Shortcut hitting a `POST /api/capture` endpoint with the bearer token.
Do (b) first — no new infra, 30 minutes of work, and the user is on iPhone.

### P3 — Attachments (Vercel Blob) — ticket PDFs/photos on entries (noted in
CLAUDE.md as a future idea). Needs Blob storage + an `attachments` table.

### P3 — Household mode (multi-user). Skip until someone else actually wants in.

### Explicitly not now
Voice capture, chat-style general assistant features — keep it a memory tool.

---

## 2. Design audit

(Static-read audit; the app hasn't been used in anger yet.)

1. **The confirm step is the product's trust move — protect it.** Keep the
   confirmation sentence primary; consider a subtle "edit before saving" affordance
   on the draft card rather than approve/reject only.
2. **Timeline needs visual typing.** Entries of type appointment / health /
   fact / ticket should get distinct icons + accent colors so a year of entries
   scans at a glance. The teal card UI is clean but will become monotone at scale.
3. **Ask tab expectations**: add 3 example questions as tappable chips ("When was
   my last tetanus shot?") — teaches the query style and shows off the feature.
4. **Reminder visibility**: an entry's upcoming reminders should be visible (and
   dismissible) on the Timeline card, not implicit. "It will remind me, right?"
   is the anxiety to answer.
5. **Empty states** for all three tabs on first launch (one sample entry the
   user can delete beats a blank screen).

---

## 3. Engineering audit

### Refactor targets
- The codebase is small and cleanly layered (`lib/claude.ts`, `lib/push.ts`,
  `lib/auth.ts`) — no structural work needed yet.
- Add vitest for date/recurrence resolution logic as it grows (P2 recurrence
  work should land with tests) — relative-date bugs are this app's most likely
  failure class, and timezone handling is already called out as subtle.
- Add CI (typecheck + build); there's a `.github` dir already — extend it.

### Security audit potential
1. **`/api/auth/login` has no rate limiting or lockout** (verified in code:
   `app/api/auth/login/route.ts` — straight `safeEqual` check). A public Vercel
   URL guarding all personal data with one password = brute-forceable.
   Fixes, in order: (a) per-IP token bucket — in-memory is weak on serverless
   (per-instance), so either accept that as a speed bump, or use Upstash Redis
   free tier; (b) constant 1s delay on failure; (c) optionally require a long
   random passphrase and document that as the mitigation. At minimum do (b)+(c).
2. **Anthropic prompt injection surface**: `askQuestion` sends all entries to
   Claude; a hostile entry can't do much today (output is displayed, not
   executed) — keep it that way; never let Ask output trigger actions
   (deletes/edits) without explicit user confirmation.
3. **Push subscription hygiene** is good (prunes 404/410). Verify
   `/api/push/subscribe` requires the bearer token so third parties can't
   subscribe themselves to reminders.
4. **Session TTL 180d with sha256-hashed tokens** — same pattern as Do I Want To
   Know; fine. Add a "log out everywhere" (delete all sessions) button for lost-
   device recovery.
5. Shared Supabase project with Furnisher: isolation relies on the
   `personalassist` schema. Confirm the Supabase anon/service keys used here are
   server-side only (this app talks to Postgres via Prisma, not supabase-js — so
   no anon-key exposure; keep it that way).

---

## 4. Surprise & delight (unbuilt ideas — cherry-pick)

_PersonalAssist stores a life in fragments; delight = the app giving fragments
**back** at the right moment. All of these ride the existing cron/push rails._

### D1 — Morning briefing ⭐
One warm push per day (only when there's content): "Today: dentist 2pm. Mom's
birthday in 12 days. A year ago today: Hamilton, row F — you loved it." A
formatting feature over the existing `/api/cron/notify` — combine due
reminders + lead-time events + on-this-day into a single message. This is the
feature that makes the app feel like an assistant instead of an alarm clock.

### D2 — On-this-day memories
Timeline header card: "One year ago: *donated blood*." Simple date-window query
over `Entry`. Pairs with D1; build the query helper once.

### D3 — Letters to future self
A "letter" entry type with an unlock date: sealed (✉️ blurred body) in the
Timeline until the date, then delivered as a reminder push. The parse schema
already handles future dates; add a `sealed` flag and a masked render. Writing
"open this next New Year's Eve" to yourself is pure magic and near-zero code.

### D4 — Life tallies
After saving an entry that matches a recurring pattern, show a small
celebration card: "🩸 5th blood donation on record — potentially 15 lives."
Count-by-tag/type with a curated set of translations (donations → lives, flu
shots → years covered, concerts → venues visited). Compute at save time in the
confirm response.

### D5 — Anniversary lead-time nudges
For recurring yearly entries (birthdays), notify at T−14 ("Mom's birthday in
two weeks — gift?") in addition to the day itself. One extra reminder row at
save/reschedule time in the cron logic. Turns "it reminded me" into "it had my
back."

---

## 6. Wave 2 (written 2026-07-04)

_State at writing: deployed per memory notes, but delivery unverified.
Verify the cron + push path end-to-end before anything below._

### W1 — Prove the loop, then daily briefing
1. Verify: PWA installed on the user's phone, test push received, GitHub
   Action firing every 30 min with repo secrets set.
2. Then D1 morning briefing (one warm daily push: due reminders + lead-time
   birthdays + on-this-day) — the feature that makes it an assistant.

### W2 — Capture friction killers
- `POST /api/capture` (bearer-authed) + an iOS Shortcut → capture from the
  share sheet / Siri without opening the app.
- Entry editing (PATCH) + timeline text/type filters — both from section 1,
  both still the biggest daily-use gaps.

### W3 — Memory that comes back
D2 on-this-day header → D3 letters to future self (sealed entries) →
D4 life tallies ("5th donation ≈ 15 lives") → D5 anniversary lead-time
nudges (T−14 for yearly entries).

### W4 — Recurrence generalization
`{unit, interval}` recurrence (monthly / every N weeks) in the parse schema
+ cron reschedule. Prerequisite for half the reminder use cases.

### Tentative / parked
- Attachments via Vercel Blob (ticket PDFs) — when a real need appears.
- Email-in capture via inbound webhook — after the iOS Shortcut proves the
  demand for out-of-app capture.
- Household/multi-user mode — explicit user pull only.
- Login rate limiting (section 3 #1) is still open — do with W1.
