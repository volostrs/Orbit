"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockNoteEditor } from "@blocknote/core";
import { NoteEditor } from "@/components/notes/NoteEditor";
import { AiSidebar } from "@/components/ai/AiSidebar";
import { AiFloatingButton } from "@/components/ai/AiFloatingButton";
import { DraftAssistNotification } from "@/components/ai/DraftAssistNotification";
import { useDraftAssist } from "@/components/ai/useDraftAssist";
import { useNoteAppearance } from "@/components/notes/useNoteAppearance";
import { IMPROVE_PROMPT } from "@/lib/ai/draftAssist";

// `hidden` (Dashboard/Calendar showing) only hides the workspace with CSS: the editor, its unsaved state, the AI
// conversation and the notification stay mounted, so coming back never reinitialises anything.
export function NoteWorkspace({
  initialNote,
  notebooks,
  isAiOpen,
  hidden = false,
  chats = [],
  activeChatId = null,
  initialMessages = [],
  maxChats = 3,
}: {
  initialNote: any;
  notebooks: any[];
  isAiOpen: boolean;
  hidden?: boolean;
  // Saved AI chats of this note, which one is selected (null = unsaved draft) and its saved messages.
  chats?: { id: string; title: string }[];
  activeChatId?: string | null;
  initialMessages?: { id: string; role: "user" | "assistant"; content: string; kind?: "notice" | "proposal" }[];
  maxChats?: number;
}) {
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
    // The improvement request gets its own new chat when the note has room for one.
    router.push(`/?noteId=${initialNote.id}&aiOpen=true${chats.length < maxChats ? "&chatId=new" : ""}`);
  });

  // Ctrl/Cmd + . toggles the AI sidebar from anywhere (including while typing in the editor).
  const aiHref = `/?${initialNote ? `noteId=${initialNote.id}&` : ""}aiOpen=${!isAiOpen}`;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === ".") {
        e.preventDefault();
        router.push(aiHref);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiHref, router]);

  const { appearance, update: updateAppearance } = useNoteAppearance(initialNote?.id);

  return (
    <div className={hidden ? "hidden" : "contents"} aria-hidden={hidden || undefined}>
      <section
        className="relative h-full min-w-0 flex-1 overflow-y-auto bg-black"
        style={appearance.accent ? { backgroundImage: `linear-gradient(to bottom, ${appearance.accent}1f, transparent 280px)` } : undefined}
      >
        {initialNote ? (
          <NoteEditor
            key={initialNote.id}
            note={initialNote}
            notebooks={notebooks}
            onEditorReady={handleEditorReady}
            onContentEdited={draft.onContentEdited}
            appearance={appearance}
            onAppearanceChange={updateAppearance}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium text-neutral-200">No note selected</p>
            <p className="max-w-xs text-xs leading-5 text-neutral-500">
              Pick a note from the sidebar, or create a new one to start writing.
            </p>
          </div>
        )}
        {initialNote && draft.pending && (
          <DraftAssistNotification
            key={`draft-assist-${initialNote.id}`}
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
        chats={chats}
        activeChatId={activeChatId}
        initialMessages={initialMessages}
        maxChats={maxChats}
      />
    </div>
  );
}
