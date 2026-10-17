"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockNoteEditor } from "@blocknote/core";
import { NoteEditor } from "@/components/NoteEditor";
import { AiSidebar } from "@/components/AiSidebar";
import { AiFloatingButton } from "@/components/AiFloatingButton";
import { DraftAssistNotification } from "@/components/DraftAssistNotification";
import { useDraftAssist } from "@/components/useDraftAssist";
import { IMPROVE_PROMPT } from "@/lib/ai/draftAssist";

export function NoteWorkspace({ initialNote, notebooks, isAiOpen }: { initialNote: any; notebooks: any[]; isAiOpen: boolean }) {
  const router = useRouter();

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

  // Draft-assist: accepting the notification just opens the AI sidebar and asks it to review this note.
  // That request goes through the normal chat flow (clarifying questions, then a reviewable proposal);
  // the document is not touched until a proposal is accepted there.
  const [autoPrompt, setAutoPrompt] = useState<{ id: string; noteId: string; text: string } | null>(null);
  const draft = useDraftAssist(initialNote?.id, initialNote?.content, () => {
    if (!initialNote) return;
    setAutoPrompt({ id: crypto.randomUUID(), noteId: initialNote.id, text: IMPROVE_PROMPT });
    if (!isAiOpen) router.push(`/?noteId=${initialNote.id}&aiOpen=true`);
  });

  return (
    <>
      <section className="flex-1 h-full overflow-y-auto bg-black relative">
        {initialNote ? (
          <NoteEditor
            key={initialNote.id}
            note={initialNote}
            notebooks={notebooks}
            onEditorReady={handleEditorReady}
            onContentEdited={draft.onContentEdited}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
            No note selected.
          </div>
        )}
        {initialNote && draft.pending && (
          <DraftAssistNotification
            key={initialNote.id}
            reason={draft.pending.reason}
            onAccept={draft.accept}
            onDecline={draft.decline}
          />
        )}
        <AiFloatingButton isAiOpen={isAiOpen} activeNoteId={initialNote?.id} />
      </section>

      <AiSidebar
        isOpen={isAiOpen}
        onCloseHref={`/?noteId=${initialNote?.id || ""}&aiOpen=`}
        activeNoteTitle={initialNote?.title}
        activeNoteId={initialNote?.id || ""}
        getEditor={getEditor}
        autoPrompt={autoPrompt}
      />
    </>
  );
}
