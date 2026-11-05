/**
 * Local voice/text commands that control the assistant directly (no AI round-trip).
 * Anything that isn't a command goes to the AI.
 */
export type Command =
  | { type: "stop" }
  | { type: "pause" }
  | { type: "continue" }
  | { type: "repeat" }
  | { type: "deeper" }
  | { type: "summarize" }
  | { type: "sleep" }
  | { type: "wake" }
  | { type: "remember"; text: string }
  | { type: "forget"; text: string }
  | { type: "forgetLast" }
  | { type: "ask"; text: string };

const strip = (s: string) =>
  s
    .trim()
    .replace(/^(?:hey|hi|ok|okay)?[\s,]*jarvis[\s,.!?]*/i, "")
    .trim();

export function parseCommand(input: string): Command {
  const text = strip(input);
  const t = text.toLowerCase().replace(/[.!?]+$/, "").trim();
  if (!t) return { type: "wake" };
  if (/^(stop|be quiet|quiet|enough|shut up|cancel)$/.test(t)) return { type: "stop" };
  if (/^(pause|wait|hold on)$/.test(t)) return { type: "pause" };
  if (/^(continue|resume|go on|carry on)$/.test(t)) return { type: "continue" };
  if (/^(repeat( that)?|say that again|come again|what did you say)$/.test(t)) return { type: "repeat" };
  if (/^(go deeper|tell me more|expand( on that)?|elaborate)$/.test(t)) return { type: "deeper" };
  if (/^(summari[sz]e( that)?|give me the summary|tl;?dr)$/.test(t)) return { type: "summarize" };
  if (/^(sleep|go to sleep|goodnight|good night|that'?s all|dismissed)$/.test(t)) return { type: "sleep" };
  if (/^(wake up|are you there|you there)$/.test(t)) return { type: "wake" };
  if (/^forget (that|this|the last (one|thing))$/.test(t)) return { type: "forgetLast" };
  const forget = text.match(/^forget (?:that |about )?(.+)$/i);
  if (forget) return { type: "forget", text: forget[1] };
  const remember = text.match(/^(?:please )?(?:remember|note|save|keep in mind)(?: this)?(?: that)?[:,]?\s+(.+)$/i);
  if (remember) return { type: "remember", text: remember[1] };
  return { type: "ask", text };
}
