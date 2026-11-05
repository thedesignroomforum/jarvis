# JARVIS Voice

A voice-first personal AI for Adebayo. The face is the supplied dot-matrix portrait, brought to life with WebGL. You wake JARVIS with a button or by saying "Hey Jarvis". It listens, thinks with Claude and answers out loud.

Built with Vite, React, TypeScript and plain CSS. The API routes run as Vercel functions in production and inside the Vite dev server locally.

---

## 1. Install

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
```

## 2. Run

```bash
npm run dev
```

Open http://localhost:5173 in Chrome or Edge. These have the best speech recognition.

- Click **Enable microphone** and allow access. The status changes from MIC OFF to MIC READY.
- Press the round button, or the Space bar. JARVIS wakes, says "Yes. I'm listening." and listens.
- Speak. After a short pause it thinks and then answers.
- You can always type in the "Type a message..." bar instead.

Other commands:

- `npm run build`: typecheck and build for production.
- `npm run preview`: serve the built app. The API routes are not included here, so use `npm run dev` or Vercel for those.

**Keyboard shortcuts**

| Key | Action |
| --- | --- |
| Space | Wake, send or interrupt |
| Esc | Cancel or stop |
| T | Show or hide the transcript |
| M | Open memory and settings |

## 3. Where the AI API key goes

Put the key in `.env.local`. This file is git-ignored.

```
AI_API_KEY=sk-ant-...
```

Restart `npm run dev` after changing it. On Vercel, add the same variable under **Project → Settings → Environment Variables**.

The key is only read on the server, by `server/providers/anthropic.ts`. It is never sent to the browser. Never rename it with a `VITE_` prefix, because Vite would then bundle it into the public JavaScript.

Optional variables are listed in `.env.example`:

- `AI_MODEL`, `AI_EFFORT_VOICE`, `AI_EFFORT_TEXT`: model and depth.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`: the premium voice. The free ElevenLabs plan works. Without a key, JARVIS uses the best male English voice built into the device.
- `JARVIS_ACCESS_CODE`: a private code the app asks for once. Set this on any public deployment so strangers can't spend your credits.
- `JARVIS_RATE_LIMIT_PER_MIN`: requests per minute per visitor.

## 4. How the wake-word system works

There are two ways to wake JARVIS.

1. **The wake button (primary).** It always works. Tap it or press Space.
2. **"Hey Jarvis" (experimental).** Turn it on in Memory → Settings. It uses the browser's Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) in continuous mode, and matches "hey / ok / hi Jarvis" plus common mishearings. When the browser stops recognition, which Chrome does every so often, it restarts with back-off. If you say a request in the same breath ("Hey Jarvis, what should I do next?"), it handles the request straight away.

**Honest limits.** This is not a hardware wake word like Siri or Alexa:

- It only works while this tab is open and the browser lets the mic stay active. It stops when the laptop sleeps or the tab is in the background on mobile.
- Chrome and Edge send the audio to their own speech service to transcribe it.
- Safari support varies, and Firefox has none. Without it, use the button.
- Nothing is recorded or stored by this app. The microphone is only opened after you allow it.

While JARVIS is speaking, recognition switches to **interrupt mode** and only reacts to short control words: "stop", "pause", "continue", "sleep".

The flow is driven by the state machine in `src/state/assistantState.ts`:

```
SLEEPING → WAKING → LISTENING → THINKING → SPEAKING → LISTENING / READY → (90 s idle) → SLEEPING
```

Voice commands are handled in `src/services/commands.ts`:

- Hey Jarvis
- Wake up
- Stop
- Pause
- Continue
- Repeat that
- Go deeper
- Summarize that
- What should I do next
- Sleep
- Remember …
- Forget …
- Forget that

## 5. How to replace the AI provider

The browser only calls `/api/chat`. The provider sits behind one interface in `server/providers/types.ts`:

```ts
interface AIProvider {
  name: string;
  ask(req: AIRequest): Promise<string>;
}
```

To add a provider:

1. Create `server/providers/myProvider.ts` that implements `ask()`. It receives `system`, `context`, `messages` and `voice`.
2. Add a `case "myprovider":` in `server/providers/index.ts`.
3. Set `AI_PROVIDER=myprovider` in your environment.

Nothing in `src/` changes. JARVIS's personality lives in `server/prompts/jarvisSystemPrompt.ts`, which is your Adebayo operating-system prompt. Edit it there.

## 6. How to connect Supabase later

Memory is kept on the device today, in localStorage, behind the `MemoryStore` interface in `src/services/memoryService.ts`. It uses the categories Personal, Career, Finance, Business, Learning, Habits, Relationships and Current State.

To move it to Supabase:

1. Create a table:

   ```sql
   create table memories (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     category text not null,
     text text not null,
     created_at timestamptz not null default now()
   );
   alter table memories enable row level security;
   create policy "own memories" on memories for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```

2. Add Supabase Auth, for example magic-link email, with `@supabase/supabase-js`. Use only the publishable or anon key in the browser (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Never use the service-role key there.
3. Write a `SupabaseMemoryStore` that implements the same `MemoryStore` methods, and export it as `memoryStore` instead of `LocalMemoryStore`.
4. Optionally, load memory on the server in `server/chatHandler.ts` instead of sending it from the browser.

## 7. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repo. Vercel detects **Vite**: the build command is `npm run build` and the output folder is `dist`. The `api/` folder becomes serverless functions automatically.
3. Add the environment variables: `AI_API_KEY`, `JARVIS_ACCESS_CODE` (strongly recommended) and, optionally, `ELEVENLABS_API_KEY`.
4. Deploy. The microphone needs HTTPS, which Vercel provides.

`vercel.json` sets the function time limits and security headers. One of them is `Permissions-Policy: microphone=(self)`, so only this site can use the mic.

---

## Project structure

```
api/                     Vercel functions: chat, tts, config
server/                  Shared server code (also used by the Vite dev server)
  prompts/               JARVIS personality (Adebayo OS)
  providers/             Replaceable AI provider (Anthropic by default)
  chatHandler.ts         Validation, memory context, errors
  ttsHandler.ts          ElevenLabs proxy (key stays on the server)
  security.ts            Access code and rate limit
src/
  components/            Avatar (WebGL), WakeButton, VoiceController, Conversation, StatusIndicator, MemoryPanel
  hooks/                 useJarvis (controller), useSpeechRecognition, useSpeechSynthesis, useAudioAnalyzer
  services/              speechService, aiService, audioAnalyzer, voiceOutput, micService, memoryService, commands
  state/assistantState.ts
public/jarvis-face.png   The avatar: the exact supplied image
```

## How the avatar works

The avatar is the original image, drawn as a WebGL texture (`src/components/Avatar`). The shader never redraws the face. It only:

- brightens and darkens it;
- scales it gently with breath and voice amplitude;
- makes the dots drift slightly;
- adds a brief glitch on wake;
- adds a scan band while thinking;
- adds a faint particle field while listening or speaking.

Animation runs at 60 fps through `requestAnimationFrame` with no React re-renders. Audio levels come from an `AnalyserNode`:

- the microphone while listening;
- the ElevenLabs audio while speaking.

Browsers don't expose their built-in speech voice to Web Audio. With the device voice, the speaking pulse is therefore driven by word timing rather than the true waveform. If WebGL is unavailable, a CSS-animated image is used instead. `prefers-reduced-motion` is respected.

## Privacy

- API keys exist only on the server.
- The microphone opens only after browser permission, and the status indicator always shows its state.
- Nothing is recorded.
- Memory is only what you explicitly ask JARVIS to remember. You can see it and delete it in the Memory panel.
