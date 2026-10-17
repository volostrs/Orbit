"use client";

import { useCallback, useRef } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { NoteEditor } from "@/components/NoteEditor";
import { AiSidebar } from "@/components/AiSidebar";
import { AiFloatingButton } from "@/components/AiFloatingButton";

export function NoteWorkspace({ initialNote, notebooks, isAiOpen }: { initialNote: any; notebooks: any[]; isAiOpen: boolean }) {
  // The live editor of the open note, tagged with its note id. The AI sidebar uses it to apply an
  // accepted proposal, and only ever gets it back for the note the proposal was made for.
  const editorRef = useRef<{ noteId: string; editor: BlockNoteEditor<any, any, any> } | null>(null);

  const handleEditorReady = useCallback((noteId: string, editor: BlockNoteEditor<any, any, any> | null) => {
    if (editor) editorRef.current = { noteId, editor };
    else if (editorRef.current?.noteId === noteId) editorRef.current = null;
  }, []);

  const getEditor = useCallback(
    (noteId: string) => (editorRef.current?.noteId === noteId ? editorRef.current.editor : null),
    []
  );

  return (
    <>
      <section className="flex-1 h-full overflow-y-auto bg-black relative">
        {initialNote ? (
          <NoteEditor
            key={initialNote.id}
            note={initialNote}
            notebooks={notebooks}
            onEditorReady={handleEditorReady}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
            No note selected.
          </div>
        )}
        <AiFloatingButton isAiOpen={isAiOpen} activeNoteId={initialNote?.id} />
      </section>

      <AiSidebar
        isOpen={isAiOpen}
        onCloseHref={`/?noteId=${initialNote?.id || ""}&aiOpen=`}
        activeNoteTitle={initialNote?.title}
        activeNoteId={initialNote?.id || ""}
        getEditor={getEditor}
      />
    </>
  );
}
