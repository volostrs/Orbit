"use client";

import { useState } from "react";
import { Sparkles, FileText, Languages, BarChart3, ArrowUp } from "lucide-react";

interface AgentDockProps {
  onSendMessage: (text: string) => void;
  activeNoteTitle?: string;
  disabled?: boolean;
}

export function AgentDock({ onSendMessage, activeNoteTitle, disabled }: AgentDockProps) {
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4">
      <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-800 rounded-2xl shadow-2xl p-2 flex flex-col gap-2 text-white">
        
        {/* Quick action chips when expanded or focused */}
        {isExpanded && (
          <div className="flex items-center gap-1.5 px-2 pt-1 pb-2 border-b border-neutral-800 overflow-x-auto text-xs">
            <button
              onClick={() => onSendMessage(`Summarize my active note: "${activeNoteTitle || "Untitled"}"`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800/80 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors shrink-0"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Summarize</span>
            </button>
            <button
              onClick={() => onSendMessage("Translate key points of this page.")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800/80 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors shrink-0"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <span>Translate</span>
            </button>
            <button
              onClick={() => onSendMessage("Analyze this note for key insights and improvements.")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800/80 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors shrink-0"
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              <span>Analyze</span>
            </button>
          </div>
        )}

        {/* Main input bar */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-2 py-1">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 ml-1" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder={`Ask Orbit AI about "${activeNoteTitle || "this note"}"...`}
            disabled={disabled}
            className="flex-1 bg-transparent text-xs text-white placeholder-neutral-500 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="p-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 disabled:opacity-40 transition-all flex items-center justify-center shadow-md"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}