import type { BlockNoteEditor } from "@blocknote/core";
import { inlineText } from "./translateNote";
import type { Proposal } from "./proposal";

export type ApplyResult = { ok: true } | { ok: false; error: string };

const ADVANCED = new Set(["dataTable", "habitTracker", "chart"]);
const current = (b: any) => (ADVANCED.has(b.type) ? String(b.props?.data ?? "") : inlineText(b.content));

/**
 * Applies an accepted proposal to the live editor of the note it was made for.
 *
 * Refuses (and changes nothing) if the proposal belongs to a different note, if a block it refers to
 * is gone, or if a block's text/data changed since the proposal was made. All operations run in one
 * BlockNote transaction, so they either all apply or none do, and the editor's normal onChange then
 * autosaves the result through the open note's existing save path. Blocks the proposal does not
 * mention (including advanced blocks, their data, colors and icons) are never touched.
 */
export function applyProposal(editor: BlockNoteEditor<any, any, any>, proposal: Proposal, activeNoteId: string): ApplyResult {
  if (proposal.noteId !== activeNoteId) return { ok: false, error: "This proposal belongs to a different note." };

  const doc = editor.document;
  if (!doc.length) return { ok: false, error: "The editor is not ready." };
  const stale = "The note changed since this proposal was made. Please ask again.";

  for (const op of proposal.ops) {
    if (op.kind === "insert") {
      if (op.at !== "start" && op.at !== "end" && !editor.getBlock(op.at)) return { ok: false, error: stale };
    } else {
      const block = editor.getBlock(op.id);
      if (!block || current(block) !== op.expect) return { ok: false, error: stale };
    }
  }

  const first = doc[0].id;
  const last = doc[doc.length - 1].id;
  // Several inserts at the same anchor keep their proposed order by chaining after the previous one.
  const chain = new Map<string, string>();

  try {
    editor.transact(() => {
      for (const op of proposal.ops) {
        if (op.kind !== "insert") continue;
        const prev = chain.get(op.at);
        const [ref, placement] = prev
          ? ([prev, "after"] as const)
          : op.at === "start"
            ? ([first, "before"] as const)
            : ([op.at === "end" ? last : op.at, "after"] as const);
        const inserted = editor.insertBlocks(op.blocks as any, ref, placement);
        if (inserted.length !== op.blocks.length) throw new Error("Insertion failed.");
        chain.set(op.at, inserted[inserted.length - 1].id);
      }
      for (const op of proposal.ops) {
        if (op.kind !== "update") continue;
        const { kind: _k, id, expect: _e, ...patch } = op;
        editor.updateBlock(id, patch as any);
      }
      // Deletions last, so anchors for inserts above still exist while those run.
      const removals = proposal.ops.filter((o) => o.kind === "delete").map((o) => (o as { id: string }).id);
      if (removals.length) editor.removeBlocks(removals);
    });
  } catch (err) {
    console.error("Applying the AI proposal failed; the note was left unchanged.", err);
    return { ok: false, error: "Could not apply these changes. Your note was not modified." };
  }
  return { ok: true };
}
