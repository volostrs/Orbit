// Focused checks for proposal validation. No test framework is set up, so run directly:
//   npx tsx lib/ai/proposal.check.ts
import assert from "node:assert/strict";
import { buildProposal, ProposalError } from "./proposal";

const text = (id: string, type: string, t: string) => ({ id, type, props: {}, content: [{ type: "text", text: t, styles: {} }], children: [] });
const note = [
  text("id-1", "paragraph", "Exam on Friday"),
  text("id-2", "paragraph", "Study Mon, Wed and Fri"),
  { id: "id-3", type: "chart", props: { data: JSON.stringify({ title: "Hours", type: "bar", rows: [{ id: "r1", label: "Mon", value: 2 }] }), color: "red" }, children: [] },
];
const refs = ["id-1", "id-2", "id-3"];
const before = structuredClone(note);

const propose = (operations: unknown[]) => buildProposal("note-1", note, refs, { operations });
const rejects = (operations: unknown[], msg: RegExp) => assert.throws(() => propose(operations), (e) => e instanceof ProposalError && msg.test(e.message));
const habits = JSON.stringify({ habits: [{ name: "Study", mode: "days", days: ["Mon", "Wed", "Fri"], completed: [] }] });
const chart = JSON.stringify({ title: "Hours", type: "line", rows: [{ label: "Mon", value: 2 }, { label: "Tue", value: null }] });
const table = JSON.stringify({ columns: [{ name: "Task", type: "text" }, { name: "Done", type: "checkbox" }], rows: [["Read", true]] });

const tests: [string, () => void][] = [
  ["1 habit tracker insertion is accepted", () => {
    const p = propose([{ op: "insert", after: "b2", blocks: [{ type: "habitTracker", data_json: habits }] }]);
    const block = (p.ops[0] as any).blocks[0];
    assert.equal(block.type, "habitTracker");
    const data = JSON.parse(block.props.data);
    assert.deepEqual(data.habits[0].days, [0, 2, 4]);
    assert.ok(data.habits[0].id && data.done[data.habits[0].id]);
  }],
  ["2 chart insertion is accepted", () => {
    const p = propose([{ op: "insert", after: "end", blocks: [{ type: "chart", data_json: chart }] }]);
    const data = JSON.parse((p.ops[0] as any).blocks[0].props.data);
    assert.equal(data.type, "line");
    assert.ok(data.rows.every((r: any) => typeof r.id === "string"));
  }],
  ["3 data table insertion is accepted", () => {
    const p = propose([{ op: "insert", after: "start", blocks: [{ type: "dataTable", data_json: table }] }]);
    const data = JSON.parse((p.ops[0] as any).blocks[0].props.data);
    assert.equal(data.columns.length, 2);
    assert.equal(data.rows[0].cells[data.columns[1].id], true);
  }],
  ["3b model-invented ids are never used", () => {
    const p = propose([{ op: "insert", after: "end", blocks: [{ type: "chart", id: "evil", data_json: chart }] }]);
    assert.equal((p.ops[0] as any).blocks[0].id, undefined);
  }],
  ["3c converting a paragraph (update with advanced type) becomes insert + delete of the source", () => {
    const p = propose([{ op: "update", ref: "b2", type: "habitTracker", data_json: habits }]);
    assert.deepEqual(p.ops.map((o) => o.kind), ["insert", "delete"]);
    assert.equal((p.ops[0] as any).at, "id-2");
    assert.equal((p.ops[1] as any).id, "id-2");
    assert.match(p.preview[0].label, /habit tracker/);
    assert.equal(p.preview[0].before, "Study Mon, Wed and Fri");
  }],
  ["3d replace via insert after a block that is also deleted", () => {
    const p = propose([{ op: "insert", after: "b1", blocks: [{ type: "chart", data_json: chart }] }, { op: "delete", ref: "b1" }]);
    assert.equal(p.ops.length, 2);
  }],
  ["3e updating an existing chart keeps its ids and colour", () => {
    const p = propose([{ op: "update", ref: "b3", data_json: JSON.stringify({ title: "Hours", type: "bar", rows: [{ label: "Mon", value: 5 }] }) }]);
    const op = p.ops[0] as any;
    assert.equal(JSON.parse(op.props.data).rows[0].id, "r1");
    assert.equal(op.props.color, undefined); // colour is not in the patch, so updateBlock leaves it alone
  }],
  ["4a unknown block types are rejected", () => {
    rejects([{ op: "insert", after: "end", blocks: [{ type: "script", text: "x" }] }], /unsupported block type "script"/);
    rejects([{ op: "update", ref: "b1", type: "iframe" }], /unsupported block type "iframe"/);
  }],
  ["4b malformed advanced data is rejected", () => {
    rejects([{ op: "insert", after: "end", blocks: [{ type: "habitTracker" }] }], /needs data_json/);
    rejects([{ op: "insert", after: "end", blocks: [{ type: "habitTracker", data_json: "{nope" }] }], /not valid JSON/);
    rejects([{ op: "insert", after: "end", blocks: [{ type: "habitTracker", data_json: JSON.stringify({ habits: [{ name: "A", mode: "days", days: ["Funday"] }] }) }] }], /invalid days/);
    rejects([{ op: "insert", after: "end", blocks: [{ type: "chart", data_json: JSON.stringify({ type: "radar", rows: [] }) }] }], /bar, line or pie/);
    rejects([{ op: "insert", after: "end", blocks: [{ type: "dataTable", data_json: JSON.stringify({ columns: [{ name: "N", type: "number" }], rows: [["abc"]] }) }] }], /must be a number/);
    rejects([{ op: "update", ref: "b2", type: "chart", data_json: "[]" }], /JSON object/);
  }],
  ["4c advanced blocks still can't change type, bad refs rejected", () => {
    rejects([{ op: "update", ref: "b3", type: "habitTracker", data_json: habits }], /cannot change type/);
    rejects([{ op: "delete", ref: "b99" }], /unknown block reference/);
  }],
  ["5/6 building a proposal never mutates the document (nothing applies until accept; reject just discards it)", () => {
    propose([{ op: "update", ref: "b2", type: "habitTracker", data_json: habits }, { op: "delete", ref: "b1" }]);
    assert.deepEqual(note, before);
  }],
  ["invalid proposal yields no partial result", () => {
    rejects([{ op: "delete", ref: "b1" }, { op: "insert", after: "end", blocks: [{ type: "habitTracker", data_json: "{" }] }], /not valid JSON/);
    assert.deepEqual(note, before);
  }],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log("ok   ", name);
  } catch (e) {
    failed++;
    console.log("FAIL ", name, "\n     ", (e as Error).message);
  }
}
process.exit(failed ? 1 : 0);
