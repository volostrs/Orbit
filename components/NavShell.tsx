"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

// The left navigation. From `md` up it is the normal fixed-width column; on narrow screens it becomes a
// drawer opened by a menu button, so the note keeps the full width. Choosing a note closes the drawer.
export function NavShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-100 md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-[#000000]/50 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        aria-label="Notes"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`flex h-full w-64 shrink-0 flex-col justify-between border-r border-neutral-800 bg-black p-4 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-xl max-md:transition-transform ${
          open ? "" : "max-md:-translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}
