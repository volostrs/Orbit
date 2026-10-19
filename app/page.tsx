import { getNotes } from "@/lib/actions/notes";
import { getNotebooks } from "@/lib/actions/notebooks";
import { ToastProvider } from "@/components/ui/toast";
import { SidebarNav } from "@/components/SidebarNav";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { NavShell } from "@/components/NavShell";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { NoteWorkspace } from "@/components/NoteWorkspace";
import { AiChatsView } from "@/components/AiChatsView";
import { listChatsForUser, listMessages, MAX_CONVERSATIONS_PER_NOTE, type ChatSummary, type StoredMessage } from "@/lib/ai/conversations";
import { CalendarDays } from "lucide-react";

function CalendarPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <CalendarDays className="h-8 w-8 text-neutral-500" />
      <p className="text-sm font-medium text-neutral-200">Calendar</p>
      <p className="max-w-xs text-xs leading-5 text-neutral-500">
        The calendar isn&apos;t built yet. Your notes and notebooks are untouched; pick one from the sidebar to keep working.
      </p>
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ noteId?: string; aiOpen?: string; view?: string; chatId?: string }>;
}) {
  const testUserId = "user_demo_123";
  const notes = await getNotes(testUserId);
  const notebooks = await getNotebooks(testUserId);
  const { noteId, aiOpen, view: viewParam, chatId } = await searchParams;

  const view = viewParam === "dashboard" || viewParam === "calendar" || viewParam === "chats" ? viewParam : null;
  const activeNote = notes.find((n) => n.id === noteId) || notes[0];
  const isAiOpen = aiOpen === "true";

  // Saved AI chats. The selected chat must belong to the open note (it is picked from that note's own list, never
  // taken from the URL on trust); "new" is an unsaved draft; no choice means the note's most recent chat.
  let allChats: ChatSummary[] = [];
  try {
    allChats = await listChatsForUser(testUserId);
  } catch (err) {
    console.error("Could not load AI chats:", err instanceof Error ? err.message : err);
  }
  const noteChats = activeNote ? allChats.filter((c) => c.noteId === activeNote.id) : [];
  const activeChatId = chatId === "new" ? null : noteChats.find((c) => c.id === chatId)?.id ?? noteChats[0]?.id ?? null;
  let initialMessages: StoredMessage[] = [];
  if (activeChatId) {
    try {
      initialMessages = await listMessages(activeChatId);
    } catch (err) {
      console.error("Could not load chat messages:", err instanceof Error ? err.message : err);
    }
  }

  // The sidebar never needs note bodies; leaving them out keeps the client payload small.
  const summaries = notes.map(({ content: _content, ...rest }) => rest);

  return (
    <ToastProvider>
    <main className="flex h-dvh w-screen overflow-hidden bg-black font-sans text-neutral-100 antialiased">
      {/* Navigation Sidebar */}
      <NavShell>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <h1 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Orbit</h1>

          <SidebarNav
            userId={testUserId}
            notes={summaries}
            notebooks={notebooks}
            activeNoteId={activeNote?.id}
            isAiOpen={isAiOpen}
            view={view}
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-neutral-800 pt-3">
          <ThemeSwitch />
        </div>
      </NavShell>

      {view === "dashboard" && (
        <section className="h-full min-w-0 flex-1 overflow-y-auto bg-black">
          <DashboardView data={{ notes: summaries, notebooks }} />
        </section>
      )}
      {view === "chats" && (
        <section className="h-full min-w-0 flex-1 overflow-y-auto bg-black">
          <AiChatsView notes={summaries} chats={allChats} maxChats={MAX_CONVERSATIONS_PER_NOTE} />
        </section>
      )}
      {view === "calendar" && (
        <section className="h-full min-w-0 flex-1 overflow-y-auto bg-black">
          <CalendarPlaceholder />
        </section>
      )}
      {/* Always rendered (hidden under a view) so the open note's editor is never unmounted. */}
      <NoteWorkspace
        initialNote={activeNote}
        notebooks={notebooks}
        isAiOpen={isAiOpen}
        hidden={view !== null}
        chats={noteChats}
        activeChatId={activeChatId}
        initialMessages={initialMessages}
        maxChats={MAX_CONVERSATIONS_PER_NOTE}
      />
    </main>
    </ToastProvider>
  );
}
