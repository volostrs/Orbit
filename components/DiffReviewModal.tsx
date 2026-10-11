"use client";

import { Check, X, Sparkles } from "lucide-react";

interface DiffReviewModalProps {
  originalContent: string;
  proposedContent: string;
  onAccept: (newContent: string) => void;
  onReject: () => void;
}

export function DiffReviewModal({
  originalContent,
  proposedContent,
  onAccept,
  onReject,
}: DiffReviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-white">
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Review AI Changes</h3>
          </div>
          <button onClick={onReject} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto font-mono text-xs leading-relaxed">
          <div>
            <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-red-400 mb-1.5 block">
              Original Document
            </span>
            <div className="bg-red-950/30 border border-red-900/50 text-red-200 p-3 rounded-xl whitespace-pre-wrap">
              {originalContent || "(Empty)"}
            </div>
          </div>

          <div>
            <span className="text-[10px] font-sans font-medium uppercase tracking-wider text-emerald-400 mb-1.5 block">
              Proposed Changes
            </span>
            <div className="bg-emerald-950/30 border border-emerald-900/50 text-emerald-200 p-3 rounded-xl whitespace-pre-wrap">
              {proposedContent}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-end gap-2">
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Undo / Reject
          </button>
          <button
            onClick={() => onAccept(proposedContent)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-colors shadow-lg"
          >
            <Check className="w-3.5 h-3.5" /> Keep / Apply
          </button>
        </div>
      </div>
    </div>
  );
}