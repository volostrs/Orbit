"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Sparkles, 
  PanelRightClose, 
  FileText, 
  Languages, 
  BarChart3, 
  CheckSquare, 
  ArrowUp,
  Loader2,
  Check,
  X
} from "lucide-react";
import Link from "next/link";
import type { BlockNoteEditor } from "@blocknote/core";
import { applyProposal } from "@/lib/ai/applyProposal";
import { PROPOSAL_MARKER, type Proposal } from "@/lib/ai/proposal";

interface Message {
  role: "user" | "assistant";
  content: string;
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
}

export function AiSidebar({
  isOpen,
  onCloseHref,
  activeNoteTitle,
  activeNoteId,
  getEditor,
  autoPrompt
}: AiSidebarProps) {
  const [width, setWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [chatSessions, setChatSessions] = useState<Record<string, Message[]>>({});
  // Pending AI proposals by the note id they were made for. Only the open note's proposal is shown,
  // and it can only be applied to that note's editor, so switching notes can never misdirect it.
  const [proposals, setProposals] = useState<Record<string, Proposal | undefined>>({});
  const proposal = proposals[activeNoteId];

  // Send an auto prompt exactly once, only for the note it was made for, once the sidebar is open.
  const sendRef = useRef<(text: string) => void>(() => {});
  const handledPrompt = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !autoPrompt || autoPrompt.noteId !== activeNoteId || handledPrompt.current === autoPrompt.id) return;
    handledPrompt.current = autoPrompt.id;
    sendRef.current(autoPrompt.text);
  }, [isOpen, autoPrompt, activeNoteId]);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = chatSessions[activeNoteId] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
      if (newWidth >= 280 && newWidth <= 650) {
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

  if (!isOpen) return null;

  sendRef.current = (text: string) => void handleSend(text);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;
    setInput("");
    setLoading(true);

    const userMessage: Message = { role: "user", content: textToSend };
    const updatedMessages = [...messages, userMessage];
    
    setChatSessions((prev) => ({
      ...prev,
      [activeNoteId]: [...updatedMessages, { role: "assistant", content: "" }],
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: updatedMessages,
          // The server loads and translates this note itself; raw editor JSON is not sent.
          noteId: activeNoteId,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        raw += decoder.decode(value, { stream: true });
        // Anything after the marker is a machine-readable proposal, not chat text.
        assistantContent = raw.split(PROPOSAL_MARKER)[0];

        setChatSessions((prev) => {
          const currentList = prev[activeNoteId] || [];
          const newList = [...currentList];
          if (newList.length > 0) {
            newList[newList.length - 1] = { role: "assistant", content: assistantContent };
          }
          return {
            ...prev,
            [activeNoteId]: newList,
          };
        });
      }

      // A proposal is only stored (never applied) and only if it was made for this note.
      const markerAt = raw.indexOf(PROPOSAL_MARKER);
      if (markerAt !== -1) {
        try {
          const p = JSON.parse(raw.slice(markerAt + PROPOSAL_MARKER.length)) as Proposal;
          if (p && p.noteId === activeNoteId && Array.isArray(p.ops) && Array.isArray(p.preview)) {
            setProposals((prev) => ({ ...prev, [activeNoteId]: p }));
          }
        } catch {
          // Malformed proposal: ignore it; nothing is changed.
        }
      }
    } catch (error) {
      console.error("Stream reading error:", error);
    } finally {
      setLoading(false);
    }
  };

  const addAssistantNote = (noteId: string, content: string) =>
    setChatSessions((prev) => ({ ...prev, [noteId]: [...(prev[noteId] || []), { role: "assistant", content }] }));

  const rejectProposal = () => {
    setProposals((prev) => ({ ...prev, [activeNoteId]: undefined }));
    addAssistantNote(activeNoteId, "Proposal rejected. Your note was not changed.");
  };

  const acceptProposal = () => {
    if (!proposal) return;
    const editor = getEditor(activeNoteId);
    const result = editor
      ? applyProposal(editor, proposal, activeNoteId)
      : ({ ok: false, error: "The note editor isn't ready. Your note was not changed." } as const);
    setProposals((prev) => ({ ...prev, [activeNoteId]: undefined }));
    addAssistantNote(activeNoteId, result.ok ? "Changes applied to your note." : result.error);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <aside
      ref={sidebarRef}
      style={{ width: `${width}px` }}
      className="relative h-full bg-neutral-950 border-l border-neutral-800 flex flex-col shrink-0 select-none z-40 transition-all duration-75"
    >
      {/* Resizer Handle */}
      <div
        onMouseDown={startResizing}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-neutral-600/50 transition-colors group z-50 flex items-center justify-center"
        title="Drag to resize"
      >
        <div className="h-8 w-0.5 bg-neutral-700 rounded-full group-hover:bg-neutral-400" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Orbit AI Assistant</span>
        </div>
        <Link
          href={onCloseHref}
          className="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-900 transition-colors"
          title="Close AI Sidebar"
        >
          <PanelRightClose className="w-4 h-4" />
        </Link>
      </div>

      {/* Chat Body & Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center my-auto py-12 text-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                How can I help you today?
              </h3>
              <p className="text-xs text-neutral-500 max-w-[240px]">
                Ask questions about &quot;{activeNoteTitle || "this note"}&quot; or let AI organize your workspace.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col gap-1.5 w-full mt-4">
              <button
                onClick={() => handleSend(`Summarize my active note: "${activeNoteTitle || "Untitled"}"`)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-300 hover:text-white bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 rounded-lg transition-colors text-left"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Summarize this page</span>
              </button>
              <button
                onClick={() => handleSend("Translate key points of this page.")}
                className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-300 hover:text-white bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 rounded-lg transition-colors text-left"
              >
                <Languages className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Translate this page</span>
              </button>
              <button
                onClick={() => handleSend("Analyze this note for key insights and improvements.")}
                className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-300 hover:text-white bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 rounded-lg transition-colors text-left"
              >
                <BarChart3 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Analyze for insights</span>
              </button>
              <button
                onClick={() => handleSend("Create a structured task tracker based on this page.")}
                className="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-300 hover:text-white bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 rounded-lg transition-colors text-left"
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Create a task tracker</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col gap-1 text-xs leading-relaxed ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`px-3 py-2.5 rounded-xl max-w-[85%] ${
                    m.role === "user"
                      ? "bg-neutral-800 text-white rounded-br-xs"
                      : "bg-neutral-900 text-neutral-200 border border-neutral-800 rounded-bl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Orbit is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Proposed changes: shown for the open note only, nothing is applied until Accept */}
      {proposal && (
        <div data-testid="proposal-review" className="shrink-0 border-t border-amber-500/30 bg-neutral-950 px-3 pt-3 pb-2 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Proposed changes — not applied yet</span>
          </div>
          <div className="max-h-56 overflow-y-auto flex flex-col gap-2 select-text">
            {proposal.preview.map((item, i) => (
              <div key={i} className="text-[11px] leading-relaxed">
                <div className="text-neutral-400 mb-1">{item.label}</div>
                {item.before && (
                  <pre className="whitespace-pre-wrap font-sans bg-red-950/30 border border-red-900/40 text-red-200 line-through decoration-red-400/50 rounded-md px-2 py-1 mb-1 max-h-24 overflow-y-auto">{item.before}</pre>
                )}
                {item.after && (
                  <pre className="whitespace-pre-wrap font-sans bg-emerald-950/30 border border-emerald-900/40 text-emerald-200 rounded-md px-2 py-1 max-h-24 overflow-y-auto">{item.after}</pre>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={acceptProposal}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Accept Changes
            </button>
            <button
              onClick={rejectProposal}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        </div>
      )}

      {/* Input Footer */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-950 shrink-0">
        <form
          onSubmit={handleFormSubmit}
          className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 flex items-center gap-2 focus-within:border-neutral-700 transition-colors"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Orbit AI anything..."
            disabled={loading}
            className="flex-1 bg-transparent text-xs text-white placeholder-neutral-500 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white disabled:opacity-40 transition-all flex items-center justify-center shadow-md"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
}