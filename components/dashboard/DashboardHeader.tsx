"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Pencil, Plus, Search } from "lucide-react";
import { NewNoteDialog, NewNotebookDialog } from "@/components/CreateDialogs";
import type { Notebook } from "@/lib/db/schema";

const NAME_KEY = "orbit:display-name";
export const SEARCH_EVENT = "orbit:focus-search";
const MAX_NAME = 40;

const field = "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-400";
const primary = "inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 transition-colors hover:bg-white disabled:opacity-50";
const secondary = "inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800";

// The display name is a per-browser preference (no accounts yet). It is read after mount so the server-rendered
// markup never depends on it; `undefined` means "not read yet", `null` means "no name saved".
function useDisplayName() {
  const [name, setName] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(NAME_KEY)?.trim().slice(0, MAX_NAME) || null;
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(saved);
  }, []);
  const save = (value: string) => {
    try {
      localStorage.setItem(NAME_KEY, value);
    } catch {}
    setName(value);
  };
  return [name, save] as const;
}

function NameDialog({ open, required, initial, onSubmit, onClose }: { open: boolean; required: boolean; initial: string; onSubmit: (name: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(initial);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = () => {
    const trimmed = value.trim().slice(0, MAX_NAME);
    if (!trimmed) return setError("Please enter a name.");
    onSubmit(trimmed);
  };
  return (
    // First-time onboarding can't be dismissed without a name; the later "change name" dialog can.
    <Dialog.Root open={open} onOpenChange={(o) => !o && !required && onClose()} disablePointerDismissal={required}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[#000000]/60" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-neutral-100 shadow-xl outline-none">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex flex-col gap-4"
          >
            <div className="text-center">
              <Dialog.Title className="text-lg font-semibold">{required ? "What should we call you?" : "Change your name"}</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-neutral-500">
                {required ? "We'll use it to greet you on your Dashboard. It stays in this browser." : "This is only saved in this browser."}
              </Dialog.Description>
            </div>
            <div>
              <input
                autoFocus
                value={value}
                maxLength={MAX_NAME}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError("");
                }}
                placeholder="Your name"
                aria-label="Your name"
                aria-invalid={!!error}
                aria-describedby={error ? "display-name-error" : undefined}
                className={field}
              />
              {error && (
                <p id="display-name-error" role="alert" className="mt-1.5 text-xs text-red-400">
                  {error}
                </p>
              )}
            </div>
            <div className="flex justify-center gap-2">
              {!required && (
                <button type="button" className={secondary} onClick={onClose}>
                  Cancel
                </button>
              )}
              <button type="submit" className={primary}>
                Continue
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Greeting + action bar. Search reuses the sidebar's search (it just asks the sidebar to focus it); note and
// notebook creation reuse the shared creation dialogs.
export function DashboardHeader({ userId, notebooks, accent, trailing }: { userId: string; notebooks: Notebook[]; accent: string; trailing?: React.ReactNode }) {
  const [name, saveName] = useDisplayName();
  const [changing, setChanging] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 min-h-[3.25rem]">
          {name !== undefined && (
            <div className="orbit-rise">
              <h2 className="flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight text-neutral-100">
                {accent && <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />}
                <span className="min-w-0 break-words">
                  Welcome back
                  {name ? (
                    <>
                      , <span data-display-name className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-300">{name}</span>!
                    </>
                  ) : (
                    "!"
                  )}
                </span>
                {name && (
                  <button type="button" onClick={() => setChanging(true)} aria-label="Edit name" title="Edit your name" className="shrink-0 rounded p-1 text-neutral-600 transition-colors hover:bg-neutral-900 hover:text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </h2>
              <p className="orbit-rise-late mt-0.5 text-sm text-neutral-500">{today}</p>
            </div>
          )}
        </div>
        {trailing}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Dashboard actions">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(SEARCH_EVENT))}
          className="flex min-w-40 flex-1 items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-left text-xs text-neutral-500 transition-colors hover:border-neutral-600 sm:max-w-xs"
          title="Search (Ctrl+Shift+F)"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Search notes &amp; notebooks</span>
        </button>
        <button type="button" onClick={() => setNoteOpen(true)} className={primary}>
          <Plus className="h-3.5 w-3.5" /> New Note
        </button>
        <button type="button" onClick={() => setNotebookOpen(true)} className={secondary}>
          <Plus className="h-3.5 w-3.5" /> Notebook
        </button>
      </div>

      <NameDialog
        open={name === null || changing}
        required={name === null}
        initial={name ?? ""}
        onSubmit={(n) => {
          saveName(n);
          setChanging(false);
        }}
        onClose={() => setChanging(false)}
      />
      <NewNoteDialog open={noteOpen} onOpenChange={setNoteOpen} userId={userId} notebooks={notebooks} />
      <NewNotebookDialog open={notebookOpen} onOpenChange={setNotebookOpen} userId={userId} />
    </header>
  );
}
