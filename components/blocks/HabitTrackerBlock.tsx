"use client";

import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { Check, ChevronLeft, ChevronRight, Plus, Settings2, Trash2 } from "lucide-react";
import { IconPicker } from "../ui/IconPicker";
import { DynamicIcon } from "../ui/DynamicIcon";
import { BlockShell, ColorSwatches, frameStyle, StyleMenu, tint } from "./blockStyle";

type Mode = "days" | "target";

interface Habit {
  id: string;
  name: string;
  // Scheduling fields are optional so habits saved before they existed keep counting all seven days.
  mode?: Mode;
  days?: number[]; // weekday indexes, 0 = Monday ... 6 = Sunday
  target?: number; // completions per week for "target" mode
  color?: string;
  // Optional per-habit icon (a lucide name from the shared IconPicker) and its color; absent on older habits.
  icon?: string;
  iconColor?: string;
}

interface HabitData {
  habits: Habit[];
  // habit id -> completed dates as local "YYYY-MM-DD" keys
  done: Record<string, string[]>;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_HABIT_COLOR = "#a855f7";

const emptyData = (): HabitData => ({ habits: [], done: {} });

export const DEFAULT_HABIT_DATA = () => JSON.stringify(emptyData());

function parseData(raw: string): HabitData {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.habits) && parsed?.done && typeof parsed.done === "object") return parsed;
  } catch {}
  return emptyData();
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const short = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

type View = "day" | "week" | "month";
const VIEWS: { id: View; label: string }[] = [
  { id: "day", label: "Daily" },
  { id: "week", label: "Weekly" },
  { id: "month", label: "Monthly" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayIdx = (d: Date) => (d.getDay() + 6) % 7; // Monday = 0
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const weekOf = (d: Date) => Array.from({ length: 7 }, (_, i) => addDays(d, i - dayIdx(d)));
function shiftMonth(d: Date, delta: number) {
  const first = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), last));
}
// Monday-first month grid: null pads the leading and trailing cells of the first and last week.
function monthGrid(d: Date): (Date | null)[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array(dayIdx(first)).fill(null);
  for (let i = 1; i <= count; i++) cells.push(new Date(d.getFullYear(), d.getMonth(), i));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Whether a recurring habit is expected on this date. Weekly-target habits have no fixed days.
export function isScheduledOn(h: Habit, date: Date) {
  const { mode, days } = scheduleOf(h);
  return mode === "days" && days.includes(dayIdx(date));
}

// A habit shows on a date when it is scheduled there, is a weekly-target habit (doable any day), or was completed
// there (so a later schedule change never hides a recorded completion).
function relevantOn(h: Habit, date: Date, done: boolean) {
  return done || scheduleOf(h).mode === "target" || isScheduledOn(h, date);
}

function scheduleOf(h: Habit) {
  return { mode: h.mode ?? "days", days: h.days ?? ALL_DAYS, target: h.target ?? 3 };
}

// Applicable count (`total`) and completed count (`done`) for one habit in the displayed week.
// "days": completed scheduled days / scheduled days. "target": completed days capped at the target / target.
export function habitProgress(h: Habit, doneKeys: string[], weekKeys: string[]) {
  const { mode, days, target } = scheduleOf(h);
  if (mode === "target") {
    const count = weekKeys.filter((k) => doneKeys.includes(k)).length;
    return { done: Math.min(count, target), total: target };
  }
  return { done: days.filter((i) => doneKeys.includes(weekKeys[i])).length, total: days.length };
}

const pct = (done: number, total: number) => (total === 0 ? 0 : Math.round((done / total) * 100));

const iconButton = "rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-40";
const chip = (on: boolean) =>
  `rounded border px-1.5 py-0.5 text-[11px] ${
    on ? "border-neutral-300 bg-neutral-700 text-neutral-100" : "border-neutral-700 text-neutral-400"
  }`;

function HabitTracker({
  data,
  editable,
  onChange,
  color,
  icon,
  iconColor,
  onStyleChange,
}: {
  data: HabitData;
  editable: boolean;
  onChange: (d: HabitData) => void;
  color: string;
  icon: string;
  iconColor: string;
  onStyleChange: (patch: { color?: string; icon?: string; iconColor?: string }) => void;
}) {
  // The view and the selected date are display state only; browsing never writes completion records.
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [configId, setConfigId] = useState<string | null>(null);
  const days = weekOf(anchor);
  const keys = days.map(dateKey);
  const todayKey = dateKey(new Date());
  const anchorKey = dateKey(anchor);
  const step = (dir: number) =>
    setAnchor(view === "month" ? shiftMonth(anchor, dir) : addDays(anchor, dir * (view === "week" ? 7 : 1)));
  const atToday =
    view === "day"
      ? anchorKey === todayKey
      : view === "week"
        ? keys.includes(todayKey)
        : anchorKey.slice(0, 7) === todayKey.slice(0, 7);
  const periodLabel =
    view === "day"
      ? anchor.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })
      : view === "week"
        ? `${short(days[0])} – ${short(days[6])}, ${days[6].getFullYear()}`
        : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const isDone = (habitId: string, key: string) => data.done[habitId]?.includes(key) ?? false;

  const toggle = (habitId: string, key: string) => {
    const current = data.done[habitId] ?? [];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    onChange({ ...data, done: { ...data.done, [habitId]: next } });
  };

  const addHabit = () =>
    onChange({
      ...data,
      habits: [
        ...data.habits,
        { id: crypto.randomUUID(), name: `Habit ${data.habits.length + 1}`, mode: "days", days: ALL_DAYS },
      ],
    });

  const updateHabit = (id: string, patch: Partial<Habit>) =>
    onChange({ ...data, habits: data.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) });

  const deleteHabit = (id: string) => {
    const { [id]: _removed, ...done } = data.done;
    onChange({ habits: data.habits.filter((h) => h.id !== id), done });
    if (configId === id) setConfigId(null);
  };

  // Overall progress aggregates completed/applicable counts across habits (not an average of percentages).
  const progress = data.habits.map((h) => habitProgress(h, data.done[h.id] ?? [], keys));
  const completed = progress.reduce((s, p) => s + p.done, 0);
  const total = progress.reduce((s, p) => s + p.total, 0);
  const percent = pct(completed, total);

  // Day and month summaries read the same date-keyed records the weekly view uses.
  const dayRows = data.habits
    .map((h) => ({ h, done: isDone(h.id, anchorKey) }))
    .filter(({ h, done }) => relevantOn(h, anchor, done));
  const monthPrefix = anchorKey.slice(0, 7);
  const monthCompletions = data.habits.reduce(
    (n, h) => n + (data.done[h.id] ?? []).filter((k) => k.startsWith(monthPrefix)).length,
    0
  );

  return (
    <div
      className="my-2 w-full rounded-lg border border-neutral-800 bg-neutral-900/40 text-neutral-200"
      style={frameStyle(color)}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-2 py-1.5 text-xs">
        <StyleMenu color={color} icon={icon} iconColor={iconColor} editable={editable} onChange={onStyleChange} />
        <div role="group" aria-label="Tracker view" className="inline-flex overflow-hidden rounded border border-neutral-700">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={`px-2 py-0.5 text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 ${
                view === v.id ? "bg-neutral-700 text-neutral-50" : "text-neutral-400 hover:bg-neutral-800"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button className={iconButton} onClick={() => step(-1)} aria-label={`Previous ${view === "day" ? "day" : view}`}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-36 text-center font-medium" aria-label="Period" aria-live="polite">
          {periodLabel}
        </span>
        <button className={iconButton} onClick={() => step(1)} aria-label={`Next ${view === "day" ? "day" : view}`}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          className="rounded border border-neutral-700 px-2 py-0.5 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
          disabled={atToday}
          onClick={() => setAnchor(startOfDay(new Date()))}
        >
          Today
        </button>
        <div
          className="ml-auto flex items-center gap-2 text-neutral-400"
          aria-label={`${view === "day" ? "Daily" : view === "week" ? "Weekly" : "Monthly"} progress`}
        >
          {view === "month" ? (
            <span>
              {monthCompletions} completion{monthCompletions === 1 ? "" : "s"} this month
            </span>
          ) : view === "day" ? (
            dayRows.length === 0 ? (
              <span>Nothing scheduled</span>
            ) : (
              <span>
                {dayRows.filter((r) => r.done).length}/{dayRows.length} done
              </span>
            )
          ) : total === 0 ? (
            <span>No scheduled days this week</span>
          ) : (
            <>
              <div className="h-1.5 w-24 overflow-hidden rounded bg-neutral-800">
                <div className="h-full bg-purple-500" style={{ width: `${percent}%` }} />
              </div>
              <span>
                {completed}/{total} · {percent}%
              </span>
            </>
          )}
        </div>
      </div>

      {view === "day" && (
        <div className="p-2" data-habit-view="day">
          <DayHabits
            rows={dayRows}
            date={anchor}
            editable={editable}
            onToggle={(id) => toggle(id, anchorKey)}
            empty="No habits scheduled for this day. Pick days for a habit in the Weekly view."
          />
        </div>
      )}

      {view === "month" && (
        <div className="p-2" data-habit-view="month">
          <MonthGrid anchor={anchor} habits={data.habits} isDone={isDone} todayKey={todayKey} onPick={setAnchor} />
          <div className="mt-2 border-t border-neutral-800 pt-2">
            <DayHabits
              rows={dayRows}
              date={anchor}
              editable={editable}
              onToggle={(id) => toggle(id, anchorKey)}
              empty="No habits scheduled for this day."
            />
          </div>
        </div>
      )}

      {view === "week" && (
      <div className="overflow-x-auto" data-habit-view="week">
        <table className="w-full min-w-[30rem] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-40" />
            {days.map((_, i) => (
              <col key={i} className="w-14" />
            ))}
            {editable && <col className="w-14" />}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-neutral-800 bg-neutral-900 px-2 py-1.5 text-left text-xs font-medium text-neutral-400">
                Habit
              </th>
              {days.map((d, i) => (
                <th
                  key={keys[i]}
                  className={`border-b border-neutral-800 px-1 py-1.5 text-center text-xs font-medium ${
                    keys[i] === todayKey ? "bg-purple-500/20 text-purple-200" : "text-neutral-400"
                  }`}
                >
                  <div>{WEEKDAYS[i]}</div>
                  <div className="whitespace-nowrap">{short(d)}</div>
                </th>
              ))}
              {editable && <th className="border-b border-neutral-800" />}
            </tr>
          </thead>
          <tbody>
            {data.habits.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-4 text-center text-xs text-neutral-500">
                  No habits yet. Add one to start tracking.
                </td>
              </tr>
            )}
            {data.habits.map((habit, hi) => {
              const { mode, days: sched, target } = scheduleOf(habit);
              const hc = habit.color || DEFAULT_HABIT_COLOR;
              const p = progress[hi];
              return [
                <tr key={habit.id} className="group">
                  <td
                    className="sticky left-0 z-10 border-b border-neutral-800 bg-neutral-900 align-middle"
                    // Layered over the opaque base so the sticky cell stays solid while showing the habit's color.
                    style={{ backgroundImage: `linear-gradient(${tint(hc, "33")}, ${tint(hc, "33")})` }}
                  >
                    <div className="flex items-start">
                    {/* Habits without an icon take no space unless editable, where a faint add-icon button shows on hover. */}
                    {habit.icon ? (
                      editable ? (
                        <div className="shrink-0 pl-1 pt-0.5">
                          <IconPicker
                            compact
                            label={`Icon for ${habit.name}`}
                            currentIcon={habit.icon}
                            currentColor={habit.iconColor}
                            onSelectIcon={(icon, iconColor) => updateHabit(habit.id, { icon, iconColor })}
                            onRemoveIcon={() => updateHabit(habit.id, { icon: undefined, iconColor: undefined })}
                          />
                        </div>
                      ) : (
                        <DynamicIcon name={habit.icon} color={habit.iconColor} className="ml-2 mt-2 h-4 w-4 shrink-0" aria-hidden />
                      )
                    ) : (
                      editable && (
                        <div className="shrink-0 pl-1 pt-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <IconPicker
                            compact
                            label={`Add icon for ${habit.name}`}
                            onSelectIcon={(icon, iconColor) => updateHabit(habit.id, { icon, iconColor })}
                            onRemoveIcon={() => {}}
                          />
                        </div>
                      )
                    )}
                    <textarea
                      rows={1}
                      className="field-sizing-content block min-w-0 flex-1 resize-none break-words bg-transparent px-2 pt-1.5 text-sm leading-snug outline-none focus:bg-neutral-800/60"
                      readOnly={!editable}
                      aria-label="Habit name"
                      key={habit.name}
                      defaultValue={habit.name}
                      onBlur={(e) => {
                        const name = e.target.value.replace(/\s+/g, " ").trim();
                        if (name && name !== habit.name) updateHabit(habit.id, { name });
                        else e.target.value = habit.name;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                    />
                    </div>
                    <div
                      className={`pb-1 text-[11px] text-neutral-500 ${habit.icon ? "pl-8 pr-2" : "px-2"}`}
                      aria-label={`${habit.name} progress`}
                    >
                      {p.done}/{p.total} · {mode === "target" ? `${target}×/week` : sched.length === 0 ? "no days" : "scheduled"}
                    </div>
                  </td>
                  {keys.map((key, i) => {
                    const scheduled = mode === "days" && sched.includes(i);
                    return (
                      <td
                        key={key}
                        className={`border-b border-neutral-800 text-center align-middle ${
                          mode === "days" && !scheduled ? "opacity-40" : ""
                        } ${key === todayKey && !scheduled ? "bg-purple-500/10" : ""}`}
                        style={{ backgroundColor: tint(hc, scheduled ? "33" : "14") }}
                        data-scheduled={scheduled ? "true" : "false"}
                      >
                        <input
                          type="checkbox"
                          disabled={!editable}
                          checked={isDone(habit.id, key)}
                          onChange={() => toggle(habit.id, key)}
                          aria-label={`${habit.name} ${key}`}
                        />
                      </td>
                    );
                  })}
                  {editable && (
                    <td className="border-b border-neutral-800 text-center align-middle">
                      <button
                        className="px-1 text-neutral-500 hover:text-neutral-100"
                        onClick={() => setConfigId(configId === habit.id ? null : habit.id)}
                        aria-label={`Configure ${habit.name}`}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="px-1 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                        onClick={() => deleteHabit(habit.id)}
                        aria-label={`Delete ${habit.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>,
                configId === habit.id && (
                  <tr key={`${habit.id}-config`}>
                    <td colSpan={9} className="border-b border-neutral-800 bg-neutral-950/60 px-2 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center gap-1">
                          <button
                            className={chip(mode === "days")}
                            onClick={() => updateHabit(habit.id, { mode: "days", days: sched })}
                          >
                            Specific days
                          </button>
                          <button
                            className={chip(mode === "target")}
                            onClick={() => updateHabit(habit.id, { mode: "target", target })}
                          >
                            Weekly target
                          </button>
                        </div>
                        {mode === "days" ? (
                          <div className="flex items-center gap-1">
                            {WEEKDAYS.map((w, i) => (
                              <button
                                key={w}
                                aria-label={`Toggle ${w} for ${habit.name}`}
                                aria-pressed={sched.includes(i)}
                                className={chip(sched.includes(i))}
                                onClick={() =>
                                  updateHabit(habit.id, {
                                    days: sched.includes(i) ? sched.filter((d) => d !== i) : [...sched, i].sort(),
                                  })
                                }
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <label className="flex items-center gap-1 text-neutral-400">
                            Complete on
                            <select
                              aria-label={`Weekly target for ${habit.name}`}
                              className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200"
                              value={target}
                              onChange={(e) => updateHabit(habit.id, { target: Number(e.target.value) })}
                            >
                              {ALL_DAYS.map((n) => (
                                <option key={n + 1} value={n + 1}>
                                  {n + 1}
                                </option>
                              ))}
                            </select>
                            days per week
                          </label>
                        )}
                        <ColorSwatches
                          value={habit.color ?? ""}
                          onChange={(hex) => updateHabit(habit.id, { color: hex })}
                          label={`Habit color ${habit.name}`}
                        />
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      )}

      {editable && (
        <button
          className="flex w-full items-center gap-1 px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-200"
          onClick={addHabit}
        >
          <Plus className="h-3.5 w-3.5" /> Add habit
        </button>
      )}
    </div>
  );
}

// Habits for one date, each with a checkbox that records (or clears) completion for exactly that date.
function DayHabits({
  rows,
  date,
  editable,
  onToggle,
  empty,
}: {
  rows: { h: Habit; done: boolean }[];
  date: Date;
  editable: boolean;
  onToggle: (habitId: string) => void;
  empty: string;
}) {
  const label = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  if (rows.length === 0) return <p className="px-1 py-3 text-center text-xs text-neutral-500">{empty}</p>;
  return (
    <ul className="space-y-1" aria-label={`Habits for ${label}`}>
      {rows.map(({ h, done }) => {
        const hc = h.color || DEFAULT_HABIT_COLOR;
        const sched = scheduleOf(h);
        const note = sched.mode === "target" ? `${sched.target}× a week` : isScheduledOn(h, date) ? "Scheduled" : "Not scheduled";
        return (
          <li key={h.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={done}
              aria-label={`${h.name}, ${label}`}
              disabled={!editable}
              onClick={() => onToggle(h.id)}
              data-habit={h.id}
              data-done={done ? "true" : "false"}
              className="flex w-full items-center gap-2 rounded-md border-l-2 px-2 py-1.5 text-left text-sm transition-colors hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 disabled:cursor-default"
              style={{ backgroundColor: tint(hc, done ? "33" : "14"), borderLeftColor: hc }}
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                style={{ borderColor: hc, backgroundColor: done ? hc : undefined }}
                aria-hidden
              >
                {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </span>
              {h.icon && <DynamicIcon name={h.icon} color={h.iconColor} className="h-4 w-4 shrink-0" aria-hidden />}
              <span className={`min-w-0 flex-1 truncate ${done ? "text-neutral-400 line-through" : "text-neutral-100"}`}>{h.name}</span>
              <span className="shrink-0 text-[11px] text-neutral-500">{done ? "Done" : note}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Month overview: one compact cell per date with a marker per habit (filled = done, hollow = still to do).
function MonthGrid({
  anchor,
  habits,
  isDone,
  todayKey,
  onPick,
}: {
  anchor: Date;
  habits: Habit[];
  isDone: (habitId: string, key: string) => boolean;
  todayKey: string;
  onPick: (d: Date) => void;
}) {
  const selectedKey = dateKey(anchor);
  return (
    <div>
      <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wide text-neutral-500" aria-hidden>
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div role="grid" aria-label="Month" className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-neutral-800 bg-neutral-800">
        {monthGrid(anchor).map((d, i) => {
          if (!d) return <div key={`pad-${i}`} className="min-h-12 bg-neutral-900/60" aria-hidden />;
          const k = dateKey(d);
          const marks = habits
            .map((h) => ({ h, done: isDone(h.id, k) }))
            .filter(({ h, done }) => done || isScheduledOn(h, d));
          const doneCount = marks.filter((m) => m.done).length;
          const allDone = marks.length > 0 && doneCount === marks.length;
          const selected = k === selectedKey;
          return (
            <button
              key={k}
              type="button"
              role="gridcell"
              data-date={k}
              data-today={k === todayKey ? "true" : undefined}
              aria-pressed={selected}
              aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${
                k === todayKey ? ", today" : ""
              }, ${marks.length === 0 ? "no habits scheduled" : `${doneCount} of ${marks.length} done`}`}
              onClick={() => onPick(d)}
              className={`flex min-h-12 min-w-0 flex-col items-start gap-1 bg-neutral-900 p-1 text-left transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400 ${
                selected ? "ring-1 ring-inset ring-neutral-400" : ""
              }`}
            >
              <span className="flex w-full items-center justify-between text-[11px]">
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 ${
                    k === todayKey ? "bg-purple-500 font-semibold text-white" : "text-neutral-300"
                  }`}
                >
                  {d.getDate()}
                </span>
                {allDone && <Check className="h-3 w-3 text-neutral-400" aria-hidden />}
              </span>
              {marks.length > 0 && (
                <span className="flex flex-wrap gap-0.5" aria-hidden>
                  {marks.slice(0, 6).map(({ h, done }) => (
                    <span
                      key={h.id}
                      title={`${h.name}${done ? " (done)" : ""}`}
                      className="h-2 w-2 rounded-full border"
                      style={{ borderColor: h.color || DEFAULT_HABIT_COLOR, backgroundColor: done ? h.color || DEFAULT_HABIT_COLOR : undefined }}
                    />
                  ))}
                  {marks.length > 6 && <span className="text-[9px] leading-2 text-neutral-500">+{marks.length - 6}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const habitTrackerBlock = createReactBlockSpec(
  {
    type: "habitTracker",
    propSchema: {
      // JSON-serialised HabitData; lives in the block so it persists with notes.content.
      data: { default: "" },
      // Optional appearance; empty strings keep the original look.
      color: { default: "" },
      icon: { default: "" },
      iconColor: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <BlockShell>
        <HabitTracker
          data={parseData(block.props.data)}
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
