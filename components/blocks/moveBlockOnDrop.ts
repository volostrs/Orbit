import type { BlockNoteEditor } from "@blocknote/core";

// Custom blocks whose drag-and-drop move we coordinate ourselves.
const MOVABLE = new Set(["dataTable", "habitTracker", "chart"]);

/**
 * Handles drops of a single custom block (data table, habit tracker, chart) as one atomic
 * BlockNote transaction: insert the copy at the destination, then remove the source. The default
 * ProseMirror drop deletes whatever is selected at drop time, which can leave both copies (or the
 * wrong content) behind. Both steps live in one `transact`, so one doc change, one onChange and
 * one autosave; if anything throws, nothing is dispatched and the original block stays.
 *
 * Returns a cleanup function. Drops of anything else fall through to the default handler.
 */
export function moveCustomBlocksOnDrop(editor: BlockNoteEditor<any, any, any>) {
  const view = editor.prosemirrorView;
  if (!view) return () => {};

  const onDrop = (event: DragEvent) => {
    const slice = view.dragging?.slice;
    if (!slice || slice.content.childCount !== 1) return;

    const container = slice.content.firstChild!;
    const type = container.firstChild?.type.name;
    const sourceId = container.attrs.id as string | undefined;
    // Only plain custom blocks; blocks with nested children use the default behaviour.
    if (!type || !MOVABLE.has(type) || !sourceId || container.childCount > 1) return;

    const source = editor.getBlock(sourceId);
    const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!source || source.children.length > 0 || !hit) return;

    // Find the block under the pointer; drop before/after it depending on the half hovered.
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

    // We own this drop from here on, so ProseMirror must not also move/copy it.
    event.preventDefault();
    event.stopPropagation();
    view.dragging = null;

    if (!destId || destId === sourceId) return;
    const placement = destRect && event.clientY < destRect.top + destRect.height / 2 ? "before" : "after";

    try {
      editor.transact(() => {
        const [inserted] = editor.insertBlocks(
          [{ type: source.type, props: source.props }],
          destId!,
          placement
        );
        if (!inserted) throw new Error("Insertion failed; source block kept.");
        editor.removeBlocks([sourceId]);
      });
    } catch (err) {
      console.error("Block move failed; original block left in place.", err);
    }
  };

  // Capture phase so we run before ProseMirror's own drop handler on the same element.
  view.dom.addEventListener("drop", onDrop, true);
  return () => view.dom.removeEventListener("drop", onDrop, true);
}
