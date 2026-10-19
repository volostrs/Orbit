"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "@/lib/actions/calendar";
import type { CalendarEvent } from "@/lib/db/schema";
import type { DashHabit } from "@/lib/notes/habits";
import type { Widget } from "@/lib/dashboard/config";
import type { DashData } from "./Widgets";

type CalWidget = Extract<Widget, { type: "calendar" }>;

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayIndex = (d: Date) => (d.getDay() + 6) % 7; // Monday = 0

// 42 cells (6 weeks) starting on the Monday on or before the 1st, so the grid never changes height between months.
function monthCells(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - dayIndex(first));
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function useToday() {
  const [today, setToday] = useState(() => key(new Date()));
  useEffect(() => {
    const id = setInterval(() => setToday((t) => (t === key(new Date()) ? t : key(new Date()))), 30_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const btn = "inline-flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-200 transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 disabled:opacity-40";
const iconBtn = "rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400";
const field = "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-400";

export function CalendarWidget({ w, data, accent, onPatch }: { w: CalWidget; data: DashData; accent: string; onPatch: (patch: Partial<CalWidget>) => void }) {
  const today = useToday();
  const root = useRef<HTMLDivElement>(null);
  const width = useWidth(root);
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [dialog, setDialog] = useState<{ event: CalendarEvent | null; date: string } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const dot = accent || "#10b981";
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of data.events) map.set(e.eventDate, [...(map.get(e.eventDate) ?? []), e]);
    return map;
  }, [data.events]);

  const cells = monthCells(cursor.y, cursor.m);
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const shift = (delta: number) => setCursor(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const goToday = () => {
    const t = new Date();
    setCursor({ y: t.getFullYear(), m: t.getMonth() });
    setSelected(key(t));
  };

  // Layout is driven by the widget's own width (so it follows the Small/Medium/Wide choice and the screen size).
  const side = width >= 720; // grid and day panel side by side
  const gridWidth = side ? width - 288 : width;
  const chips = gridWidth / 7 >= 84; // wide cells show event titles, narrower ones show dots
  const tiny = width > 0 && width < 250; // too narrow for a legible month: compact overview with an Expand button
  const showGrid = !tiny || expanded;
  const showHabitsToggle = w.size !== "compact";
  const showHabits = w.showHabits && showHabitsToggle;

  const selDate = parse(selected);
  const selEvents = byDate.get(selected) ?? [];
  const openNew = (date: string) => setDialog({ event: null, date });

  const grid = (
    <div className="min-w-0 flex-1">
      <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-neutral-500" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">{gridWidth / 7 >= 40 ? d : d[0]}</div>
        ))}
      </div>
      <div role="grid" aria-label={monthLabel} className="grid grid-cols-7 overflow-hidden rounded-lg border border-neutral-800">
        {cells.map((d, i) => {
          const k = key(d);
          const evs = byDate.get(k) ?? [];
          const inMonth = d.getMonth() === cursor.m;
          const isToday = k === today;
          const isSel = k === selected;
          return (
            <div
              key={k}
              role="gridcell"
              data-date={k}
              data-today={isToday ? "true" : undefined}
              data-selected={isSel ? "true" : undefined}
              data-event-count={evs.length}
              className={`relative min-w-0 ${chips ? "min-h-[5.5rem]" : "min-h-12"} border-neutral-800 p-1 ${i % 7 !== 6 ? "border-r" : ""} ${i < 35 ? "border-b" : ""} ${isSel ? "bg-neutral-800/70" : "hover:bg-neutral-900"} ${inMonth ? "" : "opacity-45"}`}
            >
              <button
                type="button"
                aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${isToday ? ", today" : ""}, ${evs.length} event${evs.length === 1 ? "" : "s"}`}
                aria-pressed={isSel}
                onClick={() => {
                  setSelected(k);
                  if (!inMonth) setCursor({ y: d.getFullYear(), m: d.getMonth() });
                }}
                className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400"
              />
              <span
                className={`pointer-events-none relative inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${isToday ? "font-semibold text-white" : "text-neutral-300"}`}
                style={isToday ? { backgroundColor: dot } : undefined}
              >
                {d.getDate()}
              </span>
              {chips ? (
                <ul className="relative z-10 mt-0.5 space-y-0.5">
                  {evs.slice(0, 2).map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(k);
                          setDialog({ event: e, date: k });
                        }}
                        title={e.title}
                        className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] leading-4 text-neutral-100 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
                        style={{ backgroundColor: `${dot}33`, borderLeft: `2px solid ${dot}` }}
                      >
                        {e.title}
                      </button>
                    </li>
                  ))}
                  {evs.length > 2 && <li className="px-1 text-[10px] text-neutral-500">+{evs.length - 2} more</li>}
                </ul>
              ) : (
                evs.length > 0 && (
                  <div className="pointer-events-none relative mt-0.5 flex justify-center gap-0.5" aria-hidden>
                    {evs.slice(0, 3).map((e) => (
                      <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
                    ))}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const dayPanel = (
    <div className={`min-w-0 ${side ? "w-72 shrink-0" : ""}`} data-day-panel>
      <div className="flex items-center justify-between gap-2">
        <h4 className="min-w-0 truncate text-sm font-semibold text-neutral-100" data-selected-label>
          {selDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </h4>
        <button type="button" className={btn} onClick={() => openNew(selected)} aria-label={`Add event on ${selected}`}>
          <Plus className="h-3.5 w-3.5" /> Add event
        </button>
      </div>
      {selEvents.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No events on this day.</p>
      ) : (
        <ul className="mt-2 space-y-1.5" data-day-events>
          {selEvents.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setDialog({ event: e, date: selected })}
                className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-left transition-colors hover:bg-neutral-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
                style={{ borderLeft: `3px solid ${dot}` }}
              >
                <span className="block truncate text-sm font-medium text-neutral-100">{e.title}</span>
                {e.description && <span className="mt-0.5 line-clamp-2 break-words text-xs text-neutral-400">{e.description}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div ref={root} className="min-w-0" data-calendar data-calendar-mode={tiny && !expanded ? "overview" : chips ? "chips" : "dots"}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <h4 className="mr-auto flex items-center gap-1.5 text-base font-semibold text-neutral-100" data-month-label>
          <CalendarDays className="h-4 w-4 text-neutral-500" aria-hidden /> {monthLabel}
        </h4>
        <button type="button" className={iconBtn} aria-label="Previous month" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" className={btn} onClick={goToday}>Today</button>
        <button type="button" className={iconBtn} aria-label="Next month" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></button>
        {showHabitsToggle && (
          <button type="button" className={btn} aria-pressed={w.showHabits} onClick={() => onPatch({ showHabits: !w.showHabits })} title="Show habits from your notes">
            <ListChecks className="h-3.5 w-3.5" /> Habits
          </button>
        )}
      </div>

      {tiny && (
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-neutral-400">
          <span>{new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
          <button type="button" className={btn} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide month" : "Expand calendar"}
          </button>
        </div>
      )}

      <div className={`flex gap-4 ${side ? "flex-row items-start" : "flex-col"}`}>
        {showGrid && grid}
        {dayPanel}
      </div>

      {showHabits && <HabitPanel habits={data.habits} date={selDate} />}

      {dialog && (
        <EventDialog
          key={dialog.event?.id ?? `new-${dialog.date}`}
          userId={data.userId}
          event={dialog.event}
          date={dialog.date}
          onClose={() => setDialog(null)}
          onSaved={(d) => {
            setSelected(d);
            const dd = parse(d);
            setCursor({ y: dd.getFullYear(), m: dd.getMonth() });
          }}
        />
      )}
    </div>
  );
}

// ---- Habit panel (read-only: completions live in the notes' Habit Tracker blocks)

export function weekKeys(d: Date) {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayIndex(d));
  return Array.from({ length: 7 }, (_, i) => key(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
}

export function HabitPanel({ habits, date }: { habits: DashHabit[]; date: Date }) {
  const k = key(date);
  const wk = weekKeys(date);
  const di = dayIndex(date);
  const rows = habits.map((h) => {
    const scheduled = h.mode === "target" ? true : h.days.includes(di);
    const done = h.done.includes(k);
    const weekDone = wk.filter((x) => h.done.includes(x)).length;
    const total = h.mode === "target" ? h.target : h.days.length;
    const progress = h.mode === "target" ? Math.min(weekDone, h.target) : h.days.filter((i) => h.done.includes(wk[i])).length;
    return { h, scheduled, done, progress, total };
  });
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.h.noteId, [...(groups.get(r.h.noteId) ?? []), r]);

  return (
    <section aria-label="Habits" data-habit-panel className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Habits · {date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
      </h4>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">No habits yet. Add a Habit tracker block to a note and its habits show up here.</p>
      ) : (
        <div className="space-y-3">
          {[...groups.values()].map((list) => (
            <div key={list[0].h.noteId}>
              <Link href={`/?noteId=${list[0].h.noteId}`} className="text-xs font-medium text-neutral-300 hover:text-neutral-100 hover:underline">
                {list[0].h.noteTitle || "Untitled"}
              </Link>
              <ul className="mt-1 space-y-1">
                {list
                  .sort((a, b) => Number(b.scheduled) - Number(a.scheduled))
                  .map(({ h, scheduled, done, progress, total }) => (
                    <li key={h.id} data-habit={h.id} className="flex min-w-0 items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: h.color }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-neutral-200">{h.name}</span>
                      <span className="hidden shrink-0 text-[11px] text-neutral-500 sm:inline">
                        {h.mode === "target" ? `${h.target}× a week` : h.days.length === 7 ? "Daily" : h.days.map((i) => WEEKDAYS[i]).join(" ")}
                      </span>
                      <span className="shrink-0 rounded-full border border-neutral-700 px-1.5 text-[11px] text-neutral-400" data-habit-status>
                        {!scheduled ? "Not scheduled" : done ? "Done" : "Not done"}
                      </span>
                      <span className="w-10 shrink-0 text-right text-[11px] text-neutral-500" title="This week">{progress}/{total}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <p className="text-[11px] text-neutral-600">Read-only here. Tick habits off in their notes.</p>
        </div>
      )}
    </section>
  );
}

// ---- Event dialog: its fields live in local state, so Cancel (or closing) discards everything typed.

function EventDialog({ userId, event, date, onClose, onSaved }: { userId: string; event: CalendarEvent | null; date: string; onClose: () => void; onSaved: (date: string) => void }) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [day, setDay] = useState(event?.eventDate ?? date);
  const [description, setDescription] = useState(event?.description ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const dirty = title.trim() !== (event?.title ?? "") || day !== (event?.eventDate ?? date) || description.trim() !== (event?.description ?? "");

  const save = () => {
    if (!title.trim()) return setError("Enter a title.");
    if (!day) return setError("Choose a date.");
    startTransition(async () => {
      const input = { title, date: day, description };
      try {
        const res = event ? await updateCalendarEvent(userId, event.id, input) : await createCalendarEvent(userId, input);
        if (!res.ok) return setError(res.error); // keep the dialog open with everything the user typed
        onSaved(day);
        toast(event ? "Event updated" : "Event added");
        onClose();
      } catch {
        setError("Couldn't save the event. Check your connection and try again.");
      }
    });
  };
  const remove = () => {
    if (!event || !confirm(`Delete “${event.title}”? This can't be undone.`)) return;
    startTransition(async () => {
      try {
        const res = await deleteCalendarEvent(userId, event.id);
        if (!res.ok) return setError("Couldn't delete the event. Try again.");
        toast("Event deleted");
        onClose();
      } catch {
        setError("Couldn't delete the event. Check your connection and try again.");
      }
    });
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()} disablePointerDismissal={dirty}>
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
            <Dialog.Description className="sr-only">Title, date and a short note for the event.</Dialog.Description>
            <label className="space-y-1 text-xs text-neutral-400">
              Title
              <input autoFocus className={field} value={title} maxLength={120} placeholder="e.g. Chemistry quiz" aria-label="Event title" onChange={(e) => { setTitle(e.target.value); setError(""); }} />
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              Date
              <input type="date" className={field} value={day} aria-label="Event date" onChange={(e) => { setDay(e.target.value); setError(""); }} />
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              Note (optional)
              <textarea className={`${field} min-h-20 resize-y`} value={description} maxLength={1000} aria-label="Event note" onChange={(e) => setDescription(e.target.value)} />
            </label>
            {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
            <div className="mt-1 flex items-center gap-2">
              {event && (
                <button type="button" disabled={pending} onClick={remove} className="rounded-md px-2 py-1.5 text-xs text-red-400 hover:bg-neutral-800 disabled:opacity-50">
                  Delete
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={onClose} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-white disabled:opacity-50">
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
