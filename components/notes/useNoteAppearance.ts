"use client";

import { useCallback, useEffect, useState } from "react";

export interface NoteAppearance {
  /** Hex accent for the note's header wash, or "" for none. */
  accent: string;
  width: "standard" | "wide";
}

export const DEFAULT_APPEARANCE: NoteAppearance = { accent: "", width: "standard" };

const key = (noteId: string) => `orbit:note-appearance:${noteId}`;

function read(noteId: string): NoteAppearance {
  try {
    const raw = JSON.parse(localStorage.getItem(key(noteId)) ?? "null");
    return {
      accent: typeof raw?.accent === "string" && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent : "",
      width: raw?.width === "wide" ? "wide" : "standard",
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/**
 * Per-note appearance (page width and an optional accent). The notes table has no metadata column, so
 * this is kept in this browser's localStorage, keyed by note id; it never touches the note's content.
 * Storage can be unavailable (private mode), in which case the defaults apply and changes last the session.
 */
export function useNoteAppearance(noteId: string | undefined) {
  const [state, setState] = useState<{ id?: string; value: NoteAppearance }>({ value: DEFAULT_APPEARANCE });

  useEffect(() => {
    setState({ id: noteId, value: noteId ? read(noteId) : DEFAULT_APPEARANCE });
  }, [noteId]);

  // Until this note's saved value has loaded, show defaults rather than the previous note's look.
  const appearance = state.id === noteId ? state.value : DEFAULT_APPEARANCE;

  const update = useCallback(
    (patch: Partial<NoteAppearance>) => {
      if (!noteId) return;
      const next = { ...appearance, ...patch };
      setState({ id: noteId, value: next });
      try {
        localStorage.setItem(key(noteId), JSON.stringify(next));
      } catch {
        // Not persisted; the change still applies for this session.
      }
    },
    [noteId, appearance]
  );

  return { appearance, update };
}
