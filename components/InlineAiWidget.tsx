"use client";

import { useState } from "react";
import { Sparkles, Check, X, Loader2 } from "lucide-react";

interface InlineAiWidgetProps {
  selectedText: string;
  onKeep: (newText: string) => void;
  onClose: () => void;
}

export function InlineAiWidget({ selectedText, onKeep, onClose }: InlineAiWidgetProps) {
  const [prompt, setPrompt] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, selectedText }),
      });
      const data = await res.json();
      if (data.suggestion) {
        setSuggestion(data.suggestion);
        setHasGenerated(true);
      }
    } catch (err) {
      console.error("AI Edit error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute z-50 w-96 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-3 text-white text-xs flex flex-col gap-3">
      {/* Header / Prompt Input */}
      {!hasGenerated ? (
        <form onSubmit={handleGenerate} className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask AI to edit, format, or rewrite..."
            autoFocus
            disabled={loading}
            className="flex-1 bg-transparent outline-none placeholder-neutral-500 text-white"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </form>
      ) : (
        /* Diff / Result Preview with Keep / Undo */
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <span className="font-medium text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Suggestion Preview
            </span>
            <button onClick={onClose} className="text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto font-mono text-[11px]">
            <div className="bg-red-950/40 border border-red-900/50 text-red-300 p-2 rounded line-through opacity-75">
              {selectedText}
            </div>
            <div className="bg-emerald-950/40 border border-emerald-900/50 text-emerald-200 p-2 rounded">
              {suggestion}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => onKeep(suggestion)}
              className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Keep
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}