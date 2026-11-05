import { createAnthropicProvider } from "./anthropic.js";
import { createGeminiProvider } from "./gemini.js";
import { ProviderConfigError, type AIProvider } from "./types.js";

/**
 * Pick the AI provider from AI_PROVIDER (default "anthropic").
 * To add another provider: implement AIProvider in a new file and add a case here.
 */
let cached: AIProvider | null = null;
export function getProvider(): AIProvider {
  if (cached) return cached;
  // Default: Gemini if only GEMINI_API_KEY is set (free tier), otherwise Anthropic.
  const fallback = process.env.GEMINI_API_KEY && !process.env.AI_API_KEY && !process.env.ANTHROPIC_API_KEY ? "gemini" : "anthropic";
  const name = (process.env.AI_PROVIDER || fallback).toLowerCase();
  switch (name) {
    case "anthropic":
    case "claude":
      cached = createAnthropicProvider();
      return cached;
    case "gemini":
    case "google":
      cached = createGeminiProvider();
      return cached;
    default:
      throw new ProviderConfigError(`Unknown AI_PROVIDER "${name}".`);
  }
}

export { ProviderConfigError };
export type { AIProvider, AIMessage } from "./types.js";
