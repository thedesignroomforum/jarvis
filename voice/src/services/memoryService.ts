/**
 * Memory, stored on this device (localStorage) behind a small interface so it can be
 * swapped for Supabase later without touching the UI. Only things the user explicitly
 * asks JARVIS to remember are stored.
 */
export const MEMORY_CATEGORIES = ["personal", "career", "finance", "business", "learning", "habits", "relationships", "currentState"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  personal: "Personal",
  career: "Career",
  finance: "Finance",
  business: "Business",
  learning: "Learning",
  habits: "Habits",
  relationships: "Relationships",
  currentState: "Current State",
};

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  text: string;
  createdAt: string;
}

export interface MemoryData {
  name: string;
  items: MemoryItem[];
}

/** Implement this with Supabase (see README) to sync memory across devices. */
export interface MemoryStore {
  load(): MemoryData;
  add(text: string, category?: MemoryCategory): MemoryItem;
  remove(id: string): void;
  forgetMatching(query: string): MemoryItem | null;
  forgetLast(): MemoryItem | null;
  clear(): void;
  toPayload(): { name: string; items: { category: string; text: string }[] };
  subscribe(fn: () => void): () => void;
}

const KEY = "jarvis.memory.v1";
const EMPTY: MemoryData = { name: "Adebayo", items: [] };

/** Rough auto-categorisation from keywords; the user can see and delete everything. */
export function guessCategory(text: string): MemoryCategory {
  const t = text.toLowerCase();
  if (/(₦|naira|\bn\d|income|salary|save|saving|budget|debt|loan|invest|expense|spend|rent|money|account|subscription)/.test(t)) return "finance";
  if (/(client|job|role|interview|portfolio|recruiter|contract|retainer|freelance|design work|career|cv|resume)/.test(t)) return "career";
  if (/(velocity|wetintech|quantum nest|noura|startup|company|business|product|customer|revenue|mvp|launch|users|founder)/.test(t)) return "business";
  if (/(book|chapter|course|learn|lesson|study|reading|quiz)/.test(t)) return "learning";
  if (/(every (day|morning|night|week)|habit|routine|gym|workout|sleep|wake up|meditat)/.test(t)) return "habits";
  if (/(my (wife|husband|partner|girlfriend|boyfriend|mum|mom|dad|brother|sister|friend|mentor)|relationship)/.test(t)) return "relationships";
  if (/(right now|this week|currently|today|tomorrow|working on)/.test(t)) return "currentState";
  return "personal";
}

class LocalMemoryStore implements MemoryStore {
  private listeners = new Set<() => void>();
  private data: MemoryData = EMPTY;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...EMPTY, ...(JSON.parse(raw) as MemoryData) };
    } catch {
      this.data = { ...EMPTY, items: [] };
    }
  }
  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage blocked: memory lasts for this session only */
    }
    this.listeners.forEach((l) => l());
  }
  load = (): MemoryData => {
    return this.data;
  }
  add(text: string, category = guessCategory(text)) {
    const item: MemoryItem = { id: crypto.randomUUID(), category, text: text.trim().slice(0, 1000), createdAt: new Date().toISOString() };
    this.data = { ...this.data, items: [...this.data.items, item] };
    this.save();
    return item;
  }
  remove(id: string) {
    this.data = { ...this.data, items: this.data.items.filter((i) => i.id !== id) };
    this.save();
  }
  forgetMatching(query: string) {
    const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    if (!words.length) return null;
    let best: MemoryItem | null = null;
    let bestScore = 0;
    for (const item of this.data.items) {
      const t = item.text.toLowerCase();
      const score = words.filter((w) => t.includes(w)).length / words.length;
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    if (best && bestScore >= 0.5) {
      this.remove(best.id);
      return best;
    }
    return null;
  }
  forgetLast() {
    const last = this.data.items[this.data.items.length - 1];
    if (last) this.remove(last.id);
    return last ?? null;
  }
  clear() {
    this.data = { ...this.data, items: [] };
    this.save();
  }
  toPayload() {
    return { name: this.data.name, items: this.data.items.map((i) => ({ category: i.category, text: i.text })) };
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const memoryStore: MemoryStore = new LocalMemoryStore();
