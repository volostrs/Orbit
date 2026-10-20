"use client";

import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { ArrowRight, ArrowUp, ChevronDown, PanelRightClose, Plus, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BlockNoteEditor } from "@blocknote/core";
import { applyProposal } from "@/lib/ai/applyProposal";
import { PROPOSAL_MARKER, type Proposal } from "@/lib/ai/proposal";
import { AiMarkdown } from "@/components/ai/AiMarkdown";
import { FloatingPopover } from "@/components/ui/floating-popover";
import { saveConversationNotice } from "@/lib/actions/conversations";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  // "notice": a short system line (applied, rejected, stopped). "proposal": the reply that came with a reviewable change.
  kind?: "notice" | "proposal";
}

// What the client genuinely knows about an in-flight request: nothing has come back yet, or the stream is open.
type RunStage = "waiting" | "streaming";

export interface ChatItem {
  id: string;
  title: string;
}

interface AiSidebarProps {
  isOpen: boolean;
  onCloseHref: string;
  activeNoteTitle?: string;
  activeNoteId: string;
  // Returns the live editor for a note id, or null if that note is not the one open.
  getEditor: (noteId: string) => BlockNoteEditor<any, any, any> | null;
  // A message to send on the user's behalf (e.g. from the draft-assist notification), once, for that note.
  autoPrompt?: { id: string; noteId: string; text: string } | null;
  // This note's saved chats (newest first), the one the URL selects (null = an unsaved new-chat draft), and
  // that chat's saved messages as loaded from the database.
  chats: ChatItem[];
  activeChatId: string | null;
  initialMessages: Message[];
  maxChats: number;
}

type ChatError = { text: string; retryable: boolean };

const STARTERS = [
  "Summarize this note",
  "What should I focus on first?",
  "Pull out the key points",
  "Turn this into a checklist",
];

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400";

// A clarifying question is a reply that ends by asking something, so it is styled as needing an answer.
const isQuestion = (m: Message) =>
  m.role === "assistant" && !m.kind && m.content.trim().split("\n").slice(-2).some((l) => l.includes("?"));

const newId = () => crypto.randomUUID();

function Status({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-[12px] text-neutral-500">
      <span aria-hidden className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 rounded-full bg-neutral-500 motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}

export function AiSidebar({
  isOpen,
  onCloseHref,
  activeNoteTitle,
  activeNoteId,
  getEditor,
  autoPrompt,
  chats,
  activeChatId,
  initialMessages,
  maxChats,
}: AiSidebarProps) {
  const router = useRouter();
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [input, setInput] = useState("");
  const [chatMenuOpen, setChatMenuOpen] = useState(false);

  // The conversation on screen: the URL's choice (activeChatId), or null for an unsaved draft. After the first
  // prompt of a draft is saved it moves to the new chat locally at once, and the URL catches up behind it.
  const propSelection = `${activeNoteId}:${activeChatId ?? "draft"}`;
  const [seenSelection, setSeenSelection] = useState(propSelection);
  const [selected, setSelected] = useState<string | null>(activeChatId);
  if (propSelection !== seenSelection) {
    setSeenSelection(propSelection);
    setSelected(activeChatId);
  }
  const convKey = selected ?? `draft:${activeNoteId}`;
  const [localTitles, setLocalTitles] = useState<Record<string, string>>({});

  // Everything below is keyed by conversation (a saved chat id, or `draft:<noteId>`), so messages, a request
  // in flight, an error or a pending proposal can only ever show up in the conversation they belong to.
  const [chatSessions, setChatSessions] = useState<Record<string, Message[]>>({});
  const [runs, setRuns] = useState<Record<string, RunStage | undefined>>({});
  const [errors, setErrors] = useState<Record<string, ChatError | undefined>>({});
  // Pending AI proposals by the conversation they were made in. Only that conversation shows its proposal, and
  // it can only be applied to the note it was made for. Proposals are never saved: after a reload the reply
  // text is restored, but there is nothing to accept.
  const [proposals, setProposals] = useState<Record<string, Proposal | undefined>>({});
  const controllers = useRef<Record<string, AbortController | undefined>>({});

  // Saved messages are shown straight from the server's copy; the first time a conversation is touched here its
  // session is seeded from that copy, and from then on the live session is the source of truth.
  const messages = chatSessions[convKey] ?? (selected ? initialMessages : []);
  const stage = runs[convKey];
  const error = errors[convKey];
  const proposal = proposals[convKey];
  const busy = stage !== undefined;
  const atLimit = chats.length >= maxChats;

  useEffect(() => {
    if (!selected) return;
    setChatSessions((prev) => (selected in prev ? prev : { ...prev, [selected]: initialMessages }));
    // Seed once per conversation; later server copies (autosave refreshes) must not overwrite the live session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // An unsaved draft is empty by definition: once its first prompt has been saved elsewhere, reset it.
  useEffect(() => {
    if (selected) setChatSessions((prev) => (prev[`draft:${activeNoteId}`]?.length ? { ...prev, [`draft:${activeNoteId}`]: [] } : prev));
  }, [selected, activeNoteId]);

  // Send an auto prompt exactly once, only for the note it was made for, once the sidebar is open.
  const sendRef = useRef<(text: string, title?: string) => void>(() => {});
  const handledPrompt = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !autoPrompt || autoPrompt.noteId !== activeNoteId || handledPrompt.current === autoPrompt.id) return;
    // Wait for the new-chat draft to be on screen (unless all chats are used: then it goes to the open chat).
    if (selected !== null && chats.length < maxChats) return;
    handledPrompt.current = autoPrompt.id;
    sendRef.current(autoPrompt.text, "Improve this note");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoPrompt, activeNoteId, selected]);

  // Leaving the app: don't leave requests running.
  useEffect(() => {
    const active = controllers.current;
    return () => Object.values(active).forEach((c) => c?.abort());
  }, []);

  // Follow the conversation only while the reader is at the bottom; scrolling up to read stops it.
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useEffect(() => {
    stick.current = true;
  }, [convKey]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, stage, error, proposal, convKey, isOpen]);

  // Grow the composer with its content, up to a limit.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input, isOpen]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 650) {
        setWidth(newWidth);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const patchSession = (key: string, fn: (list: Message[]) => Message[]) =>
    setChatSessions((prev) => ({ ...prev, [key]: fn(prev[key] || []) }));
  // Notices are shown at once and saved with the chat (when it is saved), but never sent to the model.
  const addNotice = (key: string, noteId: string, chatId: string | null, content: string) => {
    patchSession(key, (l) => [...l, { id: newId(), role: "assistant", content, kind: "notice" }]);
    if (chatId) void saveConversationNotice(noteId, chatId, content).catch(() => {});
  };

  // One request for one conversation of one note. The server owns the history: only the NEW message is sent
  // (plus ids), and the stream is the existing /api/chat text stream, then (optionally) a proposal behind
  // PROPOSAL_MARKER. `chatId` is null for the first prompt of a draft, which creates the saved chat.
  const run = async (o: { noteId: string; key: string; chatId: string | null; text: string; retry?: boolean; title?: string; userMsgId?: string }) => {
    const { noteId, text } = o;
    let key = o.key;
    let chatId = o.chatId;
    const ctrl = new AbortController();
    controllers.current[key] = ctrl;
    setRuns((p) => ({ ...p, [key]: "waiting" }));
    setErrors((p) => ({ ...p, [key]: undefined }));

    const replyId = newId();
    let started = false;
    const showReply = (content: string, kind?: Message["kind"]) => {
      if (!started) {
        started = true;
        patchSession(key, (l) => [...l, { id: replyId, role: "assistant", content, kind }]);
      } else {
        patchSession(key, (l) => l.map((m) => (m.id === replyId ? { ...m, content, kind } : m)));
      }
    };

    let assistantContent = "";
    let gotProposal = false;
    const startKey = key;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ noteId, conversationId: chatId, text, retry: o.retry === true, title: o.title }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // Nothing was saved or sent: take the optimistic message back and give the text back to the user.
        if (o.userMsgId) patchSession(key, (l) => l.filter((m) => m.id !== o.userMsgId));
        setInput((cur) => cur || text);
        setErrors((p) => ({ ...p, [key]: { text: data?.error || `Request failed (${res.status}). Your message was not sent.`, retryable: false } }));
        return;
      }
      if (!res.body) throw new Error("No response body");

      // First prompt of a draft: the server just created the saved chat. Move this conversation there.
      const createdId = res.headers.get("X-Orbit-Conversation");
      if (!chatId && createdId) {
        const from = key; // captured: the updaters below run later, after `key` has been reassigned
        chatId = createdId;
        const title = decodeURIComponent(res.headers.get("X-Orbit-Conversation-Title") || "");
        if (title) setLocalTitles((p) => ({ ...p, [createdId]: title }));
        setChatSessions((p) => ({ ...p, [createdId]: p[from] || [] }));
        setProposals((p) => ({ ...p, [createdId]: p[from] }));
        setRuns((p) => ({ ...p, [createdId]: "waiting", [from]: undefined }));
        setErrors((p) => ({ ...p, [createdId]: p[from] }));
        controllers.current[createdId] = ctrl;
        controllers.current[from] = undefined;
        key = createdId;
        setSelected(createdId);
        router.replace(`/?noteId=${noteId}&aiOpen=true&chatId=${createdId}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        raw += decoder.decode(value, { stream: true });
        // Anything after the marker is a machine-readable proposal, not chat text.
        assistantContent = raw.split(PROPOSAL_MARKER)[0];
        if (assistantContent) {
          setRuns((p) => ({ ...p, [key]: "streaming" }));
          showReply(assistantContent);
        }
      }

      // A proposal is only held in memory (never applied here) and only if it was made for this note AND chat.
      const markerAt = raw.indexOf(PROPOSAL_MARKER);
      if (markerAt !== -1) {
        try {
          const p = JSON.parse(raw.slice(markerAt + PROPOSAL_MARKER.length)) as Proposal;
          if (p && p.noteId === noteId && p.conversationId === chatId && Array.isArray(p.ops) && Array.isArray(p.preview)) {
            gotProposal = true;
            setProposals((prev) => ({ ...prev, [key]: p }));
            showReply(assistantContent, "proposal");
          }
        } catch {
          // Malformed proposal: ignore it; nothing is changed.
        }
      }
      if (!assistantContent.trim() && !gotProposal) {
        setErrors((p) => ({ ...p, [key]: { text: "No response came back. Your note was not changed.", retryable: true } }));
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        addNotice(key, noteId, chatId, "Stopped. Your note was not changed.");
      } else {
        console.error("Chat request failed:", err);
        setErrors((p) => ({ ...p, [key]: { text: "Something went wrong reaching the assistant. Your note was not changed.", retryable: true } }));
      }
    } finally {
      if (controllers.current[key] === ctrl) controllers.current[key] = undefined;
      setRuns((p) => ({ ...p, [key]: undefined, [startKey]: undefined }));
    }
  };

  const handleSend = (text: string, title?: string) => {
    const trimmed = text.trim();
    // One request at a time per conversation; the rest of Orbit stays fully usable meanwhile.
    if (!trimmed || !activeNoteId || runs[convKey]) return;
    let key = convKey;
    let chatId = selected;
    // An automatic prompt with all chats used goes to the open (or newest) chat rather than failing.
    if (!chatId && atLimit && title) {
      chatId = chats[0]?.id ?? null;
      if (chatId) key = chatId;
    }
    setInput("");
    stick.current = true;
    const userMsg: Message = { id: newId(), role: "user", content: trimmed };
    const base = chatSessions[key] ?? (chatId && chatId === selected ? initialMessages : []);
    setChatSessions((prev) => ({ ...prev, [key]: [...base, userMsg] }));
    void run({ noteId: activeNoteId, key, chatId, text: trimmed, title, userMsgId: userMsg.id });
  };
  sendRef.current = handleSend;

  const stop = () => controllers.current[convKey]?.abort();

  // Resend the last user message, dropping whatever partial reply followed it.
  const retry = () => {
    if (runs[convKey]) return;
    const lastUser = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUser === -1) return;
    stick.current = true;
    setChatSessions((prev) => ({ ...prev, [convKey]: messages.slice(0, lastUser + 1) }));
    void run({ noteId: activeNoteId, key: convKey, chatId: selected, text: messages[lastUser].content, retry: true });
  };

  const rejectProposal = () => {
    setProposals((prev) => ({ ...prev, [convKey]: undefined }));
    addNotice(convKey, activeNoteId, selected, "Proposal rejected. Your note was not changed.");
  };

  const acceptProposal = () => {
    if (!proposal) return;
    const editor = getEditor(activeNoteId);
    const result = editor
      ? applyProposal(editor, proposal, activeNoteId, selected)
      : ({ ok: false, error: "The note editor isn't ready. Your note was not changed." } as const);
    setProposals((prev) => ({ ...prev, [convKey]: undefined }));
    addNotice(convKey, activeNoteId, selected, result.ok ? "Changes applied to your note." : result.error);
  };

  const chatHref = (id: string) => `/?noteId=${activeNoteId}&aiOpen=true&chatId=${id}`;
  const currentTitle = selected ? chats.find((c) => c.id === selected)?.title ?? localTitles[selected] ?? "Chat" : "New chat";

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend(input);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      style={{ "--ai-w": `${width}px` } as CSSProperties}
      aria-label="Orbit AI"
      className="relative z-40 flex h-full w-[var(--ai-w)] shrink-0 flex-col border-l border-neutral-800 bg-neutral-950 max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-dvh max-md:w-full max-md:border-l-0"
    >
      {/* Resizer Handle (desktop only) */}
      <div
        onMouseDown={startResizing}
        className="group absolute bottom-0 left-0 top-0 z-50 flex w-1.5 cursor-col-resize items-center justify-center transition-colors hover:bg-neutral-700/40 max-md:hidden"
        title="Drag to resize"
      >
        <div className="h-8 w-0.5 rounded-full bg-neutral-800 group-hover:bg-neutral-500" />
      </div>

      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-neutral-800 px-4">
        <div className="min-w-0">
          <FloatingPopover
            open={chatMenuOpen}
            onOpenChange={setChatMenuOpen}
            triggerLabel={`Chat: ${currentTitle}. Switch chat`}
            triggerClassName={`flex max-w-full items-center gap-1 rounded text-left text-[13px] font-medium leading-4 text-neutral-100 hover:text-white ${focusRing}`}
            trigger={
              <>
                <span className="truncate">{currentTitle}</span>
                <ChevronDown className="h-3 w-3 shrink-0 text-neutral-500" />
              </>
            }
            align="start"
            className="w-64 py-1"
          >
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">Chats for this note</p>
            {chats.length === 0 && <p className="px-3 py-1.5 text-neutral-500">No saved chats yet.</p>}
            {chats.map((c) => (
              <Link
                key={c.id}
                href={chatHref(c.id)}
                onClick={() => setChatMenuOpen(false)}
                aria-current={c.id === selected ? "true" : undefined}
                className={`block truncate px-3 py-1.5 hover:bg-neutral-800 ${c.id === selected ? "bg-neutral-800 text-neutral-100" : "text-neutral-300"}`}
              >
                {c.title}
              </Link>
            ))}
            <div className="my-1 border-t border-neutral-800" />
            {atLimit ? (
              <p className="px-3 py-1.5 leading-4 text-neutral-500">
                This note has {maxChats} saved chats, the maximum. Open one above, or delete one from AI Chats to start a new one.
              </p>
            ) : (
              <Link
                href={`/?noteId=${activeNoteId}&aiOpen=true&chatId=new`}
                onClick={() => setChatMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
              >
                <Plus className="h-3.5 w-3.5" /> New chat
              </Link>
            )}
          </FloatingPopover>
          <p className="truncate text-[11px] leading-4 text-neutral-500">{activeNoteTitle || "Untitled"}</p>
        </div>
        <Link
          href={onCloseHref}
          className={`rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-neutral-200 ${focusRing}`}
          title="Close AI Sidebar"
          aria-label="Close AI Sidebar"
        >
          <PanelRightClose className="h-4 w-4" />
        </Link>
      </header>

      {/* Conversation: scrolls on its own; the composer below never moves */}
      <div ref={scrollRef} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-5">
        {messages.length === 0 && !busy && !error ? (
          <div className="my-auto">
            <h3 className="text-sm font-medium text-neutral-100">Ask about this note</h3>
            <p className="mt-1.5 text-[13px] leading-5 text-neutral-500">
              Orbit AI reads &ldquo;{activeNoteTitle || "this note"}&rdquo; to answer questions or suggest edits.
              Nothing changes until you accept it.
            </p>
            <ul className="mt-6 divide-y divide-neutral-800/80 border-y border-neutral-800/80">
              {STARTERS.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => handleSend(s)}
                    disabled={!activeNoteId}
                    className={`group flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left text-[13px] text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white disabled:opacity-50 ${focusRing}`}
                  >
                    {s}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-600 transition-colors group-hover:text-neutral-300" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-5" aria-live="polite">
            {messages.map((m) => (
              <li key={m.id} className="select-text">
                {m.kind === "notice" ? (
                  <p className="text-center text-[11px] text-neutral-500">{m.content}</p>
                ) : m.role === "user" ? (
                  <div className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-neutral-800 px-3.5 py-2 text-[13px] leading-6 text-neutral-50">
                      {m.content}
                    </p>
                  </div>
                ) : (
                  <div className={`text-[13px] leading-6 text-neutral-300 [overflow-wrap:anywhere] ${isQuestion(m) ? "border-l-2 border-amber-400/60 pl-3" : ""}`}>
                    {(isQuestion(m) || m.kind === "proposal") && (
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                        {m.kind === "proposal" ? "Proposed change" : "Question"}
                      </p>
                    )}
                    <AiMarkdown text={m.content} />
                  </div>
                )}
              </li>
            ))}

            {stage && (
              <li>
                <Status label={stage === "waiting" ? "Thinking through your note…" : "Responding…"} />
              </li>
            )}

            {error && (
              <li className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5">
                <p role="alert" className="text-[12px] leading-5 text-neutral-300">{error.text}</p>
                {error.retryable && (
                  <button
                    onClick={retry}
                    className={`shrink-0 rounded-md border border-neutral-700 px-2.5 py-1 text-[12px] text-neutral-200 transition-colors hover:bg-neutral-800 ${focusRing}`}
                  >
                    Retry
                  </button>
                )}
              </li>
            )}

            {/* Proposed changes: shown for the open note only, nothing is applied until Accept */}
            {proposal && (
              <li>
                <section data-testid="proposal-review" aria-label="Proposed changes" className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900/60">
                  <div className="flex items-baseline justify-between gap-3 border-b border-neutral-800 px-3.5 py-2.5">
                    <h4 className="text-[13px] font-medium text-neutral-100">Review changes</h4>
                    <span className="text-[11px] text-neutral-500">Not applied yet</span>
                  </div>
                  <div className="flex max-h-64 select-text flex-col gap-3.5 overflow-y-auto px-3.5 py-3">
                    {proposal.preview.map((item, i) => (
                      <div key={i} className="text-[12px] leading-5">
                        <p className="mb-1.5 text-[11px] text-neutral-500">{item.label}</p>
                        {item.before && (
                          <pre className="mb-1.5 whitespace-pre-wrap break-words border-l-2 border-red-400/40 pl-2.5 font-sans text-neutral-500 line-through decoration-neutral-600">{item.before}</pre>
                        )}
                        {item.after && (
                          <pre className="whitespace-pre-wrap break-words border-l-2 border-emerald-400/50 pl-2.5 font-sans text-neutral-100">{item.after}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 border-t border-neutral-800 p-3">
                    <button
                      onClick={acceptProposal}
                      className={`h-9 flex-1 rounded-lg bg-neutral-100 text-[13px] font-medium text-neutral-950 transition-colors hover:bg-white ${focusRing}`}
                    >
                      Accept Changes
                    </button>
                    <button
                      onClick={rejectProposal}
                      className={`h-9 rounded-lg border border-neutral-700 px-4 text-[13px] text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white ${focusRing}`}
                    >
                      Reject
                    </button>
                  </div>
                </section>
              </li>
            )}
          </ol>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-neutral-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form
          onSubmit={handleFormSubmit}
          className="flex items-end gap-2 rounded-xl border border-neutral-800 bg-neutral-900 py-1.5 pl-3.5 pr-1.5 transition-colors focus-within:border-neutral-600"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={busy ? "Waiting for a reply…" : "Ask about this note…"}
            aria-label="Message Orbit AI"
            className="max-h-36 min-h-7 flex-1 resize-none bg-transparent py-1 text-[16px] leading-6 text-white outline-none placeholder:text-neutral-500 md:text-[13px]"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop response"
              title="Stop"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-200 transition-colors hover:bg-neutral-700 ${focusRing}`}
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !activeNoteId}
              aria-label="Send message"
              title="Send"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-950 transition-colors hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-500 ${focusRing}`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>
    </aside>
  );
}
