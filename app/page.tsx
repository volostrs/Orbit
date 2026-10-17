import { getNotes } from "@/lib/actions/notes";
import { getNotebooks } from "@/lib/actions/notebooks";
import { NewNoteButton } from "@/components/NewNoteButton";
import {
  NewNotebookDialog,
  DeleteNotebookButton,
} from "@/components/NewNotebookDialog";
import { NoteActionMenu } from "@/components/NoteActionMenu";
import { DynamicIcon } from "@/components/DynamicIcon";
import { AiSidebarToggle } from "@/components/AiSidebarToggle";
import { NoteWorkspace } from "@/components/NoteWorkspace";
import Link from "next/link";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ noteId?: string; aiOpen?: string }>;
}) {
  const testUserId = "user_demo_123";
  const notes = await getNotes(testUserId);
  const notebooks = await getNotebooks(testUserId);
  const { noteId, aiOpen } = await searchParams;

  const activeNote = notes.find((n) => n.id === noteId) || notes[0];
  const isAiOpen = aiOpen === "true";

  const favoriteNotes = notes.filter((n) => n.isFavorite);
  const uncategorizedNotes = notes.filter((n) => !n.notebookId);

  return (
    <main className="flex h-screen w-screen bg-black text-white font-sans antialiased overflow-hidden">
      {/* Navigation Sidebar */}
      <aside className="w-64 border-r border-neutral-800 p-4 flex flex-col justify-between shrink-0 h-full bg-black">
        <div className="flex flex-col gap-4 overflow-y-auto flex-1 pr-1">
          <div className="flex items-center justify-between">
            <h1 className="text-xs font-semibold tracking-widest text-neutral-400 uppercase">
              Orbit
            </h1>
            <NewNotebookDialog userId={testUserId} />
          </div>

          <NewNoteButton userId={testUserId} />

          <div className="flex flex-col gap-4 mt-2">
            {/* Favorites Section */}
            {favoriteNotes.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider px-1">
                  Favorites
                </span>
                {favoriteNotes.map((note) => {
                  const isActive = note.id === activeNote?.id;
                  return (
                    <div
                      key={note.id}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded transition-colors ${
                        isActive
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-400 hover:bg-neutral-900"
                      }`}
                    >
                      <Link
                        href={`/?noteId=${note.id}${isAiOpen ? "&aiOpen=true" : ""}`}
                        className="truncate text-xs flex-1 flex items-center gap-2"
                      >
                        <DynamicIcon
                          name={note.icon || "FileText"}
                          color={note.iconColor || "#10b981"}
                          className="w-3.5 h-3.5 shrink-0"
                        />
                        <span className="truncate">{note.title || "Untitled"}</span>
                      </Link>
                      <NoteActionMenu
                        note={note}
                        notebooks={notebooks}
                        isActive={isActive}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Notebook Folders */}
            {notebooks.map((notebook) => {
              const folderNotes = notes.filter((n) => n.notebookId === notebook.id);
              return (
                <div key={notebook.id} className="flex flex-col gap-1">
                  <div className="group flex items-center justify-between text-xs font-semibold text-neutral-400 px-1 py-1">
                    <span className="truncate">📁 {notebook.title}</span>
                    <DeleteNotebookButton notebookId={notebook.id} />
                  </div>
                  <div className="pl-2 border-l border-neutral-800 flex flex-col gap-1">
                    {folderNotes.map((note) => {
                      const isActive = note.id === activeNote?.id;
                      return (
                        <div
                          key={note.id}
                          className={`group flex items-center justify-between px-2 py-1 rounded transition-colors ${
                            isActive
                              ? "bg-neutral-800 text-white"
                              : "text-neutral-400 hover:bg-neutral-900"
                          }`}
                        >
                          <Link
                            href={`/?noteId=${note.id}${isAiOpen ? "&aiOpen=true" : ""}`}
                            className="truncate text-xs flex-1 flex items-center gap-2"
                          >
                            <DynamicIcon
                              name={note.icon || "FileText"}
                              color={note.iconColor || "#10b981"}
                              className="w-3.5 h-3.5 shrink-0"
                            />
                            <span className="truncate">{note.title || "Untitled"}</span>
                          </Link>
                          <NoteActionMenu
                            note={note}
                            notebooks={notebooks}
                            isActive={isActive}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Uncategorized Notes */}
            {uncategorizedNotes.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider px-1">
                  Notes
                </span>
                {uncategorizedNotes.map((note) => {
                  const isActive = note.id === activeNote?.id;
                  return (
                    <div
                      key={note.id}
                      className={`group flex items-center justify-between px-2 py-1.5 rounded transition-colors ${
                        isActive
                          ? "bg-neutral-800 text-white"
                          : "text-neutral-400 hover:bg-neutral-900"
                      }`}
                    >
                      <Link
                        href={`/?noteId=${note.id}${isAiOpen ? "&aiOpen=true" : ""}`}
                        className="truncate text-xs flex-1 flex items-center gap-2"
                      >
                        <DynamicIcon
                          name={note.icon || "FileText"}
                          color={note.iconColor || "#10b981"}
                          className="w-3.5 h-3.5 shrink-0"
                        />
                        <span className="truncate">{note.title || "Untitled"}</span>
                      </Link>
                      <NoteActionMenu
                        note={note}
                        notebooks={notebooks}
                        isActive={isActive}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Orbit AI Toggle Button at Bottom Left */}
        <div className="pt-3 border-t border-neutral-800">
          <AiSidebarToggle
            isAiOpen={isAiOpen}
            activeNoteId={activeNote?.id}
          />
        </div>
      </aside>

      {/* Workspace Client Wrapper (Editor + AI Sidebar with change review) */}
      <NoteWorkspace
        initialNote={activeNote}
        notebooks={notebooks}
        isAiOpen={isAiOpen}
      />
    </main>
  );
}