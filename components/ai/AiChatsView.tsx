"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { NoteSummary } from "@/components/layout/SidebarNav";
import type { ChatSummary } from "@/lib/ai/conversations";
import { deleteConversation, renameConversation } from "@/lib/actions/conversations";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { FloatingPopover } from "@/components/ui/floating-popover";
import { useToast } from "@/components/ui/toast";

// The AI Chats page: every note as a parent, its saved chats nested beneath. It only navigates: a chat opens
// its note with that conversation in the AI sidebar (the one existing chat UI), and "New chat" opens an
// unsaved draft there. Nothing is created until a first prompt is sent.
export function AiChatsView({ notes, chats, maxChats }: { notes: NoteSummary[]; chats: ChatSummary[]; maxChats: number }) {
  const [toggled, setToggled] = useState<Set<string>>(new Set()); // notes whose default expand state was flipped
  const byNote = new Map<string, ChatSummary[]>();
  for (const c of chats) byNote.set(c.noteId, [...(byNote.get(c.noteId) ?? []), c]);

  // Notes that have chats come first (most recently active chat first); the rest follow, collapsed by default.
  const latest = (id: string) => byNote.get(id)?.[0]?.updatedAt ?? "";
  const ordered = [...notes].sort((a, b) => {
    const ca = byNote.has(a.id) ? 1 : 0;
    const cb = byNote.has(b.id) ? 1 : 0;
    return cb - ca || latest(b.id).localeCompare(latest(a.id));
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-14 md:px-12 md:pt-16">
      <h2 className="text-2xl font-semibold text-neutral-100">AI Chats</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Saved conversations, grouped by the note they&apos;re about. Each note can keep up to {maxChats}.
      </p>

      {chats.length === 0 && (
        <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm leading-6 text-neutral-400">
          <p className="font-medium text-neutral-200">No AI chats yet</p>
          <p className="mt-1">
            Choose <span className="text-neutral-200">New chat</span> under any note below, or open a note and use the AI button. A chat is saved
            once you send its first message, and stays with that note.
          </p>
        </div>
      )}

      {notes.length === 0 && <p className="mt-6 text-sm text-neutral-500">Create a note first, then you can start a chat about it.</p>}

      <ul className="mt-6 flex flex-col gap-1">
        {ordered.map((note) => {
          const list = byNote.get(note.id) ?? [];
          const defaultOpen = list.length > 0;
          const open = toggled.has(note.id) ? !defaultOpen : defaultOpen;
          const full = list.length >= maxChats;
          return (
            <li key={note.id}>
              <div className="group flex items-center gap-1 rounded-md px-1 hover:bg-neutral-900">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={`${open ? "Collapse" : "Expand"} chats for ${note.title || "Untitled"}`}
                  onClick={() =>
                    setToggled((prev) => {
                      const next = new Set(prev);
                      if (!next.delete(note.id)) next.add(note.id);
                      return next;
                    })
                  }
                  className="rounded p-1.5 text-neutral-500 hover:text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
                >
                  <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
                </button>
                <Link href={`/?noteId=${note.id}`} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm font-medium text-neutral-200">
                  <DynamicIcon name={note.icon || "FileText"} color={note.iconColor || "#10b981"} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{note.title || "Untitled"}</span>
                </Link>
                <span className="pr-2 text-[11px] text-neutral-500" title={`${list.length} of ${maxChats} saved chats`}>
                  {list.length}/{maxChats}
                </span>
              </div>

              {open && (
                <ul className="ml-5 flex flex-col gap-0.5 border-l border-neutral-800 pl-3">
                  {list.map((chat) => (
                    <ChatRow key={chat.id} chat={chat} />
                  ))}
                  <li>
                    {full ? (
                      <p className="px-2 py-1.5 text-xs leading-5 text-neutral-500">
                        This note has {maxChats} chats, the maximum. Delete one to start another.
                      </p>
                    ) : (
                      <Link
                        href={`/?noteId=${note.id}&aiOpen=true&chatId=new`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                      >
                        <Plus className="h-3.5 w-3.5" /> New chat
                      </Link>
                    )}
                  </li>
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChatRow({ chat }: { chat: ChatSummary }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(chat.title);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const item = "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-neutral-800 disabled:opacity-50";

  const submitRename = () => {
    const next = name.trim();
    setRenaming(false);
    if (!next || next === chat.title) return setName(chat.title);
    startTransition(async () => {
      const res = await renameConversation(chat.noteId, chat.id, next);
      if (!res.ok) toast("Couldn't rename that chat");
    });
  };

  return (
    <li className="group flex items-center gap-1 rounded-md hover:bg-neutral-900">
      {renaming ? (
        <form
          className="flex min-w-0 flex-1 py-1 pl-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitRename();
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setName(chat.title);
                setRenaming(false);
              }
            }}
            aria-label="Chat title"
            className="w-full min-w-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-100 outline-none focus:border-neutral-500"
          />
        </form>
      ) : (
        <Link
          href={`/?noteId=${chat.noteId}&aiOpen=true&chatId=${chat.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-xs text-neutral-300 hover:text-neutral-100"
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
          <span className="truncate">{chat.title}</span>
        </Link>
      )}
      <FloatingPopover
        open={menuOpen}
        onOpenChange={setMenuOpen}
        triggerLabel={`Actions for chat ${chat.title}`}
        triggerClassName={`mr-1 rounded p-1 text-neutral-400 transition-opacity hover:bg-neutral-800 hover:text-neutral-100 focus-visible:opacity-100 group-hover:opacity-100 ${menuOpen ? "opacity-100" : "opacity-0"} max-md:opacity-100`}
        trigger={<MoreHorizontal className="h-3.5 w-3.5" />}
        align="end"
        className="w-40 py-1"
      >
        <button
          className={item}
          onClick={() => {
            setMenuOpen(false);
            setName(chat.title);
            setRenaming(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" /> Rename
        </button>
        <button
          className={`${item} text-red-400`}
          disabled={isPending}
          onClick={() => {
            setMenuOpen(false);
            if (confirm(`Delete the chat “${chat.title}”? Its messages are removed; the note is not affected.`)) {
              startTransition(async () => {
                const res = await deleteConversation(chat.noteId, chat.id);
                toast(res.ok ? "Chat deleted" : "Couldn't delete that chat");
              });
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </FloatingPopover>
    </li>
  );
}
