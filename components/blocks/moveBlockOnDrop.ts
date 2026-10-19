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
 * Drops of anything else fall through to the default handling. Returns a cleanup function.
 */
export function moveCustomBlocksOnDrop(editor: BlockNoteEditor<any, any, any>) {
  const view = editor.prosemirrorView;
  if (!view) return () => {};

  let sourceId: string | null = null;
  let handledAt = 0;

  const onDragStart = (event: DragEvent) => {
    sourceId = null;
    const html = event.dataTransfer?.getData("blocknote/html");
    if (!html) return;
    // Exactly one block in the payload, and it is a custom block we know how to move.
    if ((html.match(/class="bn-block-outer"/g) ?? []).length !== 1) return;
    const id = html.match(/data-id="([^"]+)"/)?.[1];
    const type = html.match(/data-content-type="([^"]+)"/)?.[1];
    if (id && type && MOVABLE.has(type)) sourceId = id;
  };

  const onDrop = (event: DragEvent) => {
    // A second drop from the same gesture (synthetic re-dispatch, etc.) must not insert another copy.
    if (!sourceId) {
      if (Date.now() - handledAt < 500) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    const id = sourceId;
    sourceId = null;
    handledAt = Date.now();
    // We own this drop; nothing else may insert or delete for it.
    event.preventDefault();
    event.stopImmediatePropagation();
    view.dragging = null;

    const source = editor.getBlock(id);
    const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!source || source.children.length > 0 || !hit) return; // keep the original in place

    // Find the block under the pointer; drop before/after it depending on which half is hovered.
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
    if (!destId || destId === id) return;
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
  };

  const onDragEnd = () => {
    sourceId = null;
  };

  // dragstart: bubble phase, so BlockNote's side-menu handler has already filled the drag payload.
  // drop: capture phase on the document, so we run before any editor-level drop handler.
  document.addEventListener("dragstart", onDragStart);
  document.addEventListener("drop", onDrop, true);
  document.addEventListener("dragend", onDragEnd);
  return () => {
    document.removeEventListener("dragstart", onDragStart);
    document.removeEventListener("drop", onDrop, true);
    document.removeEventListener("dragend", onDragEnd);
  };
}
