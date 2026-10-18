// Turns a model's propose_edit tool call into a validated, ready-to-apply proposal for ONE note.
//
// The model works with the translated text and {bN} refs; here refs are resolved to real block ids
// and advanced-block data is converted back into the exact JSON the blocks store (see
// components/blocks/*Block.tsx), reusing existing column/habit/row ids so nothing else is disturbed.
// Nothing in this file writes anything: the output is data for the client to show and, only after
// the user accepts, apply to the live editor.

import { HABIT_HISTORY_DAYS, inlineText, localKey, translateBlocks } from "./translateNote";

export type ProposalContent = { type: "text"; text: string; styles: Record<string, never> }[];
export type ProposalBlock = { type: string; props?: Record<string, unknown>; content?: ProposalContent };

export type ProposalOp =
  // at: "start", "end", or the id of the block to insert after.
  | { kind: "insert"; at: string; blocks: ProposalBlock[] }
  // `expect` is the block's text/data when the proposal was made; applying is refused if it changed.
  | { kind: "update"; id: string; expect: string; type?: string; props?: Record<string, unknown>; content?: ProposalContent }
  | { kind: "delete"; id: string; expect: string };

export interface ProposalPreviewItem {
  label: string;
  before?: string;
  after?: string;
}

export interface Proposal {
  id: string;
  noteId: string;
  ops: ProposalOp[];
  preview: ProposalPreviewItem[];
}

export class ProposalError extends Error {}

export const TEXT_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
]);
export const ADVANCED_TYPES = new Set(["dataTable", "habitTracker", "chart"]);
const ADVANCED_NAMES: Record<string, string> = { dataTable: "data table", habitTracker: "habit tracker", chart: "chart" };

const COLUMN_TYPES = ["text", "number", "checkbox", "date", "select"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_OPS = 25;
const MAX_TEXT = 5000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (msg: string): never => {
  throw new ProposalError(msg);
};
const isObj = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const uid = () => crypto.randomUUID();

function str(v: unknown, what: string, max: number, required = true): string {
  if (v === undefined || v === null || v === "") {
    if (required) fail(`${what} is missing`);
    return "";
  }
  if (typeof v !== "string") fail(`${what} must be text`);
  const s = (v as string).replace(/\s*\n\s*/g, " ").trim();
  if (s.length > max) fail(`${what} is too long`);
  return s;
}

const textContent = (text: string): ProposalContent => (text ? [{ type: "text", text, styles: {} }] : []);

function parseData(raw: unknown, what: string): any {
  if (typeof raw !== "string" || !raw) return fail(`${what} needs data_json`);
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return fail(`${what} data_json is not valid JSON`);
  }
  return isObj(v) ? v : fail(`${what} data_json must be a JSON object`);
}

const existingData = (block: any) => {
  try {
    const v = JSON.parse(block?.props?.data);
    return isObj(v) ? v : undefined;
  } catch {
    return undefined;
  }
};

// ---- model-facing JSON -> stored JSON -------------------------------------------------------

function convertTable(model: any, existing: any) {
  if (!Array.isArray(model.columns) || !model.columns.length || model.columns.length > 20) fail("table needs 1-20 columns");
  if (!Array.isArray(model.rows) || model.rows.length > 500) fail("table rows must be a list of at most 500 rows");
  const oldCols: any[] = Array.isArray(existing?.columns) ? existing.columns : [];
  const used = new Set<string>();
  const names = new Set<string>();
  const columns = model.columns.map((c: any) => {
    if (!isObj(c)) fail("each column must be an object");
    const name = str(c.name, "column name", 100);
    if (names.has(name)) fail(`duplicate column name "${name}"`);
    names.add(name);
    const type = c.type ?? "text";
    if (!COLUMN_TYPES.includes(type)) fail(`column "${name}" has an unsupported type`);
    const match = oldCols.find((o) => o?.name === name && typeof o?.id === "string" && !used.has(o.id));
    const id: string = match ? match.id : uid();
    used.add(id);
    const col: Record<string, unknown> = { id, name, type };
    if (type === "select") {
      const opts = Array.isArray(c.options) ? c.options : [];
      if (opts.length > 50 || opts.some((o: unknown) => typeof o !== "string" || !o.trim())) fail(`column "${name}" has invalid options`);
      col.options = [...new Set(opts.map((o: string) => o.trim()))];
    }
    return col as { id: string; name: string; type: string; options?: string[] };
  });
  const oldRows: any[] = Array.isArray(existing?.rows) ? existing.rows : [];
  const rows = model.rows.map((r: unknown, ri: number) => {
    if (!Array.isArray(r) || r.length > columns.length) fail(`row ${ri + 1} must be a list with at most ${columns.length} cells`);
    const cells: Record<string, string | number | boolean> = {};
    columns.forEach((col: any, i: number) => {
      const v = (r as unknown[])[i];
      if (v === null || v === undefined || v === "") {
        if (col.type === "checkbox") cells[col.id] = false;
        return;
      }
      if (col.type === "number") {
        const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
        if (!Number.isFinite(n)) fail(`row ${ri + 1}: "${col.name}" must be a number`);
        cells[col.id] = n;
      } else if (col.type === "checkbox") {
        if (typeof v !== "boolean") fail(`row ${ri + 1}: "${col.name}" must be true or false`);
        cells[col.id] = v as boolean;
      } else if (col.type === "date") {
        if (typeof v !== "string" || !DATE_RE.test(v)) fail(`row ${ri + 1}: "${col.name}" must be YYYY-MM-DD`);
        cells[col.id] = v as string;
      } else if (col.type === "select") {
        if (typeof v !== "string" || !col.options.includes(v)) fail(`row ${ri + 1}: "${col.name}" must be one of its options`);
        cells[col.id] = v as string;
      } else {
        cells[col.id] = str(String(v), `row ${ri + 1} "${col.name}"`, 2000);
      }
    });
    const oldId = oldRows[ri]?.id;
    return { id: typeof oldId === "string" ? oldId : uid(), cells };
  });
  return { columns, rows };
}

function convertHabits(model: any, existing: any, today: Date) {
  if (!Array.isArray(model.habits) || model.habits.length > 50) fail("habits must be a list of at most 50");
  const oldHabits: any[] = Array.isArray(existing?.habits) ? existing.habits : [];
  const oldDone: Record<string, string[]> = isObj(existing?.done) ? existing.done : {};
  // Dates older than the window were never shown to the model, so keep them as they were.
  const cutoff = localKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - HABIT_HISTORY_DAYS));
  const used = new Set<string>();
  const names = new Set<string>();
  const habits: any[] = [];
  const done: Record<string, string[]> = {};
  for (const h of model.habits) {
    if (!isObj(h)) fail("each habit must be an object");
    const name = str(h.name, "habit name", 100);
    if (names.has(name)) fail(`duplicate habit "${name}"`);
    names.add(name);
    const mode = h.mode ?? "days";
    if (mode !== "days" && mode !== "target") fail(`habit "${name}" mode must be days or target`);
    const match = oldHabits.find((o) => o?.name === name && typeof o?.id === "string" && !used.has(o.id));
    const id: string = match ? match.id : uid();
    used.add(id);
    const habit: Record<string, unknown> = { id, name, mode };
    if (match?.color) habit.color = match.color;
    if (mode === "days") {
      const raw = Array.isArray(h.days) ? h.days : [0, 1, 2, 3, 4, 5, 6];
      const days = raw.map((d: unknown) => (typeof d === "string" ? WEEKDAYS.indexOf(d) : d));
      if (days.some((d: unknown) => !Number.isInteger(d) || (d as number) < 0 || (d as number) > 6)) fail(`habit "${name}" has invalid days`);
      habit.days = [...new Set(days as number[])].sort();
    } else {
      const t = h.target ?? 3;
      if (!Number.isInteger(t) || t < 1 || t > 7) fail(`habit "${name}" target must be 1-7`);
      habit.target = t;
    }
    const completed: unknown[] = Array.isArray(h.completed) ? h.completed : [];
    if (completed.length > 800 || completed.some((d) => typeof d !== "string" || !DATE_RE.test(d))) fail(`habit "${name}" has invalid completed dates`);
    const older = (Array.isArray(oldDone[id]) ? oldDone[id] : []).filter((d) => typeof d === "string" && d < cutoff);
    done[id] = [...new Set([...older, ...(completed as string[])])].sort();
    habits.push(habit);
  }
  return { habits, done };
}

function convertChart(model: any, existing: any) {
  const type = model.type ?? "bar";
  if (!["bar", "line", "pie"].includes(type)) fail("chart type must be bar, line or pie");
  if (!Array.isArray(model.rows) || model.rows.length > 200) fail("chart rows must be a list of at most 200");
  const oldRows: any[] = Array.isArray(existing?.rows) ? existing.rows : [];
  const rows = model.rows.map((r: any, i: number) => {
    if (!isObj(r)) fail("each chart row must be an object");
    const v = r.value;
    if (v !== null && v !== undefined && !(typeof v === "number" && Number.isFinite(v))) fail(`chart row ${i + 1} value must be a number or null`);
    const oldId = oldRows[i]?.id;
    return { id: typeof oldId === "string" ? oldId : uid(), label: str(r.label, `chart row ${i + 1} label`, 100, false), value: v ?? null };
  });
  return { title: str(model.title, "chart title", 200, false), type, rows };
}

function convertData(type: string, raw: unknown, existingBlock: any, today: Date): string {
  const model = parseData(raw, type);
  const existing = existingData(existingBlock);
  const stored =
    type === "dataTable" ? convertTable(model, existing) : type === "habitTracker" ? convertHabits(model, existing, today) : convertChart(model, existing);
  return JSON.stringify(stored);
}

// ---- proposal assembly ------------------------------------------------------------------------

function indexBlocks(content: unknown): { byId: Map<string, any> } {
  const byId = new Map<string, any>();
  const visit = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const b of blocks) {
      if (!isObj(b)) continue;
      if (typeof b.id === "string") byId.set(b.id, b);
      visit(b.children);
    }
  };
  visit(content);
  return { byId };
}

const blockText = (b: any) => (ADVANCED_TYPES.has(b?.type) ? String(b?.props?.data ?? "") : inlineText(b?.content));
const plain = (b: any) => translateBlocks([{ ...b, id: undefined, children: [] }]);
const snippet = (s: string) => (s.length > 40 ? s.slice(0, 40) + "…" : s) || "(empty)";

/**
 * @param noteContent the note's stored BlockNote document (read only)
 * @param refs        ref list from buildNoteContextWithRefs (refs[n - 1] = id for {bn})
 * @param input       the raw tool input from the model
 */
export function buildProposal(noteId: string, noteContent: unknown, refs: string[], input: any, today: Date = new Date()): Proposal {
  if (!isObj(input) || !Array.isArray(input.operations) || !input.operations.length) fail("no operations were proposed");
  if (input.operations.length > MAX_OPS) fail(`too many operations (max ${MAX_OPS})`);
  const { byId } = indexBlocks(noteContent);

  const resolve = (ref: unknown): any => {
    const m = typeof ref === "string" ? /^\{?b(\d+)\}?$/.exec(ref.trim()) : null;
    const id = m ? refs[Number(m[1]) - 1] : undefined;
    const block = id ? byId.get(id) : undefined;
    return block ?? fail(`unknown block reference "${String(ref)}"`);
  };

  const touched = new Set<string>();
  const ops: ProposalOp[] = [];
  const preview: ProposalPreviewItem[] = [];

  for (const raw of input.operations as any[]) {
    if (!isObj(raw)) fail("each operation must be an object");

    if (raw.op === "insert") {
      if (!Array.isArray(raw.blocks) || !raw.blocks.length || raw.blocks.length > 30) fail("insert needs 1-30 blocks");
      let at: string;
      let where: string;
      if (raw.after === "start" || raw.after === "end") {
        at = raw.after;
        where = raw.after === "start" ? "at the start" : "at the end";
      } else {
        const target = resolve(raw.after);
        at = target.id;
        where = `after “${snippet(blockText(target) && !ADVANCED_TYPES.has(target.type) ? blockText(target) : plain(target).split("\n")[0])}”`;
      }
      const blocks: ProposalBlock[] = raw.blocks.map((b: any) => {
        if (!isObj(b)) return fail("each new block must be an object");
        const type = String(b.type);
        if (ADVANCED_TYPES.has(type)) return { type, props: { data: convertData(type, b.data_json, undefined, today) } };
        if (!TEXT_TYPES.has(type)) return fail(`unsupported block type "${type}"`);
        const props: Record<string, unknown> = {};
        if (type === "heading") props.level = [1, 2, 3].includes(b.level) ? b.level : 2;
        if (type === "checkListItem") props.checked = b.checked === true;
        return { type, props, content: textContent(str(b.text, "block text", MAX_TEXT, false)) };
      });
      ops.push({ kind: "insert", at, blocks });
      preview.push({ label: `Add ${blocks.length === 1 ? "1 block" : `${blocks.length} blocks`} ${where}`, after: translateBlocks(blocks) });
    } else if (raw.op === "update") {
      const block = resolve(raw.ref);
      if (touched.has(block.id)) fail("a block can only be changed once per proposal");
      touched.add(block.id);
      const expect = blockText(block);
      if (ADVANCED_TYPES.has(block.type)) {
        if (raw.type && raw.type !== block.type) fail("an advanced block cannot change type");
        const data = convertData(block.type, raw.data_json, block, today);
        ops.push({ kind: "update", id: block.id, expect, props: { data } });
        preview.push({ label: `Update ${block.type === "dataTable" ? "data table" : block.type === "habitTracker" ? "habit tracker" : "chart"}`, before: plain(block), after: plain({ ...block, props: { ...block.props, data } }) });
      } else if (TEXT_TYPES.has(block.type)) {
        const type = raw.type ?? block.type;
        if (ADVANCED_TYPES.has(type)) {
          // Converting text into an advanced block: a custom block can't be morphed from a text block in
          // place, so this is a replacement (insert the new block after it, delete the source) that is
          // applied atomically. The new block gets a fresh id from the editor, never one from the model.
          const created: ProposalBlock = { type, props: { data: convertData(type, raw.data_json, undefined, today) } };
          ops.push({ kind: "insert", at: block.id, blocks: [created] }, { kind: "delete", id: block.id, expect });
          preview.push({ label: `Replace text with ${ADVANCED_NAMES[type]}`, before: expect || "(empty)", after: translateBlocks([created]) });
          continue;
        }
        if (!TEXT_TYPES.has(type)) fail(`unsupported block type "${type}"`);
        const op: ProposalOp = { kind: "update", id: block.id, expect };
        if (raw.text !== undefined) op.content = textContent(str(raw.text, "block text", MAX_TEXT, false));
        if (type !== block.type) op.type = type;
        const props: Record<string, unknown> = {};
        if (type === "heading" && (raw.level !== undefined || type !== block.type)) props.level = [1, 2, 3].includes(raw.level) ? raw.level : block.props?.level ?? 2;
        if (type === "checkListItem" && raw.checked !== undefined) props.checked = raw.checked === true;
        if (Object.keys(props).length) op.props = props;
        if (op.content === undefined && op.type === undefined && !op.props) fail("update changes nothing");
        ops.push(op);
        preview.push({ label: "Change text", before: expect || "(empty)", after: op.content !== undefined ? op.content.map((c) => c.text).join("") || "(empty)" : `(${type})` });
      } else {
        fail(`blocks of type "${block.type}" cannot be edited`);
      }
    } else if (raw.op === "delete") {
      const block = resolve(raw.ref);
      if (touched.has(block.id)) fail("a block can only be changed once per proposal");
      touched.add(block.id);
      ops.push({ kind: "delete", id: block.id, expect: blockText(block) });
      preview.push({ label: "Delete block", before: plain(block) });
    } else {
      fail(`unknown operation "${String(raw.op)}"`);
    }
  }

  // An insert may be anchored on a block that is also deleted ("replace"): applyProposal runs inserts first.
  return { id: uid(), noteId, ops, preview };
}

// Separates the streamed chat text from the JSON proposal appended after it (ASCII record separators).
export const PROPOSAL_MARKER = "\n\u001eORBIT_PROPOSAL\u001e";
