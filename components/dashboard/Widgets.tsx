"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import type { CalendarEvent, Note, Notebook } from "@/lib/db/schema";
import type { DashHabit } from "@/lib/notes/habits";
import { COUNT_CHOICES, type LinkItem, newId, safeUrl, type Widget } from "@/lib/dashboard/config";
import { DashImage } from "./DashImage";
import { NotesGrid } from "./NotesGrid";
import { CalendarWidget } from "./CalendarWidget";
import { field, ImagePicker } from "./ImagePicker";

export type NoteSummary = Omit<Note, "content">;
// Dashboard notes carry a short plain-text preview computed on the server; the full document never reaches the client.
export type DashNote = NoteSummary & { preview: string };
export interface DashData {
  notes: DashNote[];
  notebooks: Notebook[];
  userId: string;
  events: CalendarEvent[];
  habits: DashHabit[];
}

const when = (d: Date | string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const muted = "text-sm text-neutral-500";

function NoteLink({ n, date }: { n: NoteSummary; date?: Date | string }) {
  return (
    <li>
      <Link href={`/?noteId=${n.id}`} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100">
        <DynamicIcon name={n.icon || "FileText"} color={n.iconColor || "#10b981"} className="h-4 w-4 shrink-0" />
        <span className="truncate">{n.title || "Untitled"}</span>
        {date && <span className="ml-auto shrink-0 pl-2 text-[11px] text-neutral-500">{when(date)}</span>}
      </Link>
    </li>
  );
}

function NoteList({ notes, empty, date }: { notes: DashNote[]; empty: string; date?: "updatedAt" | "createdAt" }) {
  if (notes.length === 0) return <p className={muted}>{empty}</p>;
  return <ul className="-mx-2">{notes.map((n) => <NoteLink key={n.id} n={n} date={date ? n[date] : undefined} />)}</ul>;
}

export const widgetTitle = (w: Widget): string => {
  switch (w.type) {
    case "notes": return "";
    case "calendar": return "";
    case "overview": return "Notes overview";
    case "edited": return "Recently edited";
    case "recent": return "Recent notes";
    case "favorites": return "Favorites";
    case "pinned": return "Pinned notes";
    case "notebooks": return "Notebooks";
    case "text": return w.title;
    case "links": return w.title;
    default: return "";
  }
};

export function WidgetBody({ w, data, accent = "", onPatch }: { w: Widget; data: DashData; accent?: string; onPatch?: (patch: Partial<Widget>) => void }) {
  const { notes, notebooks } = data;
  switch (w.type) {
    case "calendar":
      return <CalendarWidget w={w} data={data} accent={accent} onPatch={(p) => onPatch?.(p)} />;
    case "notes":
      return <NotesGrid data={data} />;
    case "overview": {
      const stats = [
        ["Notes", notes.length],
        ["Notebooks", notebooks.length],
        ["Favorites", notes.filter((n) => n.isFavorite).length],
        ["Unfiled", notes.filter((n) => !n.notebookId).length],
      ] as const;
      return (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-neutral-900/60 px-3 py-2">
              <dd className="text-xl font-semibold text-neutral-100">{value}</dd>
              <dt className="text-xs text-neutral-500">{label}</dt>
            </div>
          ))}
        </dl>
      );
    }
    case "edited":
      return <NoteList notes={[...notes].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, w.count)} empty="No notes yet. Create one from the sidebar." date="updatedAt" />;
    case "recent":
      return <NoteList notes={[...notes].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, w.count)} empty="No notes yet. Create one from the sidebar." date="createdAt" />;
    case "favorites":
      return <NoteList notes={notes.filter((n) => n.isFavorite).slice(0, w.count)} empty="No favorites yet. Star a note from the sidebar." />;
    case "pinned":
      return <NoteList notes={w.noteIds.map((id) => notes.find((n) => n.id === id)).filter((n): n is DashNote => !!n)} empty="Nothing pinned. Use Customize to choose notes." />;
    case "notebooks": {
      if (notebooks.length === 0) return <p className={muted}>No notebooks yet. Create one from the sidebar.</p>;
      return (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks.map((nb) => {
            const inside = notes.filter((n) => n.notebookId === nb.id).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
            const inner = (
              <>
                <span className="truncate text-sm font-medium text-neutral-200">{nb.title}</span>
                <span className="text-xs text-neutral-500">{inside.length} note{inside.length === 1 ? "" : "s"}</span>
              </>
            );
            return (
              <li key={nb.id}>
                {inside[0] ? (
                  <Link href={`/?noteId=${inside[0].id}`} className="flex flex-col rounded-lg bg-neutral-900/60 px-3 py-2 hover:bg-neutral-800/70">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex flex-col rounded-lg bg-neutral-900/40 px-3 py-2">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      );
    }
    case "welcome":
      return null; // drawn by the card itself
    case "text":
      return w.body.trim() ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-300">{w.body}</p> : <p className={muted}>Empty. Use Customize to add text.</p>;
    case "image":
      return w.image.source ? (
        <figure>
          <DashImage image={w.image} className="aspect-video w-full rounded-lg" alt={w.image.caption} />
          {w.image.caption && <figcaption className="mt-1.5 text-xs text-neutral-500">{w.image.caption}</figcaption>}
        </figure>
      ) : (
        <p className={muted}>No image yet. Use Customize to add one.</p>
      );
    case "links":
      return w.links.length === 0 ? (
        <p className={muted}>No links yet. Use Customize to add some.</p>
      ) : (
        <ul className="-mx-2">
          {w.links.map((l) => (
            <li key={l.id}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100">
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                <span className="truncate">{l.label || l.url}</span>
              </a>
            </li>
          ))}
        </ul>
      );
    case "heading":
      return null;
  }
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1 text-xs text-neutral-400">
    {label}
    {children}
  </label>
);

// Per-widget settings, shown inline under the widget while customizing. Returns null for widgets with nothing to set.
export function hasSettings(w: Widget) {
  return !["overview", "notebooks", "notes"].includes(w.type);
}

export function WidgetSettings({ w, data, update }: { w: Widget; data: DashData; update: (patch: Partial<Widget>) => void }) {
  const set = (patch: Record<string, unknown>) => update(patch as Partial<Widget>);
  switch (w.type) {
    case "edited":
    case "recent":
    case "favorites":
      return (
        <Row label="Notes to show">
          <select className={field} value={w.count} onChange={(e) => set({ count: Number(e.target.value) })}>
            {COUNT_CHOICES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Row>
      );
    case "calendar":
      return (
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={w.showHabits} disabled={w.size === "compact"} onChange={(e) => set({ showHabits: e.target.checked })} />
          Show habits panel (Medium and Wide sizes)
        </label>
      );
    case "pinned":
      return (
        <fieldset className="space-y-1">
          <legend className="text-xs text-neutral-400">Choose notes to pin (pinning here doesn&apos;t change the notes)</legend>
          <div className="max-h-44 space-y-0.5 overflow-y-auto">
            {data.notes.map((n) => (
              <label key={n.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-neutral-300 hover:bg-neutral-800/60">
                <input
                  type="checkbox"
                  checked={w.noteIds.includes(n.id)}
                  onChange={(e) => set({ noteIds: e.target.checked ? [...w.noteIds, n.id] : w.noteIds.filter((x) => x !== n.id) })}
                />
                <span className="truncate">{n.title || "Untitled"}</span>
              </label>
            ))}
            {data.notes.length === 0 && <p className={muted}>No notes yet.</p>}
          </div>
        </fieldset>
      );
    case "welcome":
      return (
        <div className="space-y-2.5">
          <Row label="Title"><input className={field} maxLength={120} value={w.title} onChange={(e) => set({ title: e.target.value })} /></Row>
          <Row label="Message"><input className={field} maxLength={300} value={w.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></Row>
          <ImagePicker image={w.image} caption={false} onChange={(image) => set({ image })} />
        </div>
      );
    case "text":
      return (
        <div className="space-y-2.5">
          <Row label="Heading (optional)"><input className={field} maxLength={120} value={w.title} onChange={(e) => set({ title: e.target.value })} /></Row>
          <Row label="Text"><textarea className={`${field} min-h-24 resize-y`} maxLength={4000} value={w.body} onChange={(e) => set({ body: e.target.value })} /></Row>
        </div>
      );
    case "image":
      return <ImagePicker image={w.image} onChange={(image) => set({ image })} />;
    case "links": {
      const setLink = (id: string, patch: Partial<LinkItem>) => set({ links: w.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
      return (
        <div className="space-y-2">
          <Row label="Heading"><input className={field} maxLength={120} value={w.title} onChange={(e) => set({ title: e.target.value })} /></Row>
          {w.links.map((l, i) => (
            <div key={l.id} className="flex items-center gap-1.5">
              <input className={field} aria-label={`Link ${i + 1} label`} placeholder="Label" maxLength={80} value={l.label} onChange={(e) => setLink(l.id, { label: e.target.value })} />
              <input
                className={field}
                aria-label={`Link ${i + 1} address`}
                placeholder="example.com"
                defaultValue={l.url}
                onBlur={(e) => {
                  const safe = safeUrl(e.target.value);
                  if (safe) setLink(l.id, { url: safe });
                  else e.target.value = l.url;
                }}
              />
              <button type="button" aria-label={`Remove link ${i + 1}`} className="text-neutral-500 hover:text-red-400" onClick={() => set({ links: w.links.filter((x) => x.id !== l.id) })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <LinkAdder onAdd={(link) => set({ links: [...w.links, link] })} />
        </div>
      );
    }
    case "heading":
      return <Row label="Heading text"><input className={field} maxLength={120} value={w.text} onChange={(e) => set({ text: e.target.value })} /></Row>;
    default:
      return null;
  }
}

function LinkAdder({ onAdd }: { onAdd: (l: LinkItem) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const add = () => {
    const safe = safeUrl(url);
    if (!safe) return setErr("Enter a valid web address (http or https).");
    onAdd({ id: newId(), label: label.trim(), url: safe });
    setLabel("");
    setUrl("");
    setErr("");
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <input className={field} aria-label="New link label" placeholder="Label" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className={field} aria-label="New link address" placeholder="Address" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        <button type="button" aria-label="Add link" className="text-neutral-300 hover:text-neutral-50" onClick={add}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
