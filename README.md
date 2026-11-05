# JARVIS

Adebayo's personal AI operating system. This repo holds two apps:

| Folder | What it is | Stack |
| --- | --- | --- |
| [`voice/`](voice/) | The voice-first JARVIS: the dot-matrix face, wake button / "Hey Jarvis", speaks and listens | Vite, React, TypeScript, Vercel functions, Claude, optional ElevenLabs |
| [`os/`](os/) | The full JARVIS OS: chat, expert modes, memory, projects, focus | Next.js, Supabase, Claude |

Each folder has its own README with install, run, environment variables and deployment steps.

## Deploying on Vercel

Create one Vercel project per app from this repo and set **Root Directory** to `voice` or `os` in the project settings. Add the environment variables listed in that app's `.env.example`. Never commit real keys.
