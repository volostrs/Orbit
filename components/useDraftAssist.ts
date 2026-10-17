"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { draftPrefs, draftStats, IDLE_MS, isMeaningfullyNew } from "@/lib/ai/draftAssist";

/**
 * Watches the open note and, after IDLE_MS without a meaningful edit, quietly asks the server whether the
 * draft would benefit from help. Opening or switching to a note never starts the clock; only a real change
 * to its content does. Nothing here ever touches the document: it only produces `pending`, a notification
 * the user answers explicitly.
 */
export function useDraftAssist(noteId: string | undefined, initialContent: unknown, onAccept: () => void) {
  const [pending, setPending] = useState<{ reason?: string } | null>(null);

  const activeId = useRef(noteId);
  const latest = useRef<unknown>(null); // newest editor content for the active note
  const lastRevision = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const inflight = useRef<string | null>(null);
  const failed = useRef(new Set<string>()); // note+revision that errored: not retried until the content changes

  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;

  // Note opened or switched: stop the old note's idle timer, take the loaded content as the new baseline,
  // and restore this note's own unanswered notification (if any). An assessment already in flight for the
  // previous note is allowed to finish: its result is stored against that note's id and only ever shown
  // when that note is open.
  useEffect(() => {
    activeId.current = noteId;
    clearTimeout(timer.current);
    latest.current = null;
    lastRevision.current = draftStats(initialContent).revision;
    setPending(noteId ? draftPrefs.getPending(noteId) : null);
    // Only a different note resets this; autosave re-renders pass new content for the same note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  // Leaving the editor entirely: nothing should outlive it.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      abort.current?.abort();
    },
    []
  );

  const assess = useCallback(async (id: string) => {
    if (activeId.current !== id || latest.current == null) return;
    if (draftPrefs.isDisabled() || draftPrefs.getPending(id)) return;
    const stats = draftStats(latest.current);
    const key = `${id}:${stats.revision}`;
    if (!stats.eligible || failed.current.has(key) || inflight.current === key) return;
    if (!isMeaningfullyNew(draftPrefs.getLast(id), stats)) return;

    inflight.current = key;
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/assess-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId: id }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error("assessment failed");
      const data = (await res.json()) as { suggest?: boolean; reason?: string };
      // Remember this content was assessed so the same revision is never assessed again.
      draftPrefs.setLast(id, { revision: stats.revision, words: stats.words });
      if (data.suggest === true) {
        draftPrefs.setPending(id, data.reason);
        // The note may have changed while we waited; the notification belongs to the note it was made for.
        if (activeId.current === id) setPending({ reason: data.reason });
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") failed.current.add(key);
    } finally {
      if (inflight.current === key) inflight.current = null;
    }
  }, []);

  /** Call on every editor change for `id`. Only a real content change (re)starts the inactivity timer. */
  const onContentEdited = useCallback(
    (id: string, content: unknown) => {
      if (id !== activeId.current || draftPrefs.isDisabled()) return;
      const revision = draftStats(content).revision;
      if (revision === lastRevision.current) return; // selection/format-only change: not an edit
      lastRevision.current = revision;
      latest.current = content;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void assess(id), IDLE_MS);
    },
    [assess]
  );

  const accept = useCallback(() => {
    if (activeId.current) draftPrefs.clearPending(activeId.current);
    setPending(null);
    onAcceptRef.current(); // opens the AI sidebar flow; the document itself is not touched
  }, []);

  const decline = useCallback((dontShowAgain: boolean) => {
    if (activeId.current) draftPrefs.clearPending(activeId.current);
    setPending(null);
    // Unchecked: this revision stays recorded as assessed, so only a later meaningful revision re-qualifies.
    if (dontShowAgain) draftPrefs.setDisabled();
  }, []);

  return { pending, onContentEdited, accept, decline };
}
