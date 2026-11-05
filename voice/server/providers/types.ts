/** Provider-agnostic contract. Implement this to plug in any AI provider. */
export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIRequest {
  /** Stable instructions (personality). Cacheable. */
  system: string;
  /** Per-request context (memory, date, voice rules). */
  context: string;
  messages: AIMessage[];
  voice: boolean;
}

export interface AIProvider {
  readonly name: string;
  ask(req: AIRequest): Promise<string>;
}

export class ProviderConfigError extends Error {}
