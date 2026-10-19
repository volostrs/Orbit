"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "@/lib/actions/calendar";
import type { CalendarEvent } from "@/lib/db/schema";
import type { DashHabit } from "@/lib/notes/habits";
import { HabitPanel } from "@/components/dashboard/CalendarWidget";

type View = "month" | "week" | "agenda";
const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "agenda", label: "Agenda" },
];
const PREFS_KEY = "orbit.calendar.v1";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ACCENT = "#10b981";

// ---- Local calendar dates ("YYYY-MM-DD"), built from local parts so nothing shifts across time zones.
const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayIndex = (d: Date) => (d.getDay() + 6) % 7; // Monday = 0
const weekStart = (d: Date) => addDays(d, -dayIndex(d));
const shiftMonth = (d: Date, delta: number) => {
  const first = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
};
function monthCells(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = addDays(first, -dayIndex(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};
const timeLabel = (e: CalendarEvent) => (e.allDay || !e.startTime ? "All day" : e.endTime ? `${fmtTime(e.startTime)} – ${fmtTime(e.endTime)}` : fmtTime(e.startTime));
const byTime = (a: CalendarEvent, b: CalendarEvent) =>
  Number(!!b.allDay) - Number(!!a.allDay) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || +new Date(a.createdAt) - +new Date(b.createdAt);

const btn = "inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 disabled:opacity-40";
const iconBtn = "rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400";
const field = "w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-400 disabled:opacity-40";

function useToday() {
  const [today, setToday] = useState(() => key(new Date()));
  useEffect(() => {
    const id = setInterval(() => setToday((t) => (t === key(new Date()) ? t : key(new Date()))), 30_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

// The current date comes from the browser, so nothing date-dependent is rendered until after mount; otherwise the server
// (a different time zone) and the browser would disagree about today and hydration would fail.
export function CalendarView(props: { userId: string; events: CalendarEvent[]; habits: DashHabit[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 pb-6 pt-16 sm:px-6 md:pt-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-neutral-100">
          <CalendarDays className="h-5 w-5 text-neutral-500" aria-hidden /> Calendar
        </h1>
      </div>
    );
  }
  return <CalendarPage {...props} />;
}

function CalendarPage({ userId, events: serverEvents, habits }: { userId: string; events: CalendarEvent[]; habits: DashHabit[] }) {
  const today = useToday();
  const toast = useToast();
  const [events, setEvents] = useState(serverEvents);
  useEffect(() => setEvents(serverEvents), [serverEvents]);
  const [view, setView] = useState<View>("month");
  const [showHabits, setShowHabits] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(today);
  const [dialog, setDialog] = useState<{ event: CalendarEvent | null; date: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);
  const [, startMove] = useTransition();

  // Remembered per browser: the view and whether the habit panel is open. Visibility only; habits are never touched.
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
      if (VIEWS.some((v) => v.id === p.view)) setView(p.view);
      if (p.showHabits === true) setShowHabits(true);
    } catch {}
  }, []);
  const savePrefs = (next: { view: View; showHabits: boolean }) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {}
  };

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) map.set(e.eventDate, [...(map.get(e.eventDate) ?? []), e]);
    map.forEach((list) => list.sort(byTime));
    return map;
  }, [events]);

  const upsert = useCallback((e: CalendarEvent) => setEvents((list) => (list.some((x) => x.id === e.id) ? list.map((x) => (x.id === e.id ? e : x)) : [...list, e])), []);

  const changeView = (v: View) => {
    setView(v);
    setCursor(parse(selected));
    savePrefs({ view: v, showHabits });
  };
  const toggleHabits = () => {
    setShowHabits(!showHabits);
    savePrefs({ view, showHabits: !showHabits });
  };
  const step = (dir: -1 | 1) => setCursor((c) => (view === "week" ? addDays(c, 7 * dir) : shiftMonth(c, dir)));
  const goToday = () => {
    setCursor(parse(today));
    setSelected(today);
  };
  const pick = (d: Date) => {
    setSelected(key(d));
    if (view === "month" && d.getMonth() !== cursor.getMonth()) setCursor(d);
  };

  // Moving only changes the date; everything else on the event is sent back unchanged.
  const moveTo = (id: string, date: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev || ev.eventDate === date) return;
    const previous = events;
    upsert({ ...ev, eventDate: date });
    startMove(async () => {
      try {
        const res = await updateCalendarEvent(userId, id, { title: ev.title, date, description: ev.description, allDay: ev.allDay, startTime: ev.startTime, endTime: ev.endTime });
        if (!res.ok) throw new Error(res.error);
        upsert(res.event);
        setSelected(date);
        toast(`Moved to ${parse(date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
      } catch {
        setEvents(previous);
        toast("Couldn't move the event. Nothing was changed.");
      }
    });
  };
  const dnd = (date: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return;
      e.preventDefault();
      setDropDate(date);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (dragId) moveTo(dragId, date);
      setDragId(null);
      setDropDate(null);
    },
  });
  const chipProps = (e: CalendarEvent) => ({
    draggable: true,
    onDragStart: (ev: React.DragEvent) => {
      ev.dataTransfer.setData("text/plain", e.id);
      ev.dataTransfer.effectAllowed = "move";
      setDragId(e.id);
    },
    onDragEnd: () => {
      setDragId(null);
      setDropDate(null);
    },
    onClick: () => setDialog({ event: e, date: e.eventDate }),
    "data-event-id": e.id,
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart(cursor), i));
  const heading =
    view === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "week"
        ? (() => {
            const a = weekDays[0], b = weekDays[6];
            const sameMonth = a.getMonth() === b.getMonth();
            return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${b.toLocaleDateString(undefined, sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" })}`;
          })()
        : `From ${cursor.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
  const selDate = parse(selected);
  const selEvents = byDate.get(selected) ?? [];

  const dayEvents = (list: CalendarEvent[], max: number) => (
    <ul className="relative z-10 mt-0.5 hidden space-y-0.5 sm:block">
      {list.slice(0, max).map((e) => (
        <li key={e.id}>
          <button
            type="button"
            {...chipProps(e)}
            title={`${timeLabel(e)} · ${e.title}`}
            className={`block w-full cursor-grab truncate rounded px-1 py-0.5 text-left text-[11px] leading-4 text-neutral-100 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 ${dragId === e.id ? "opacity-40" : ""}`}
            style={{ backgroundColor: `${ACCENT}33`, borderLeft: `2px solid ${ACCENT}` }}
          >
            {!e.allDay && e.startTime && <span className="mr-1 text-neutral-400">{fmtTime(e.startTime)}</span>}
            {e.title}
          </button>
        </li>
      ))}
      {list.length > max && <li className="px-1 text-[10px] text-neutral-500">+{list.length - max} more</li>}
    </ul>
  );

  const month = (
    <div data-cal-view="month">
      <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-neutral-500" aria-hidden>
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1.5">{d}</div>
        ))}
      </div>
      <div role="grid" aria-label={heading} className="grid grid-cols-7 overflow-hidden rounded-lg border border-neutral-800">
        {monthCells(cursor).map((d, i) => {
          const k = key(d);
          const evs = byDate.get(k) ?? [];
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
              {...dnd(k)}
              className={`relative min-h-14 min-w-0 border-neutral-800 p-1 sm:min-h-24 ${i % 7 !== 6 ? "border-r" : ""} ${i < 35 ? "border-b" : ""} ${dropDate === k ? "bg-emerald-500/15" : isSel ? "bg-neutral-800/70" : "hover:bg-neutral-900"} ${d.getMonth() === cursor.getMonth() ? "" : "opacity-45"}`}
            >
              <button
                type="button"
                aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${isToday ? ", today" : ""}, ${evs.length} event${evs.length === 1 ? "" : "s"}`}
                aria-pressed={isSel}
                onClick={() => pick(d)}
                className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400"
              />
              <span
                className={`pointer-events-none relative inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${isToday ? "font-semibold text-white" : "text-neutral-300"} ${isSel && !isToday ? "ring-1 ring-neutral-400" : ""}`}
                style={isToday ? { backgroundColor: ACCENT } : undefined}
              >
                {d.getDate()}
              </span>
              {dayEvents(evs, 3)}
              {evs.length > 0 && (
                <div className="pointer-events-none relative mt-0.5 flex justify-center gap-0.5 sm:hidden" aria-hidden>
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const week = (
    <div data-cal-view="week" className="grid grid-cols-1 gap-2 md:grid-cols-7">
      {weekDays.map((d) => {
        const k = key(d);
        const evs = byDate.get(k) ?? [];
        const isToday = k === today;
        return (
          <div
            key={k}
            data-date={k}
            data-today={isToday ? "true" : undefined}
            data-selected={k === selected ? "true" : undefined}
            data-event-count={evs.length}
            {...dnd(k)}
            className={`min-w-0 rounded-lg border p-2 md:min-h-64 ${dropDate === k ? "border-emerald-500 bg-emerald-500/10" : k === selected ? "border-neutral-500 bg-neutral-900" : "border-neutral-800"}`}
          >
            <button
              type="button"
              aria-pressed={k === selected}
              onClick={() => pick(d)}
              className="flex w-full items-baseline gap-1.5 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 md:flex-col md:gap-0"
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{WEEKDAYS[dayIndex(d)]}</span>
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm ${isToday ? "font-semibold text-white" : "text-neutral-200"}`}
                style={isToday ? { backgroundColor: ACCENT } : undefined}
              >
                {d.getDate()}
              </span>
            </button>
            {evs.length === 0 ? (
              <p className="mt-2 text-[11px] text-neutral-600">No events</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {evs.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      {...chipProps(e)}
                      className={`block w-full cursor-grab rounded px-1.5 py-1 text-left text-xs text-neutral-100 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 ${dragId === e.id ? "opacity-40" : ""}`}
                      style={{ backgroundColor: `${ACCENT}26`, borderLeft: `2px solid ${ACCENT}` }}
                    >
                      <span className="block text-[10px] text-neutral-400">{timeLabel(e)}</span>
                      <span className="block break-words font-medium">{e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );

  const agendaGroups = useMemo(() => {
    const from = key(cursor);
    const map = new Map<string, CalendarEvent[]>();
    [...byDate.keys()].filter((k) => k >= from).sort().forEach((k) => map.set(k, byDate.get(k)!));
    return [...map.entries()];
  }, [byDate, cursor]);
  const agenda = (
    <div data-cal-view="agenda">
      {agendaGroups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 px-4 py-12 text-center" data-agenda-empty>
          <CalendarDays className="h-6 w-6 text-neutral-500" aria-hidden />
          <p className="text-sm text-neutral-300">Nothing scheduled from this date on.</p>
          <button type="button" className={btn} onClick={() => setDialog({ event: null, date: selected })}>
            <Plus className="h-3.5 w-3.5" /> New event
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {agendaGroups.map(([k, list]) => (
            <section key={k} data-date={k} data-event-count={list.length} aria-label={k}>
              <h3 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${k === today ? "text-emerald-500" : "text-neutral-400"}`}>
                {parse(k).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                {k === today && " · Today"}
              </h3>
              <ul className="space-y-1.5">
                {list.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(k);
                        setDialog({ event: e, date: k });
                      }}
                      data-event-id={e.id}
                      className="flex w-full min-w-0 gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-left transition-colors hover:bg-neutral-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
                      style={{ borderLeft: `3px solid ${ACCENT}` }}
                    >
                      <span className="w-28 shrink-0 text-xs text-neutral-400">{timeLabel(e)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-neutral-100">{e.title}</span>
                        {e.description && <span className="line-clamp-2 break-words text-xs text-neutral-400">{e.description}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );

  const dayPanel = (
    <section aria-label="Selected day" data-day-panel className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-sm font-semibold text-neutral-100" data-selected-label>
          {selDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        <button type="button" className={btn} onClick={() => setDialog({ event: null, date: selected })}>
          <Plus className="h-3.5 w-3.5" /> Add
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
                data-event-id={e.id}
                onClick={() => setDialog({ event: e, date: selected })}
                className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-left transition-colors hover:bg-neutral-800/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400"
                style={{ borderLeft: `3px solid ${ACCENT}` }}
              >
                <span className="block text-[11px] text-neutral-400">{timeLabel(e)}</span>
                <span className="block truncate text-sm font-medium text-neutral-100">{e.title}</span>
                {e.description && <span className="mt-0.5 line-clamp-2 break-words text-xs text-neutral-400">{e.description}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-6 pt-16 sm:px-6 md:pt-6" data-calendar-page>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="mr-2 flex items-center gap-2 text-xl font-semibold text-neutral-100">
          <CalendarDays className="h-5 w-5 text-neutral-500" aria-hidden /> Calendar
        </h1>
        <div className="flex items-center gap-1">
          <button type="button" className={iconBtn} aria-label={`Previous ${view === "week" ? "week" : "month"}`} onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className={btn} onClick={goToday}>Today</button>
          <button type="button" className={iconBtn} aria-label={`Next ${view === "week" ? "week" : "month"}`} onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></button>
        </div>
        <p className="min-w-0 text-base font-medium text-neutral-200" data-range-label aria-live="polite">{heading}</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Calendar view" className="inline-flex overflow-hidden rounded-md border border-neutral-700">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={view === v.id}
                onClick={() => changeView(v.id)}
                className={`px-2.5 py-1.5 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 ${view === v.id ? "bg-neutral-700 text-neutral-50" : "text-neutral-400 hover:bg-neutral-800"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button type="button" className={btn} aria-pressed={showHabits} onClick={toggleHabits}>
            <ListChecks className="h-3.5 w-3.5" /> Habits
          </button>
          <button type="button" onClick={() => setDialog({ event: null, date: selected })} className="inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400">
            <Plus className="h-3.5 w-3.5" /> New event
          </button>
        </div>
      </header>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">{view === "month" ? month : view === "week" ? week : agenda}</div>
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-80" data-side>
          {view !== "agenda" && dayPanel}
          {showHabits && <HabitPanel habits={habits} date={selDate} />}
        </aside>
      </div>

      {dialog && (
        <EventDialog
          key={dialog.event?.id ?? `new-${dialog.date}`}
          userId={userId}
          event={dialog.event}
          date={dialog.date}
          onClose={() => setDialog(null)}
          onSaved={(e) => {
            upsert(e);
            setSelected(e.eventDate);
            setCursor(parse(e.eventDate));
          }}
          onDeleted={(id) => setEvents((list) => list.filter((x) => x.id !== id))}
        />
      )}
    </div>
  );
}

// Fields live in local state, so Cancel (or closing the dialog) discards everything typed.
function EventDialog({ userId, event, date, onClose, onSaved, onDeleted }: { userId: string; event: CalendarEvent | null; date: string; onClose: () => void; onSaved: (e: CalendarEvent) => void; onDeleted: (id: string) => void }) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [day, setDay] = useState(event?.eventDate ?? date);
  const [description, setDescription] = useState(event?.description ?? "");
  const [allDay, setAllDay] = useState(event ? event.allDay : true);
  const [start, setStart] = useState(event?.startTime ?? "09:00");
  const [end, setEnd] = useState(event?.endTime ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const save = () => {
    if (!title.trim()) return setError("Enter a title.");
    if (!day) return setError("Choose a date.");
    if (!allDay && !start) return setError("Choose a start time, or mark the event all day.");
    if (!allDay && end && end <= start) return setError("The end time must be after the start time.");
    startTransition(async () => {
      const input = { title, date: day, description, allDay, startTime: allDay ? null : start, endTime: allDay ? null : end || null };
      try {
        const res = event ? await updateCalendarEvent(userId, event.id, input) : await createCalendarEvent(userId, input);
        if (!res.ok) return setError(res.error); // keep the dialog open with everything the user typed
        onSaved(res.event);
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
        onDeleted(event.id);
        toast("Event deleted");
        onClose();
      } catch {
        setError("Couldn't delete the event. Check your connection and try again.");
      }
    });
  };

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[#000000]/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 p-5 text-neutral-100 shadow-xl outline-none">
          <form noValidate onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col gap-3">
            <Dialog.Title className="text-sm font-semibold">{event ? "Edit event" : "New event"}</Dialog.Title>
            <Dialog.Description className="sr-only">Title, date, optional times and a short note for the event.</Dialog.Description>
            <label className="space-y-1 text-xs text-neutral-400">
              Title
              <input autoFocus className={field} value={title} maxLength={120} placeholder="e.g. Chemistry quiz" aria-label="Event title" onChange={(e) => { setTitle(e.target.value); setError(""); }} />
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              Date
              <input type="date" className={field} value={day} aria-label="Event date" onChange={(e) => { setDay(e.target.value); setError(""); }} />
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input type="checkbox" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); setError(""); }} /> All day
            </label>
            {!allDay && (
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs text-neutral-400">
                  Starts
                  <input type="time" className={field} value={start} aria-label="Start time" onChange={(e) => { setStart(e.target.value); setError(""); }} />
                </label>
                <label className="space-y-1 text-xs text-neutral-400">
                  Ends (optional)
                  <input type="time" className={field} value={end} aria-label="End time" onChange={(e) => { setEnd(e.target.value); setError(""); }} />
                </label>
              </div>
            )}
            <label className="space-y-1 text-xs text-neutral-400">
              Note (optional)
              <textarea className={`${field} min-h-20 resize-y`} value={description} maxLength={1000} aria-label="Event note" onChange={(e) => setDescription(e.target.value)} />
            </label>
            {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
            <div className="mt-1 flex items-center gap-2">
              {event && (
                <button type="button" disabled={pending} onClick={remove} className="rounded-md px-2 py-1.5 text-xs text-red-400 hover:bg-neutral-800 disabled:opacity-50">Delete</button>
              )}
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={onClose} className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800">Cancel</button>
                <button type="submit" disabled={pending} className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
              </div>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
