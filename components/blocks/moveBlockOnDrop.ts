import type { BlockNoteEditor } from "@blocknote/core";

// Custom blocks whose drag-and-drop move we coordinate ourselves.
const MOVABLE = new Set(["dataTable", "habitTracker", "chart", "calendar", "clock"]);

/**
 * Moves a dragged custom block (data table, habit tracker, chart) as destination-copy followed by
 * source-delete, inside ONE BlockNote transaction, so the move is a single document change, a single
 * onChange/autosave and a single undo step.
 *
 *  1. At dragstart we record the dragged block's stable id (from the drag payload).
 *  2. On drop we take over the event before ProseMirror/BlockNote can insert anything themselves.
 *  3. In one `transact`: insert a copy (fresh id, same type and props) at the drop target, then remove
 *     the source by its recorded id. If the insert fails or anything throws, nothing is dispatched and
 *     the original stays where it was.
 *  4. Any follow-up drop event from the same gesture is swallowed, so nothing else can add a copy.
 *
 * Drops of anything else fall through to the default handling.
 *
 * Safety net: a drag must never increase the number of identical custom blocks. At dragstart we snapshot every
 * custom block (id + type/props signature). A first check runs synchronously at the end of the drop event, after
 * ProseMirror's own handler and before the browser can paint, and a final one shortly after the drop. If any
 * signature has more blocks than before, the surplus is removed, preferring the originals left behind so the
 * copy at the destination remains. This holds whichever path inserted the copy.
 *
 * Returns a cleanup function.
 */
export function moveCustomBlocksOnDrop(editor: BlockNoteEditor<any, any, any>) {
  const view = editor.prosemirrorView;
  if (!view) return () => {};

  let sourceId: string | null = null;
  let handledAt = 0;
  let snapshot: Map<string, string[]> | null = null; // signature -> ids present at dragstart
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  // Custom blocks (at any depth) as {id, signature} pairs.
  const customBlocks = () => {
    const found: { id: string; sig: string }[] = [];
    const walk = (blocks: any[]) => {
      for (const b of blocks) {
        if (MOVABLE.has(b.type)) found.push({ id: b.id, sig: b.type + JSON.stringify(b.props) });
        walk(b.children ?? []);
      }
    };
    walk(editor.document);
    return found;
  };

  const takeSnapshot = () => {
    snapshot = new Map();
    for (const { id, sig } of customBlocks()) snapshot.set(sig, [...(snapshot.get(sig) ?? []), id]);
  };

  // A non-final pass keeps the snapshot so the final pass can still catch anything inserted later.
  const settle = (final = true) => {
    const before = snapshot;
    if (final) snapshot = null;
    if (!before || view.isDestroyed) return;
    const now = new Map<string, string[]>();
    for (const { id, sig } of customBlocks()) now.set(sig, [...(now.get(sig) ?? []), id]);
    const surplus: string[] = [];
    for (const [sig, ids] of now) {
      const beforeIds = before.get(sig) ?? [];
      const extra = ids.length - beforeIds.length;
      // Originals left behind go first; if none remain, drop the later-added copies instead.
      if (extra > 0)
        surplus.push(...[...ids.filter((id) => beforeIds.includes(id)), ...ids.filter((id) => !beforeIds.includes(id)).reverse()].slice(0, extra));
    }
    if (surplus.length === 0) return;
    try {
      editor.transact(() => editor.removeBlocks(surplus));
    } catch (err) {
      console.error("Could not remove the duplicate left by a block move.", err);
    }
  };

  const settleSoon = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => settle(), 150);
  };

  const onDragStart = (event: DragEvent) => {
    sourceId = null;
    takeSnapshot();
    const html = event.dataTransfer?.getData("blocknote/html");
    if (!html) return;
    // Exactly one block in the payload, and it is a custom block we know how to move.
    if ((html.match(/class="bn-block-outer"/g) ?? []).length !== 1) return;
    const id = html.match(/data-id="([^"]+)"/)?.[1];
    const type = html.match(/data-content-type="([^"]+)"/)?.[1];
    if (id && type && MOVABLE.has(type)) sourceId = id;
  };

  const onDrop = (event: DragEvent) => {
    // A torn-down editor (e.g. after switching notes) must neither act on nor swallow the drop.
    if (view.isDestroyed) return;

    // A second drop from the same gesture (synthetic re-dispatch, etc.) must not insert another copy.
    if (!sourceId) {
      if (Date.now() - handledAt < 500) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    const id = sourceId;
    const source = editor.getBlock(id);
    const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });

    // Validate source block and hit position prior to intercepting event
    if (!source || source.children.length > 0 || !hit) return;

    // Find the block under the pointer
    const $pos = view.state.doc.resolve(hit.inside >= 0 ? hit.inside : hit.pos);
    let destId: string | undefined;
    let destRect: DOMRect | undefined;
    for (let d = $pos.depth; d >= 0; d--) {
      const node = $pos.node(d);
      if (node.type.name === "blockContainer") {
        destId = node.attrs.id;
        const dom = view.nodeDOM($pos.before(d));
        if (dom instanceof HTMLElement) destRect = dom.getBoundingClientRect();
        break;
      }
    }

    // Do not intervene if destination is missing or the block is dropped onto itself
    if (!destId || destId === id) return;

    // Valid custom drop target confirmed — take ownership of event
    sourceId = null;
    handledAt = Date.now();
    settleSoon();
    event.preventDefault();
    event.stopImmediatePropagation();
    view.dragging = null;

    const placement = destRect && event.clientY < destRect.top + destRect.height / 2 ? "before" : "after";

    try {
      editor.transact(() => {
        const [inserted] = editor.insertBlocks(
          [{ type: source.type, props: source.props }],
          destId!,
          placement
        );
        if (!inserted) throw new Error("Insertion failed; source block kept.");
        editor.removeBlocks([id]);
      });
    } catch (err) {
      console.error("Block move failed; original block left in place.", err);
    }
    settle(false);
  };

  // Reached only for drops we did not take over (ProseMirror's own handler has already run by now).
  const onDropHandledNatively = () => settle(false);

  const onDragEnd = () => {
    sourceId = null;
    settleSoon();
  };

  // dragstart: bubble phase, so BlockNote's side-menu handler has already filled the drag payload.
  // drop: capture phase on the document, so we run before any editor-level drop handler.
  document.addEventListener("dragstart", onDragStart);
  document.addEventListener("drop", onDrop, true);
  document.addEventListener("dragend", onDragEnd);
  window.addEventListener("drop", onDropHandledNatively);
  return () => {
    document.removeEventListener("dragstart", onDragStart);
    document.removeEventListener("drop", onDrop, true);
    document.removeEventListener("dragend", onDragEnd);
    window.removeEventListener("drop", onDropHandledNatively);
    clearTimeout(settleTimer);
  };
}