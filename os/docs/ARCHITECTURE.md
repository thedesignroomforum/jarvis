# JARVIS architecture

## Goals for Phase 1

A stable foundation that already feels like a personal operating system: authenticated, conversational, mode-aware, memory-backed, visually distinct, and honest about what it can't do yet. Every later phase plugs into the same boundaries rather than rewriting them.

## Layout

```
src/
  app/
    (app)/            authenticated screens (Home, Command Center, Chat, Voice, Projects,
                      Design Review, Research, Learning, Knowledge, Goals, Memory, Settings)
    api/              route handlers: chat, conversations, memory, projects, focus, voice/tts, status
    auth/             Supabase email callback, sign out
    login/, setup/    public screens
  components/         AppShell, FloatingOrb, Orb (canvas avatar), Chat, RememberDialog, …
  hooks/              useSpeechInput (browser STT), useVoiceOutput (ElevenLabs playback + level meter)
  lib/
    jarvis/           the agent: personality, modes, quick actions, prompt building, streaming
    supabase/         server/browser clients, session-refresh proxy
    auth.ts           requireUser(): session + allow-list for API routes
    env.ts            server-only config; integrationStatus() exposes booleans only
    rate-limit.ts     per-user sliding window
    attachments.ts    client-side file → attachment (resize images, PDF/TXT), screen still capture
  proxy.ts            Next 16 proxy (formerly middleware): session refresh + redirects
supabase/migrations/  schema + RLS
```

## Key decisions

**One agent module.** All Claude calls go through `lib/jarvis/agent.ts`. Routes never build prompts. Adding tools (Phase 4), retrieval (Phase 3) or multi-agent orchestration (Phase 7) happens there.

**Prompt structure for caching.** The system prompt is two blocks: the stable personality (marked `cache_control`) and a per-request block (mode brief, capabilities, memory, date). Keeping volatile content after the cached block keeps the cache hit rate high.

**Modes are data, not code paths.** `lib/jarvis/modes.ts` defines each mode's brief. The client mode picker and the server prompt use the same list. Natural commands ("Jarvis, think like an investor") switch modes via `detectModeFromCommand`.

**Capabilities are stated to the model each turn.** The prompt tells Claude whether web search is on, that it only sees attached files, and that it can't set reminders yet. This is how the "never claim a feature works when it doesn't" rule is enforced on the model side; the UI enforces it with Coming Soon cards.

**Memory is user-controlled.** Nothing is extracted automatically in Phase 1. The user saves a memory from any reply (Remember) or adds one manually, and can edit, pin, delete or wipe everything. Pinned and high-importance memories are loaded first (up to 80) into every request. Phase 3 can add retrieval when memory outgrows the prompt.

**Streaming protocol.** `/api/chat` returns newline-delimited JSON events (`meta`, `status`, `text`, `sources`, `done`, `error`). Simple to parse, works through Vercel, and the same stream powers Chat and Voice.

**Attachments are per message.** Images (resized client-side to ≤1800 px JPEG), PDFs (≤4 MB, read natively by Claude) and text files go to Claude with that message only. Only file names are stored. This keeps Phase 1 free of storage and privacy complexity; the Phase 3 library replaces it with Supabase Storage + pgvector.

**Voice is split by cost.** Speech-to-text uses the free browser Web Speech API. Text-to-speech goes through our server to ElevenLabs (key stays server-side) with the Flash model and a per-reply character cap, to live within the free plan. Interrupting = stopping playback; tapping the orb while it speaks interrupts.

**Screen sharing is explicit and momentary.** `getDisplayMedia` → one frame → tracks stopped immediately. Continuous observation (Phase 5) will need its own consent UI.

**The orb.** A canvas Fibonacci sphere of light points (inspired by the dot-projected face reference): idle drift, listening ring, thinking scan line, speaking displacement driven by the audio level, amber warning and green success tints. No assets, theme-aware, respects reduced motion.

**Security boundary.** Pages: proxy redirects signed-out or non-allow-listed users. APIs: `requireUser()` on every handler. Data: RLS on every table using the user's own session (no service role). Secrets: `server-only` modules.

## Roadmap hooks

| Phase | Where it plugs in |
| --- | --- |
| 2 Voice | `useVoiceOutput`, `/api/voice/tts`; swap STT for ElevenLabs/Whisper streaming if browser STT isn't enough |
| 3 Knowledge | `documents` + `document_chunks` (pgvector) tables exist; add upload route → Storage → chunk → embed; retrieval step in `agent.ts`; citations via document blocks |
| 4 Tools | Add tool definitions + a tool loop in `agent.ts` (calendar, tasks, project updates with confirmation) |
| 5 Vision | Continuous screen observation with consent UI; reuse `captureScreenFrame` |
| 6 Proactive | `profiles.proactive_enabled`, quiet hours columns exist; add a scheduled job (Vercel Cron / Supabase cron) that writes notifications |
| 7 Advanced | Orchestrate specialist agents (modes) from `agent.ts`; analytics over `focus_sessions`, `messages` |
