"use client";

import { useRef, useState, useTransition } from "react";
import { updateNote, updateNoteIcon } from "@/lib/actions/notes";
import type { Note, Notebook } from "@/lib/db/schema";
import type { BlockNoteEditor } from "@blocknote/core";
import { IconPicker } from "./IconPicker";
import { FloatingPopover } from "@/components/ui/floating-popover";
import { ColorSwatches } from "./blocks/blockStyle";
import type { NoteAppearance } from "./useNoteAppearance";
import { Palette } from "lucide-react";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("./BlockEditor"), {
  ssr: false,
  loading: () => (
    <div className="py-4 text-sm text-neutral-500 motion-safe:animate-pulse">
      Loading editor...
    </div>
  ),
});

export function NoteEditor({
  note,
  notebooks,
  onEditorReady,
  onContentEdited,
  appearance,
  onAppearanceChange,
}: {
  note: Note;
  notebooks: Notebook[];
  // Reports this note's live editor (with the note id it belongs to), and null when it unmounts.
  onEditorReady?: (noteId: string, editor: BlockNoteEditor<any, any, any> | null) => void;
  // Reports every content change with the id of the note it belongs to (drives draft-assist's idle timer).
  onContentEdited?: (noteId: string, content: any[]) => void;
  appearance: NoteAppearance;
  onAppearanceChange: (patch: Partial<NoteAppearance>) => void;
}) {
  const [title, setTitle] = useState(note.title);
  // A rename from the sidebar changes note.title while this editor stays mounted; follow it.
  // Titles this editor saved itself are echoed back by revalidation (possibly late), so those are ignored.
  const sentTitles = useRef(new Set<string>([note.title]));
  const [seenTitle, setSeenTitle] = useState(note.title);
  if (note.title !== seenTitle) {
    setSeenTitle(note.title);
    if (!sentTitles.current.has(note.title)) setTitle(note.title);
  }
  const [isPending, startTransition] = useTransition();

  // Latest editor content, so title edits don't re-save the content the note was opened with.
  const latestContent = useRef<unknown>(note.content);

  const handleContentChange = (newContent: any[]) => {
    latestContent.current = newContent;
    onContentEdited?.(note.id, newContent);
    startTransition(async () => {
      await updateNote(
        note.id,
        undefined,
        newContent as unknown as Record<string, unknown>
      );
    });
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    sentTitles.current.add(newTitle);
    startTransition(async () => {
      await updateNote(note.id, newTitle);
    });
  };

  const handleIconChange = (newIcon: string, newColor: string) => {
    startTransition(async () => {
      await updateNoteIcon(note.id, newIcon, newColor);
    });
  };

  const handleIconRemove = () => {
    startTransition(async () => {
      await updateNoteIcon(note.id, null, null);
    });
  };

  const parsedContent = Array.isArray(note.content) ? note.content : [];

  return (
    <div
      className={`mx-auto w-full px-5 pb-32 pt-14 md:px-12 md:pt-16 ${appearance.width === "wide" ? "max-w-5xl" : "max-w-3xl"}`}
    >
      {/* Icon and note settings */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <IconPicker
          currentIcon={note.icon}
          currentColor={note.iconColor}
          onSelectIcon={handleIconChange}
          onRemoveIcon={handleIconRemove}
        />
        <div className="flex items-center gap-3">
          <span role="status" className="text-xs text-neutral-500">
            {isPending ? "Saving…" : ""}
          </span>
          <FloatingPopover
            triggerLabel="Page settings"
            align="end"
            triggerClassName="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
            trigger={
              <>
                <Palette className="h-3.5 w-3.5" /> Page
              </>
            }
            className="w-60 space-y-3 p-3"
          >
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">Width</div>
              <div role="radiogroup" aria-label="Page width" className="flex rounded-md border border-neutral-800 p-0.5">
                {(["standard", "wide"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    role="radio"
                    aria-checked={appearance.width === w}
                    onClick={() => onAppearanceChange({ width: w })}
                    className={`h-6 flex-1 rounded capitalize transition-colors ${
                      appearance.width === w ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-200"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">Accent</div>
              <ColorSwatches value={appearance.accent} onChange={(hex) => onAppearanceChange({ accent: hex })} label="Accent" />
            </div>
            <p className="text-[11px] leading-4 text-neutral-500">Saved in this browser for this note. Your content isn&apos;t changed.</p>
          </FloatingPopover>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        aria-label="Note title"
        className="mb-6 w-full border-none bg-transparent text-3xl font-bold tracking-tight text-neutral-100 outline-none placeholder:text-neutral-600 md:text-4xl"
        placeholder="Untitled"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
      />

      {/* Editor */}
      <Editor
        initialContent={parsedContent}
        onChange={handleContentChange}
        onEditorReady={(editor) => onEditorReady?.(note.id, editor)}
      />
    </div>
  );
}