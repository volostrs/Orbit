// Draft-assist: decides, with cheap local checks, whether a note is worth even asking the model about,
// and keeps the small browser-side record of what has already been assessed, shown or declined.
// Pure helpers (no React) so they can be tested directly; storage is guarded for SSR/private mode.

import { inlineText, stripTestMarker, translateBlocks } from "./translateNote";

// Development-only test trigger: while this exact text is in the open note, the notification shows at once
// (no idle wait, eligibility check, model call, or "don't show again" opt-out). Never active in production.
export const TEST_MARKER = "[[ORBIT_TEST_AI_NOTIFICATION]]";
export const testMarkerEnabled = () => process.env.NODE_ENV !== "production";
export const hasTestMarker = (content: unknown) => {
  if (!testMarkerEnabled()) return false;
  try {
    return JSON.stringify(content)?.includes(TEST_MARKER) ?? false;
  } catch {
    return false;
  }
};

export const IDLE_MS = 5 * 60 * 1000; // quiet time after the last meaningful edit before assessing
export const MIN_WORDS = 50; // shorter notes are not drafts worth assessing
export const MIN_PROSE_BLOCKS = 3; // ...and need some actual structure (paragraphs, list items...)
export const MEANINGFUL_WORD_DELTA = 20; // how much a note must change before it qualifies again
// Sent when the user clicks "Help improve this note". Clicking it is explicit permission to take initiative,
// so this asks for a concrete proposal on the document itself, not a list of advice.
export const IMPROVE_PROMPT =
  "Please improve this note's clarity, organization and completeness. Use your best judgment for reasonable editorial changes, keeping my meaning and every fact as written. Call propose_edit with concrete changes to the note itself instead of only listing suggestions. Only ask a question if a missing fact makes a sensible edit impossible.";

const PROSE_TYPES = new Set(["paragraph", "heading", "bulletListItem", "numberedListItem", "checkListItem", "quote", "toggleListItem"]);

export interface DraftStats {
  words: number;
  proseBlocks: number;
  eligible: boolean;
  reason: string;
  /** Stable fingerprint of the whole translated note (prose and advanced blocks); changes when content does. */
  revision: string;
}

function collectProse(blocks: unknown, out: string[]) {
  if (!Array.isArray(blocks)) return;
  for (const b of blocks) {
    if (typeof b !== "object" || b === null) continue;
    const block = b as { type?: string; content?: unknown; children?: unknown };
    if (block.type && PROSE_TYPES.has(block.type)) {
      const text = stripTestMarker(inlineText(block.content)).trim();
      if (text) out.push(text);
    }
    collectProse(block.children, out);
  }
}

// FNV-1a: tiny, deterministic and plenty for "did this change" fingerprints.
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** Local, model-free eligibility check. Never throws. */
export function draftStats(content: unknown): DraftStats {
  const blocks: string[] = [];
  let revision = "empty";
  try {
    collectProse(content, blocks);
    // Fixed date: the translation embeds "today" for habit trackers, which must not change the revision.
    revision = hash(translateBlocks(content, new Date(0)));
  } catch {
    // Unreadable content is simply not eligible.
  }
  const tokens = blocks.join(" ").split(/\s+/).filter(Boolean);
  const wordLike = tokens.filter((t) => /\p{L}{2,}/u.test(t));
  const words = wordLike.length;
  const base = { words, proseBlocks: blocks.length, revision };
  if (!blocks.length) return { ...base, eligible: false, reason: "empty" };
  if (words < MIN_WORDS) return { ...base, eligible: false, reason: "too short" };
  if (blocks.length < MIN_PROSE_BLOCKS) return { ...base, eligible: false, reason: "too little structure" };
  if (wordLike.length / Math.max(tokens.length, 1) < 0.7) return { ...base, eligible: false, reason: "not mostly prose" };
  return { ...base, eligible: true, reason: "ok" };
}

export interface LastRecord {
  revision: string;
  words: number;
}

/** True if `cur` is new enough relative to the last assessed/declined state to be worth another look. */
export function isMeaningfullyNew(prev: LastRecord | null, cur: { revision: string; words: number }) {
  if (!prev) return true;
  if (prev.revision === cur.revision) return false;
  return Math.abs(cur.words - prev.words) >= MEANINGFUL_WORD_DELTA;
}

// ---- browser preferences (namespaced localStorage) ----------------------------------------------

const NS = "orbit:draftAssist:";
const read = (key: string): string | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(NS + key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (typeof window === "undefined") return;
    if (value === null) window.localStorage.removeItem(NS + key);
    else window.localStorage.setItem(NS + key, value);
  } catch {
    // Storage unavailable: the feature just degrades to "no memory", never throws.
  }
};
const readJson = <T>(key: string): T | null => {
  const raw = read(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const draftPrefs = {
  /** "Don't show this again": a global opt-out of the whole feature. */
  isDisabled: () => read("disabled") === "1",
  setDisabled: () => write("disabled", "1"),
  getLast: (noteId: string) => readJson<LastRecord>(`last:${noteId}`),
  setLast: (noteId: string, rec: LastRecord) => write(`last:${noteId}`, JSON.stringify(rec)),
  /** A shown-but-unanswered notification, kept per note so it survives switching and reloads. */
  getPending: (noteId: string) => readJson<{ reason?: string }>(`pending:${noteId}`),
  setPending: (noteId: string, reason?: string) => write(`pending:${noteId}`, JSON.stringify({ reason })),
  clearPending: (noteId: string) => write(`pending:${noteId}`, null),
};
