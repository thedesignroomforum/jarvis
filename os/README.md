# JARVIS

Adebayo's personal AI operating system.

> "Don't do everything for Adebayo. Make Adebayo better at doing everything."

JARVIS is a conversational workspace backed by Claude. It thinks in ten modes (Design Master, CEO, Investor, Teacher, Researcher, Coach, Focus, Devil's Advocate, Creative Director, Normal), remembers only what you let it, reviews designs from screenshots, reads PDFs, talks back with an ElevenLabs voice, and lives behind a floating dot-sphere orb on every screen.

This repository is **Phase 1 (Core)** plus the parts of later phases that were cheap to do honestly. Anything not built yet says **Coming soon** in the UI. See [What works today](#what-works-today).

---

## Quick start (local)

```bash
git clone <this repo> jarvis && cd jarvis
npm install
cp .env.example .env.local      # fill in the values, see below
npm run dev                     # http://localhost:3000
```

If Supabase isn't configured yet, every page redirects to `/setup`, which shows what's missing.

### Development commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also type-checks) |
| `npm start` | Run the production build |
| `npm run typecheck` | TypeScript only |

---

## 1. Supabase (database + auth)

1. Create a **new** project at [supabase.com](https://supabase.com) (the free plan is fine).
2. **SQL Editor → New query**, paste the whole of [`supabase/migrations/0001_jarvis_foundation.sql`](supabase/migrations/0001_jarvis_foundation.sql), click **Run**. This creates the tables, Row Level Security policies, and enables `pgvector` for Phase 3.
3. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key** into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Authentication → URL Configuration**: set **Site URL** to your app URL (e.g. `http://localhost:3000`, later your Vercel URL) and add `<your-url>/auth/callback` to **Redirect URLs**.
5. Set `JARVIS_ALLOWED_EMAILS` to your email. Only those emails can use JARVIS (and spend your API credits).
6. Open the app, choose **Create your account**, confirm the email, sign in.

Every table is owned by a user and protected with RLS, so even the public anon key can only read the signed-in user's rows. No service-role key is used anywhere.

## 2. Claude API (required)

1. Create a key at [console.anthropic.com](https://console.anthropic.com) → **API Keys**, add credit.
2. Set `ANTHROPIC_API_KEY`. It is only read on the server.
3. Optional: `ANTHROPIC_MODEL` (default `claude-opus-5-5`) and `JARVIS_EFFORT` (`low`…`max`, default `medium`; raise it for deeper analysis at higher cost).
4. Optional live web research: set `JARVIS_WEB_SEARCH=true` **and** enable web search for your organisation in the Anthropic Console (billed per search). Without it, Research mode says plainly that it can't browse.

The personality is cached by the API (prompt caching), so repeated messages are cheaper.

## 3. ElevenLabs voice (optional, free plan works)

1. Sign up at [elevenlabs.io](https://elevenlabs.io) (free plan).
2. **Profile → API Keys → Create**, then set `ELEVENLABS_API_KEY`.
3. Optional: pick a voice in the Voice Library and put its ID in `ELEVENLABS_VOICE_ID`. The default is a premade calm British voice ("George"), which works on the free plan.

To stretch the free plan's monthly credits, JARVIS:
- uses `eleven_flash_v2_5` (the cheapest model) by default,
- strips markdown and trims each spoken reply to `ELEVENLABS_MAX_CHARS` (default 600; the full reply stays on screen),
- only speaks when you're in Voice, press **Listen**, or turn on **Speak replies** in Settings.

Speech-to-text uses the browser's built-in recognition (Chrome, Edge, Safari): free, and only active after you tap the mic. The ElevenLabs key never reaches the browser; audio is proxied by `/api/voice/tts`.

## 4. Deploy to Vercel (its own project)

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project**, import this repo as a **new project** (don't reuse another app's project). Framework preset: Next.js.
3. **Settings → Environment Variables**: add every variable from `.env.example` for Production (and Preview if you use it).
4. Deploy, then put the Vercel URL into Supabase → Authentication → URL Configuration (Site URL + `/auth/callback`).

Notes: Vercel limits request bodies to 4.5 MB, so attachments are capped at ~4 MB PDFs and images are resized in the browser. The chat route allows up to 300 s for long answers (`maxDuration`); on the Hobby plan Vercel may cap this lower.

---

## Environment variables

| Variable | Required | Where it's used |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Browser + server (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Browser + server (public, RLS-protected) |
| `JARVIS_ALLOWED_EMAILS` | recommended | Server: comma-separated allow-list |
| `ANTHROPIC_API_KEY` | yes | Server only |
| `ANTHROPIC_MODEL` | no | Server, default `claude-opus-5-5` |
| `JARVIS_EFFORT` | no | Server, default `medium` |
| `JARVIS_WEB_SEARCH` | no | Server, `true` to enable web research |
| `ELEVENLABS_API_KEY` | no | Server only |
| `ELEVENLABS_VOICE_ID` | no | Server |
| `ELEVENLABS_MODEL_ID` | no | Server, default `eleven_flash_v2_5` |
| `ELEVENLABS_MAX_CHARS` | no | Server, default `600` |
| `JARVIS_RATE_LIMIT_PER_MIN` | no | Server, default `20` AI calls/min per user |

Never prefix a secret with `NEXT_PUBLIC_`. That would ship it to the browser.

---

## What works today

| Area | Status |
| --- | --- |
| Sign up / sign in (Supabase Auth, email allow-list) | ✅ |
| Chat with Claude, streaming, conversation history | ✅ |
| Ten personality modes + "Jarvis, think like a CEO"-style command routing | ✅ |
| Quick actions (Review my design, Research this, Teach me, I'm stuck, Plan my day, …) | ✅ |
| Memory: save from any reply, view, edit, pin, delete, forget everything | ✅ |
| Projects: workspaces with vision, next action and sections; chat in project context | ✅ |
| Goals (stored as memory, so every conversation sees them) | ✅ |
| Daily Command Center: plan my day, check-in, Focus Mode (25/45/60 min) with tracking | ✅ |
| Image analysis / Design Review with severity levels | ✅ |
| Screen sharing: one still frame after you pick a screen, then sharing stops | ✅ (still frames only) |
| PDF / TXT / Markdown: ask questions about an attached file | ✅ (per message, ≤4 MB, not stored) |
| Voice: speak (browser STT), hear JARVIS (ElevenLabs), interrupt | ✅ when keys are set |
| Web research with sources | ✅ when `JARVIS_WEB_SEARCH=true` |
| Floating orb + ⌘J / Ctrl+J shortcut on every screen | ✅ |
| Dark / light mode | ✅ |
| Knowledge Library (upload once, embeddings, retrieval, citations) | Coming soon · Phase 3 (tables ready) |
| DOCX ingestion | Coming soon · Phase 3 |
| Spaced repetition / knowledge tracking | Coming soon · Phase 3 |
| Calendar, tasks, connected services | Coming soon · Phase 4 |
| Live (continuous) screen observation | Coming soon · Phase 5 |
| Proactive reminders, morning briefings, quiet hours | Coming soon · Phase 6 |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture and the decisions behind it. In short:

```
Browser (Next.js App Router, React, Tailwind)
  │  NDJSON stream
  ▼
/api/chat ──► requireUser (Supabase session + allow-list) ──► rate limit ──► zod validation
  │
  ├─ load history, memories, project  (Supabase Postgres, RLS)
  ├─ build prompt: personality (cached) + mode brief + memory + capabilities + date
  └─ Claude (adaptive thinking, optional web search, refusal fallback) ──► stream back ──► save reply
/api/voice/tts ──► ElevenLabs (server-side key) ──► audio/mpeg
```

## Security

- API keys only in server environment variables; routes import `server-only` modules.
- Every API route checks the Supabase session and the email allow-list; the proxy (middleware) does the same for pages.
- Row Level Security on every table; no service-role key in the app.
- zod validation on every request body; attachment size and type limits.
- Per-user rate limiting on AI and voice endpoints (in-memory; swap for Upstash/Redis if you scale out).
- Audit log for memory/project/conversation deletions and memory edits.
- Microphone and screen capture only on explicit user action; no background recording. Security headers set in `next.config.ts`.
