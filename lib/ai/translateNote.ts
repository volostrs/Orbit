// Translates a note's BlockNote document into plain text for Gemini. Pure and read-only: it never
// mutates the document it is given, and the stored note is never replaced by this output.
//
// Shapes mirror what the custom blocks persist (see components/blocks/*Block.tsx): each stores a
// JSON string in props.data.

type AnyBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: unknown;
};

// Gemini guidance for advanced blocks. Kept short and constant so every request is consistent.
export const NOTE_GUIDANCE = `How to read the note below (a text translation of the user's real document; blocks appear in document order):
- [DATA TABLE]: structured data. Columns list name and type (text, number, checkbox, date, select; select shows its options). Rows are listed under the columns. Keep columns, types and values intact unless asked to change them.
- [HABIT TRACKER]: scheduling plus completion data. "scheduled days" are the weekdays a habit counts on; "weekly target" habits count any N days per week. Completed dates are YYYY-MM-DD. A completion on an unscheduled day does not count toward a days-mode habit.
- [CHART]: a visualization backed by label/value rows. Preserve the chart type and values unless the user asks to change them.
- [UNKNOWN BLOCK]: a block type you may not recognise; use what is shown and do not discard it.
Blocks carry a ref like {b3}; it only identifies a block for edits, so never mention refs to the user.
The note is the only document you have been given. Do not assume access to other notes.`;

// Rules for the propose_edit tool. Only the chat route adds these; they never change the saved note.
export const EDIT_GUIDANCE = `Clarification first (the user has ADHD: be clear, calm and brief):
- Questions, explanations, summaries and advice: answer directly in text. Do NOT call propose_edit.
- When asked to change, add, remove, reorganize or fill in the note, first judge whether the request is clear enough to do correctly. If it is vague, ambiguous, or missing something that would materially change the result, do NOT guess and do NOT call propose_edit: ask first. Use the note to understand what the user refers to, but never as a substitute for what they want.
- Ask as few questions as possible, all together in ONE message, each specific and easy to answer. Offer 2-3 short options or an example when that helps. If several readings are reasonable, say in one line how they differ and let the user choose. No long explanations or jargon.
- While waiting for an answer, change nothing and never treat silence as permission to assume. After the user answers, re-check; ask again only if something important is still unclear.
- If the request is already clear, do not ask extra questions: call propose_edit once with the smallest set of operations, plus a one-sentence text summary.
- If the user tells you to use your best judgment or make reasonable assumptions, do that for this task, but still ask if a missing detail makes a sensible result impossible.
- Nothing is applied automatically: the user reviews and accepts or rejects your proposal.
- Point at existing blocks with their {bN} ref. Change only what was asked; leave other blocks, including advanced blocks, alone. Never delete a block unless asked.
- Advanced block data (data_json) uses these JSON shapes, mirroring how the blocks are shown above:
  dataTable: {"columns":[{"name":"Task","type":"text|number|checkbox|date|select","options":["A","B"]}],"rows":[["cell for each column, in order"]]} (null for empty, true/false for checkbox, YYYY-MM-DD for date). When updating a table send ALL columns and rows, keeping existing column names unchanged.
  habitTracker: {"habits":[{"name":"Study","mode":"days","days":["Mon","Wed"],"completed":["YYYY-MM-DD"]},{"name":"Run","mode":"target","target":3,"completed":[]}]}. Send all habits.
  chart: {"title":"...","type":"bar|line|pie","rows":[{"label":"Mon","value":2}]}. Send all rows.`;

export const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HABIT_HISTORY_DAYS = 56; // completion dates older than this are summarised by count only
const MAX_CONTEXT_CHARS = 60_000;

const isObj = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

function parseJson(raw: unknown): any {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const cell = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();

// Inline content (text runs, links, nested custom inline) -> plain text.
export function inlineText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((c: any) => {
      if (typeof c === "string") return c;
      if (c?.type === "link") return `${inlineText(c.content)}${c.href ? ` (${c.href})` : ""}`;
      if (typeof c?.text === "string") return c.text;
      return inlineText(c?.content);
    })
    .join("");
}

function dataTable(props: Record<string, any>): string {
  const d = parseJson(props.data);
  if (!Array.isArray(d?.columns) || !Array.isArray(d?.rows)) return "[DATA TABLE] (empty or unreadable)";
  const cols: any[] = d.columns;
  const header = cols.map((c, i) => {
    const type = c?.type ?? "text";
    const opts = type === "select" && Array.isArray(c?.options) ? `: ${c.options.join(" / ")}` : "";
    return `${cell(c?.name ?? `Column ${i + 1}`)} (${type}${opts})`;
  });
  const lines = [`[DATA TABLE] ${cols.length} columns, ${d.rows.length} rows`, `| ${header.join(" | ")} |`];
  for (const r of d.rows) {
    const cells = r?.cells ?? {};
    const vals = cols.map((c, i) => {
      const v = cells[c?.id ?? `col-legacy-${i}`];
      if (c?.type === "checkbox") return v ? "yes" : "no";
      return cell(v);
    });
    lines.push(`| ${vals.join(" | ")} |`);
  }
  return lines.join("\n");
}

function habitTracker(props: Record<string, any>, today: Date): string {
  const d = parseJson(props.data);
  if (!Array.isArray(d?.habits)) return "[HABIT TRACKER] (empty or unreadable)";
  const done: Record<string, string[]> = isObj(d.done) ? d.done : {};
  const cutoff = localKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - HABIT_HISTORY_DAYS));
  const lines = [`[HABIT TRACKER] ${d.habits.length} habits (weeks run Mon-Sun; today is ${localKey(today)})`];
  for (const h of d.habits) {
    const mode = h?.mode ?? "days";
    const days: number[] = Array.isArray(h?.days) ? h.days : [0, 1, 2, 3, 4, 5, 6];
    const schedule =
      mode === "target"
        ? `weekly target: ${h?.target ?? 3} days per week (any days)`
        : `scheduled days: ${days.length ? days.map((i) => WEEKDAYS[i] ?? i).join(", ") : "none"}`;
    const dates = (Array.isArray(done[h?.id]) ? done[h.id] : []).filter((x) => typeof x === "string").sort();
    const recent = dates.filter((x) => x >= cutoff);
    const older = dates.length - recent.length;
    lines.push(
      `- ${h?.name ?? "Unnamed habit"} | ${schedule} | completed (last ${HABIT_HISTORY_DAYS} days): ${
        recent.length ? recent.join(", ") : "none"
      }${older > 0 ? ` (+${older} older)` : ""}`
    );
  }
  return lines.join("\n");
}

function chart(props: Record<string, any>): string {
  const d = parseJson(props.data);
  if (!Array.isArray(d?.rows)) return "[CHART] (empty or unreadable)";
  const rows = d.rows.map((r: any) => `${r?.label ?? ""}: ${r?.value ?? "(empty)"}`);
  return `[CHART] "${d.title ?? ""}" type: ${d.type ?? "bar"}; ${d.rows.length} data points\n${rows.join("\n")}`;
}

// BlockNote's built-in table: content = { type: "tableContent", rows: [{ cells: [...] }] }.
function builtinTable(content: unknown): string {
  const rows: any[] = isObj(content) && Array.isArray(content.rows) ? content.rows : [];
  const text = rows.map((r) => `| ${(r?.cells ?? []).map((c: any) => cell(inlineText(c?.content ?? c))).join(" | ")} |`);
  return `[TABLE]\n${text.join("\n")}`;
}

function describeBlock(b: AnyBlock, today: Date, num: { n: number }): string {
  const p = (b.props ?? {}) as Record<string, any>;
  const text = inlineText(b.content);
  if (b.type !== "numberedListItem") num.n = 0;
  switch (b.type) {
    case "paragraph":
      return text;
    case "heading":
      return `${"#".repeat(Math.min(Math.max(Number(p.level) || 1, 1), 6))} ${text}`;
    case "bulletListItem":
      return `- ${text}`;
    case "numberedListItem":
      return `${++num.n}. ${text}`;
    case "checkListItem":
      return `- [${p.checked ? "x" : " "}] ${text}`;
    case "toggleListItem":
      return `> ${text}`;
    case "quote":
      return `> ${text}`;
    case "codeBlock":
      return "```" + (p.language && p.language !== "text" ? p.language : "") + `\n${text}\n` + "```";
    case "table":
      return builtinTable(b.content);
    case "image":
    case "video":
    case "audio":
    case "file":
      return `[${b.type.toUpperCase()}${p.name ? `: ${p.name}` : ""}${p.caption ? ` - ${p.caption}` : ""}${p.url ? ` <${p.url}>` : ""}]`;
    case "dataTable":
      return dataTable(p);
    case "habitTracker":
      return habitTracker(p, today);
    case "chart":
      return chart(p);
    default: {
      // Unknown block: keep whatever readable information it carries.
      const shown: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(p)) if (v !== "" && v != null) shown[k] = typeof v === "string" ? v.slice(0, 200) : v;
      const extra = Object.keys(shown).length ? ` props=${JSON.stringify(shown)}` : "";
      return `[UNKNOWN BLOCK "${String(b.type)}"${extra}]${text ? ` ${text}` : ""}`;
    }
  }
}

function walk(blocks: unknown, today: Date, depth: number, out: string[], refs: string[]) {
  if (!Array.isArray(blocks)) return;
  const num = { n: 0 };
  const indent = "  ".repeat(depth);
  for (const raw of blocks) {
    if (!isObj(raw)) continue;
    const b = raw as AnyBlock;
    const line = describeBlock(b, today, num);
    // Skip empty spacer paragraphs but keep everything else, including blocks with no text.
    if (!(b.type === "paragraph" && !line)) {
      // Each listed block gets a short ref ({b1}, {b2}, ...) so a proposed edit can point at it. Refs map
      // to real block ids server-side; blocks without an id simply have no ref.
      const ref = typeof b.id === "string" && b.id ? `{b${refs.push(b.id)}} ` : "";
      out.push(line.split("\n").map((l, i) => indent + (i === 0 ? ref : "") + l).join("\n"));
    }
    walk(b.children, today, depth + 1, out, refs);
  }
}

/** Plain-text translation of a BlockNote document. Never throws; never mutates `content`. */
export function translateBlocks(content: unknown, today: Date = new Date()): string {
  return translateWithRefs(content, today).text;
}

/** Like translateBlocks, plus `refs`: refs[n - 1] is the block id behind the {bn} label in the text. */
export function translateWithRefs(content: unknown, today: Date = new Date()): { text: string; refs: string[] } {
  const out: string[] = [];
  const refs: string[] = [];
  try {
    walk(content, today, 0, out, refs);
  } catch {
    out.push("[Part of this note could not be translated.]");
  }
  return { text: out.length ? out.join("\n") : "(This note is empty.)", refs };
}

/** Full AI context for one note: guidance + title + translated body, capped for token safety. */
export function buildNoteContext(note: { title?: string | null; content?: unknown }, today: Date = new Date()): string {
  return buildNoteContextWithRefs(note, today).context;
}

/** Same as buildNoteContext, plus the ref -> block id list needed to resolve a proposed edit. */
export function buildNoteContextWithRefs(
  note: { title?: string | null; content?: unknown },
  today: Date = new Date()
): { context: string; refs: string[] } {
  const { text, refs } = translateWithRefs(note.content, today);
  const body = text.length > MAX_CONTEXT_CHARS ? text.slice(0, MAX_CONTEXT_CHARS) + "\n[Note truncated for length.]" : text;
  return {
    context: `${NOTE_GUIDANCE}\n\n--- CURRENT NOTE: "${note.title || "Untitled"}" ---\n${body}\n--- END OF NOTE ---`,
    refs,
  };
}
