import Anthropic from "@anthropic-ai/sdk";
import { ProviderConfigError, type AIProvider, type AIRequest } from "./types.js";

// Models that support the server-side refusal fallback (Claude API only).
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export function createAnthropicProvider(): AIProvider {
  const apiKey = (process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) throw new ProviderConfigError("AI_API_KEY is not set on the server.");
  const model = process.env.AI_MODEL || "claude-opus-5-5";
  const voiceEffort = (process.env.AI_EFFORT_VOICE || "low") as Effort;
  const textEffort = (process.env.AI_EFFORT_TEXT || "medium") as Effort;
  const client = new Anthropic({ apiKey });

  return {
    name: `anthropic:${model}`,
    async ask(req: AIRequest) {
      const useFallback = FALLBACK_MODELS.has(model);
      const stream = client.beta.messages.stream({
        model,
        max_tokens: req.voice ? 4000 : 16000,
        system: [
          { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
          { type: "text", text: req.context },
        ],
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        thinking: { type: "adaptive" },
        output_config: { effort: req.voice ? voiceEffort : textEffort },
        ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") {
        return "I can't help with that one as asked. Tell me what you're actually trying to achieve and I'll find a better route.";
      }
      const text = msg.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return text || "I don't have a good answer to that yet.";
    },
  };
}
