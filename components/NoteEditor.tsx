"use client";

import { useRef, useState, useTransition } from "react";
import { updateNote, updateNoteIcon } from "@/lib/actions/notes";
import type { Note, Notebook } from "@/lib/db/schema";
import { IconPicker } from "./IconPicker";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("./BlockEditor"), {
  ssr: false,
  loading: () => (
    <div className="text-neutral-600 text-sm animate-pulse py-4">
      Loading editor...
    </div>
  ),
});

export function NoteEditor({
  note,
  notebooks,
}: {
  note: Note;
  notebooks: Notebook[];
}) {
  const [title, setTitle] = useState(note.title);
  const [isPending, startTransition] = useTransition();

  // Latest editor content, so title edits don't re-save the content the note was opened with.
  const latestContent = useRef<unknown>(note.content);

  const handleContentChange = (newContent: any[]) => {
    latestContent.current = newContent;
    startTransition(async () => {
      await updateNote(
        note.id,
        title,
        newContent as unknown as Record<string, unknown>,
        note.notebookId
      );
    });
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    startTransition(async () => {
      await updateNote(
        note.id,
        newTitle,
        latestContent.current as Record<string, unknown>,
        note.notebookId
      );
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
    <div className="w-full max-w-3xl mx-auto px-12 pt-16 pb-32">
      {/* Icon Picker Header */}
      <div className="mb-3">
        <IconPicker
          currentIcon={note.icon}
          currentColor={note.iconColor}
          onSelectIcon={handleIconChange}
          onRemoveIcon={handleIconRemove}
        />
      </div>

      {/* Title */}
      <input
        type="text"
        className="text-4xl font-bold bg-transparent border-none outline-none mb-6 text-neutral-100 placeholder-neutral-700 w-full tracking-tight"
        placeholder="Untitled"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
      />

      {/* Editor */}
      <Editor initialContent={parsedContent} onChange={handleContentChange} />
    </div>
  );
}