import { ProviderConfigError, type AIProvider, type AIRequest } from "./types.js";

/**
 * Google Gemini via its REST API. Has a free tier (no card) at aistudio.google.com/apikey.
 * Set GEMINI_API_KEY. Optional GEMINI_MODEL (default "gemini-flash-latest").
 */
export function createGeminiProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY || (process.env.AI_PROVIDER === "gemini" ? process.env.AI_API_KEY : "");
  if (!apiKey) throw new ProviderConfigError("GEMINI_API_KEY is not set on the server.");
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

  return {
    name: `gemini:${model}`,
    async ask(req: AIRequest) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${req.system}\n\n${req.context}` }] },
          contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: req.voice ? 1024 : 4096, temperature: 0.7 },
        }),
      });
      if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      if (data.promptFeedback?.blockReason) {
        return "I can't help with that one as asked. Tell me what you're actually trying to achieve and I'll find a better route.";
      }
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
      return text || "I don't have a good answer to that yet.";
    },
  };
}
