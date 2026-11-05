import type { ModeId } from "./modes";

/**
 * Quick actions and natural "Jarvis, ..." commands. Each one opens Chat in the right
 * mode with a starter prompt. `needs` tells the UI what to ask the user for first.
 */
export interface QuickAction {
  id: string;
  label: string;
  hint: string;
  mode: ModeId;
  prompt: string;
  needs?: "image" | "topic" | "text";
  href?: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "review-design", label: "Review my design", hint: "Upload a screenshot", mode: "design", needs: "image", href: "/design-review",
    prompt: "Review this design. Use severity levels and tell me the top three changes to make first." },
  { id: "research", label: "Research this", hint: "Enter a topic", mode: "researcher", needs: "topic",
    prompt: "Research this and make it actionable for my projects: " },
  { id: "teach", label: "Teach me", hint: "Choose a topic", mode: "teacher", needs: "topic",
    prompt: "Teach me this progressively, one concept at a time, and quiz me: " },
  { id: "stuck", label: "I'm stuck", hint: "Explain the problem", mode: "normal", needs: "text",
    prompt: "I'm stuck. Help me find the real problem and the next action. Here's the situation: " },
  { id: "plan-day", label: "Plan my day", hint: "Generate priorities", mode: "focus",
    prompt: "Plan my day. Ask me what's on my plate if you need to, then give me no more than three real priorities and the first action for each." },
  { id: "ceo", label: "Think like a CEO", hint: "Analyse a business decision", mode: "ceo", needs: "text",
    prompt: "Think like a CEO about this decision: " },
  { id: "investor", label: "Think like an investor", hint: "Evaluate an idea", mode: "investor", needs: "text",
    prompt: "Evaluate this idea as an investor would: " },
  { id: "challenge", label: "Challenge my idea", hint: "Skeptical critic", mode: "devil", needs: "text",
    prompt: "Challenge this idea hard: " },
  { id: "explain", label: "Explain this", hint: "Paste or upload material", mode: "teacher", needs: "text",
    prompt: "Explain this simply, then connect it to my work: " },
  { id: "focus", label: "Help me focus", hint: "Start a focus session", mode: "focus", href: "/today#focus",
    prompt: "Help me focus. Define one task, the expected outcome and the constraints." },
  { id: "check-in", label: "Daily check-in", hint: "Reflect for two minutes", mode: "coach",
    prompt: "Daily check-in. Ask me how I'm actually doing today, one question at a time." },
  { id: "decide", label: "Help me decide", hint: "Structure a decision", mode: "normal", needs: "text",
    prompt: "Help me make this decision using the decision framework (options, evidence, unknowns, risks, upside, reversibility, recommendation): " },
];

export const COMMAND_EXAMPLES = [
  "Jarvis, what should I work on?",
  "Jarvis, what am I avoiding?",
  "Jarvis, challenge this idea.",
  "Jarvis, think like an investor.",
  "Jarvis, remind me why this project matters.",
  "Jarvis, plan tomorrow.",
];

/** Lightweight routing for typed commands like "Jarvis, think like a CEO". */
export function detectModeFromCommand(text: string): ModeId | null {
  const t = text.toLowerCase();
  if (!/\bjarvis\b/.test(t)) return null;
  if (/(look at|review).*(design|screen)|design critique/.test(t)) return "design";
  if (/think like a ceo/.test(t)) return "ceo";
  if (/think like an investor/.test(t)) return "investor";
  if (/challenge (this|my)/.test(t)) return "devil";
  if (/teach me|summari[sz]e this book/.test(t)) return "teacher";
  if (/research/.test(t)) return "researcher";
  if (/i'?m stuck|what am i avoiding|review my progress/.test(t)) return "coach";
  if (/plan (tomorrow|today|my day)|what should i work on/.test(t)) return "focus";
  return null;
}
