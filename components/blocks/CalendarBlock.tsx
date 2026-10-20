"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { createReactBlockSpec } from "@blocknote/react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { BlockShell, frameStyle, StyleMenu } from "./blockStyle";

export interface CalendarEventData {
  id: string;
  date: string; // local "YYYY-MM-DD"
  title: string;
  description?: string;
}

interface CalendarData {
  events: CalendarEventData[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ACCENT = "#10b981";

export const DEFAULT_CALENDAR_DATA = () => JSON.stringify({ events: [] } satisfies CalendarData);

// Drops malformed events instead of crashing, so a hand-edited or AI-written block still renders.
export function parseCalendarData(raw: string): CalendarData {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.events)) {
      const events = parsed.events.filter(
        (e: any) => e && typeof e.id === "string" && typeof e.title === "string" && typeof e.date === "string" && DATE_RE.test(e.date)
      );
      return { events };
    }
  } catch {}
  return { events: [] };
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayKey = () => {
  const n = new Date();
  return keyOf(n.getFullYear(), n.getMonth(), n.getDate());
};
const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return { y, m: m - 1, d };
};
const longDate = (k: string) => {
  const { y, m, d } = parseKey(k);
  return new Date(y, m, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
};
// A real calendar date (rejects e.g. 2025-02-30).
const isRealDate = (k: string) => {
  if (!DATE_RE.test(k)) return false;
  const { y, m, d } = parseKey(k);
  const dt = new Date(y, m, d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
};

const iconButton = "rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400";
const field = "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-400";

function EventDialog({
  event,
  date,
  onClose,
  onSave,
  onDelete,
}: {
  event: CalendarEventData | null;
  date: string;
  onClose: () => void;
  onSave: (e: CalendarEventData) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [day, setDay] = useState(event?.date ?? date);
  const [description, setDescription] = useState(event?.description ?? "");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    if (!title.trim()) return setError("Enter a title.");
    if (!isRealDate(day)) return setError("Choose a valid date.");
    onSave({ id: event?.id ?? crypto.randomUUID(), date: day, title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) });
    onClose();
  };

  // Non-modal on purpose: a modal dialog marks the page inert, which ProseMirror sees as a DOM mutation
  // inside the block and answers by remounting it, losing the block's state.
  return (
    <Dialog.Root open modal={false} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[#000000]/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-neutral-100 shadow-xl outline-none">
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="flex flex-col gap-3"
          >
            <Dialog.Title className="text-sm font-semibold">{event ? "Edit event" : "New event"}</Dialog.Title>
            <Dialog.Description className="sr-only">Title, date and an optional short note for the event.</Dialog.Description>
            <label className="space-y-1 text-xs text-neutral-400">
              Title
              <input
                autoFocus
                className={field}
                value={title}
                maxLength={120}
                placeholder="e.g. Chemistry quiz"
                aria-label="Event title"
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError("");
                }}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              Date
              <input
                type="date"
                className={field}
                value={day}
                aria-label="Event date"
                onChange={(e) => {
                  setDay(e.target.value);
                  setError("");
                }}
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              Note (optional)
              <textarea
                className={`${field} min-h-20 resize-y`}
                value={description}
                maxLength={1000}
                aria-label="Event note"
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-xs text-red-400">
                {error}
              </p>
            )}
            <div className="mt-1 flex items-center gap-2">
              {event &&
                (confirmDelete ? (
                  <span className="flex items-center gap-1 text-xs">
                    <span className="text-neutral-400">Delete this event?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(event.id);
                        onClose();
                      }}
                      className="rounded-md px-2 py-1.5 font-medium text-red-400 hover:bg-neutral-800"
                    >
                      Yes, delete
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1.5 text-neutral-300 hover:bg-neutral-800">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-md px-2 py-1.5 text-xs text-red-400 hover:bg-neutral-800">
                    Delete
                  </button>
                ))}
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={onClose} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800">
                  Cancel
                </button>
                <button type="submit" className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-white">
                  Save
                </button>
              </div>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CalendarBlock({
  data,
  editable,
  onChange,
  color,
  icon,
  iconColor,
  onStyleChange,
}: {
  data: CalendarData;
  editable: boolean;
  onChange: (d: CalendarData) => void;
  color: string;
  icon: string;
  iconColor: string;
  onStyleChange: (patch: { color?: string; icon?: string; iconColor?: string }) => void;
}) {
  const now = new Date();
  // Month navigation and selection are view state only; they are never written to the block.
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayKey());
  const [dialog, setDialog] = useState<{ event: CalendarEventData | null; date: string } | null>(null);

  const today = todayKey();
  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const heading = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const byDate = new Map<string, CalendarEventData[]>();
  for (const e of data.events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const dayEvents = byDate.get(selected) ?? [];
  const monthHasEvents = data.events.some((e) => e.date.startsWith(`${view.y}-${pad(view.m + 1)}-`));

  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    const n = new Date();
    setView({ y: n.getFullYear(), m: n.getMonth() });
    setSelected(todayKey());
  };

  const save = (ev: CalendarEventData) => {
    const exists = data.events.some((e) => e.id === ev.id);
    onChange({ events: exists ? data.events.map((e) => (e.id === ev.id ? ev : e)) : [...data.events, ev] });
    const { y, m } = parseKey(ev.date);
    setView({ y, m });
    setSelected(ev.date);
  };
  const remove = (id: string) => onChange({ events: data.events.filter((e) => e.id !== id) });

  return (
    <div className="my-2 w-full rounded-lg border border-neutral-800 bg-neutral-900/40 text-neutral-200" style={frameStyle(color)}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-neutral-800 px-2 py-1.5 text-xs">
        <StyleMenu color={color} icon={icon} iconColor={iconColor} editable={editable} onChange={onStyleChange} />
        <button type="button" className={iconButton} onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-28 text-center font-medium" aria-live="polite" aria-label="Calendar month">
          {heading}
        </span>
        <button type="button" className={iconButton} onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" className="rounded border border-neutral-700 px-2 py-0.5 text-neutral-300 hover:bg-neutral-800" onClick={goToday}>
          Today
        </button>
        {editable && (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded border border-neutral-700 px-2 py-0.5 text-neutral-300 hover:bg-neutral-800"
            onClick={() => setDialog({ event: null, date: selected })}
          >
            <Plus className="h-3.5 w-3.5" /> Add event
          </button>
        )}
      </div>

      <div className="p-2">
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-neutral-500">
          {WEEKDAYS.map((w) => (
            <div key={w} className="truncate">
              {w}
            </div>
          ))}
        </div>
        <div role="grid" aria-label={heading} className="mt-0.5 grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (d === null) return <div key={`b${i}`} role="gridcell" />;
            const k = keyOf(view.y, view.m, d);
            const count = byDate.get(k)?.length ?? 0;
            const isSel = k === selected;
            const isToday = k === today;
            return (
              <button
                key={k}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${longDate(k)}${count ? `, ${count} event${count === 1 ? "" : "s"}` : ""}${isToday ? ", today" : ""}`}
                data-date={k}
                onClick={() => setSelected(k)}
                className={`flex h-9 min-w-0 flex-col items-center justify-center rounded text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 ${
                  isSel ? "bg-neutral-100 font-semibold text-neutral-950" : "text-neutral-200 hover:bg-neutral-800"
                } ${isToday ? "font-semibold" : ""}`}
                style={isToday ? { ...(isSel ? {} : { color: ACCENT }), boxShadow: `inset 0 0 0 ${isSel ? 2 : 1}px ${ACCENT}` } : undefined}
              >
                <span>{d}</span>
                <span className="mt-0.5 flex h-1 gap-0.5" aria-hidden>
                  {Array.from({ length: Math.min(count, 3) }, (_, j) => (
                    <span key={j} className="h-1 w-1 rounded-full" style={{ backgroundColor: ACCENT }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section aria-label="Selected date" className="border-t border-neutral-800 px-2 py-2 text-xs">
        <div className="mb-1.5 font-medium text-neutral-300">{longDate(selected)}</div>
        {dayEvents.length === 0 ? (
          <p className="text-neutral-500">
            {data.events.length === 0 && !monthHasEvents
              ? editable
                ? "No events yet. Select a date and choose “Add event” to create one."
                : "No events yet."
              : "No events on this date."}
          </p>
        ) : (
          <ul className="space-y-1">
            {dayEvents.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setDialog({ event: e, date: e.date })}
                  className="block w-full rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-1.5 text-left hover:bg-neutral-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
                  aria-label={`Edit event ${e.title}`}
                >
                  <span className="block break-words text-sm text-neutral-100">{e.title}</span>
                  {e.description && <span className="mt-0.5 block whitespace-pre-wrap break-words text-neutral-400">{e.description}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog && (
        <EventDialog key={dialog.event?.id ?? "new"} event={dialog.event} date={dialog.date} onClose={() => setDialog(null)} onSave={save} onDelete={remove} />
      )}
    </div>
  );
}

export const calendarBlock = createReactBlockSpec(
  {
    type: "calendar",
    propSchema: {
      // JSON-serialised CalendarData; each block owns its own events, separate from the full-page Calendar.
      data: { default: "" },
      color: { default: "" },
      icon: { default: "" },
      iconColor: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <BlockShell>
        <CalendarBlock
          data={parseCalendarData(block.props.data)}
          editable={editor.isEditable}
          color={block.props.color}
          icon={block.props.icon}
          iconColor={block.props.iconColor}
          onStyleChange={(patch) => editor.updateBlock(block, { props: patch })}
          onChange={(next) => editor.updateBlock(block, { props: { data: JSON.stringify(next) } })}
        />
      </BlockShell>
    ),
  }
);
