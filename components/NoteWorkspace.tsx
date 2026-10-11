"use client";

import { useState } from "react";
import { NoteEditor } from "@/components/NoteEditor";
import { AiSidebar } from "@/components/AiSidebar";
import { AiFloatingButton } from "@/components/AiFloatingButton";
import { DiffReviewModal } from "@/components/DiffReviewModal";

export function NoteWorkspace({ initialNote, notebooks, isAiOpen }: { initialNote: any; notebooks: any[]; isAiOpen: boolean }) {
  const [activeNoteContent, setActiveNoteContent] = useState(initialNote?.content || "");
  const [proposedContent, setProposedContent] = useState<string | null>(null);

  return (
    <>
      <section className="flex-1 h-full overflow-y-auto bg-black relative">
        {initialNote ? (
          <NoteEditor
            key={initialNote.id}
            note={{ ...initialNote, content: activeNoteContent }}
            notebooks={notebooks}
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
        activeNoteContent={activeNoteContent}
      />

      {proposedContent !== null && (
        <DiffReviewModal
          originalContent={activeNoteContent}
          proposedContent={proposedContent}
          onAccept={(newContent) => {
            setActiveNoteContent(newContent);
            setProposedContent(null);
          }}
          onReject={() => setProposedContent(null)}
        />
      )}
    </>
  );
}