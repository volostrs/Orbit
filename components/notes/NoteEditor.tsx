"use client";

import { useRef, useState, useTransition } from "react";
import { updateNote, updateNoteIcon } from "@/lib/actions/notes";
import type { Note, Notebook } from "@/lib/db/schema";
import type { BlockNoteEditor } from "@blocknote/core";
import { IconPicker } from "../ui/IconPicker";
import { FloatingPopover } from "@/components/ui/floating-popover";
import { useToast } from "@/components/ui/toast";
import { ColorSwatches } from "../blocks/blockStyle";
import type { NoteAppearance } from "./useNoteAppearance";
import { Palette } from "lucide-react";
import { NoteHeaderActions } from "./NoteHeaderActions";
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

  const toast = useToast();
  const locked = note.isLocked;

  const handleContentChange = (newContent: any[]) => {
    if (locked) return; // programmatic changes (e.g. an accepted AI proposal) must not slip past the lock
    latestContent.current = newContent;
    onContentEdited?.(note.id, newContent);
    startTransition(async () => {
      try {
        const saved = await updateNote(
          note.id,
          undefined,
          newContent as unknown as Record<string, unknown>
        );
        if (!saved) toast("This change wasn't saved because the note is locked.");
      } catch (err) {
        console.error("Could not save note", err);
        toast("Couldn't save your last change. Check your connection.");
      }
    });
  };

  const handleTitleChange = (newTitle: string) => {
    if (locked) return;
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
          <NoteHeaderActions
            note={note}
            title={title}
            notebooks={notebooks}
            appearance={appearance}
            onAppearanceChange={onAppearanceChange}
            getContent={() => latestContent.current}
          />
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
        readOnly={locked}
        onChange={(e) => handleTitleChange(e.target.value)}
      />

      {/* Editor */}
      {/* Remounted when the lock changes so every block (including custom ones) picks up the new editable state. */}
      <Editor
        key={locked ? "locked" : "open"}
        editable={!locked}
        initialContent={Array.isArray(latestContent.current) ? latestContent.current : parsedContent}
        onChange={handleContentChange}
        onEditorReady={(editor) => onEditorReady?.(note.id, editor)}
      />
    </div>
  );
}