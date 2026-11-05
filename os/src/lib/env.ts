import "server-only";

/** Server-side configuration. Secrets are read here and never sent to the browser. */
export const serverEnv = {
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  effort: (process.env.JARVIS_EFFORT || "medium") as "low" | "medium" | "high" | "xhigh" | "max",
  webSearch: process.env.JARVIS_WEB_SEARCH === "true",
  elevenKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenVoice: process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb",
  elevenModel: process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
  elevenMaxChars: Number(process.env.ELEVENLABS_MAX_CHARS || 600),
  allowedEmails: (process.env.JARVIS_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  rateLimitPerMin: Number(process.env.JARVIS_RATE_LIMIT_PER_MIN || 20),
};

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isEmailAllowed(email: string | undefined | null) {
  if (!email) return false;
  // If no allow-list is configured, allow any authenticated user (single-tenant dev setups).
  if (serverEnv.allowedEmails.length === 0) return true;
  return serverEnv.allowedEmails.includes(email.toLowerCase());
}

/** What is configured, for the Settings → Integrations screen. Never returns secret values. */
export function integrationStatus() {
  return {
    supabase: supabaseConfigured(),
    claude: Boolean(serverEnv.anthropicKey),
    model: serverEnv.model,
    webSearch: serverEnv.webSearch,
    elevenlabs: Boolean(serverEnv.elevenKey),
    allowList: serverEnv.allowedEmails.length > 0,
  };
}
export type IntegrationStatus = ReturnType<typeof integrationStatus>;
