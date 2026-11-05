import { createAnthropicProvider } from "./anthropic.js";
import { ProviderConfigError, type AIProvider } from "./types.js";

/**
 * Pick the AI provider from AI_PROVIDER (default "anthropic").
 * To add another provider: implement AIProvider in a new file and add a case here.
 */
let cached: AIProvider | null = null;
export function getProvider(): AIProvider {
  if (cached) return cached;
  const name = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  switch (name) {
    case "anthropic":
    case "claude":
      cached = createAnthropicProvider();
      return cached;
    default:
      throw new ProviderConfigError(`Unknown AI_PROVIDER "${name}".`);
  }
}

export { ProviderConfigError };
export type { AIProvider, AIMessage } from "./types.js";
