import type { ModeId } from "./modes";

export const MEMORY_CATEGORIES = [
  "identity",
  "goals",
  "projects",
  "preferences",
  "learning",
  "decisions",
  "patterns",
  "achievements",
  "challenges",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, { label: string; hint: string }> = {
  identity: { label: "Identity", hint: "Basic information about you" },
  goals: { label: "Goals", hint: "Short- and long-term goals" },
  projects: { label: "Projects", hint: "Status, decisions and next actions" },
  preferences: { label: "Preferences", hint: "Design and working preferences" },
  learning: { label: "Learning", hint: "Topics learned and knowledge gaps" },
  decisions: { label: "Decisions", hint: "Important decisions you've made" },
  patterns: { label: "Patterns", hint: "Repeated behaviours useful for coaching" },
  achievements: { label: "Achievements", hint: "Completed milestones" },
  challenges: { label: "Challenges", hint: "Current obstacles" },
};

export interface Memory {
  id: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  pinned: boolean;
  source: "manual" | "chat";
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  status: "active" | "paused" | "done" | "archived";
  vision: string;
  next_action: string;
  sections: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: ModeId;
  project_id: string | null;
  updated_at: string;
}

export interface Source {
  url: string;
  title: string;
}

export interface Attachment {
  kind: "image" | "pdf" | "text";
  name: string;
  mediaType: string;
  /** base64 for image/pdf, raw text for text files */
  data: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: ModeId | null;
  attachments?: { kind: Attachment["kind"]; name: string }[];
  sources?: Source[];
  created_at?: string;
}

/** Events streamed from /api/chat as newline-delimited JSON. */
export type ChatStreamEvent =
  | { type: "meta"; conversationId: string; mode: ModeId }
  | { type: "text"; text: string }
  | { type: "status"; status: "thinking" | "searching" | "writing" }
  | { type: "sources"; sources: Source[] }
  | { type: "done"; messageId: string | null }
  | { type: "error"; message: string };

export const PROJECT_SECTION_PRESETS = [
  "Problem",
  "Users",
  "Market",
  "Competitors",
  "Business model",
  "Features",
  "Research",
  "Brand",
  "Design",
  "Decisions",
  "Tasks",
  "Metrics",
  "Roadmap",
  "Open questions",
];
