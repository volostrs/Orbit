"use client";

import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { ChevronLeft, ChevronRight, Plus, Settings2, Trash2 } from "lucide-react";
import { ColorSwatches, frameStyle, StyleMenu, tint } from "./blockStyle";

type Mode = "days" | "target";

interface Habit {
  id: string;
  name: string;
  // Scheduling fields are optional so habits saved before they existed keep counting all seven days.
  mode?: Mode;
  days?: number[]; // weekday indexes, 0 = Monday ... 6 = Sunday
  target?: number; // completions per week for "target" mode
  color?: string;
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

// Weeks run Monday to Sunday.
function weekDays(offset: number): Date[] {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

const short = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

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
  const [offset, setOffset] = useState(0);
  const [configId, setConfigId] = useState<string | null>(null);
  const days = weekDays(offset);
  const keys = days.map(dateKey);
  const todayKey = dateKey(new Date());

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

  return (
    <div
      className="my-2 w-full rounded-lg border border-neutral-800 bg-neutral-900/40 text-neutral-200"
      style={frameStyle(color)}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-2 py-1.5 text-xs">
        <StyleMenu color={color} icon={icon} iconColor={iconColor} editable={editable} onChange={onStyleChange} />
        <button className={iconButton} onClick={() => setOffset(offset - 1)} aria-label="Previous week">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-36 text-center font-medium" aria-label="Week range">
          {short(days[0])} – {short(days[6])}, {days[6].getFullYear()}
        </span>
        <button className={iconButton} onClick={() => setOffset(offset + 1)} aria-label="Next week">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          className="rounded border border-neutral-700 px-2 py-0.5 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
          disabled={offset === 0}
          onClick={() => setOffset(0)}
        >
          Today
        </button>
        <div className="ml-auto flex items-center gap-2 text-neutral-400" aria-label="Weekly progress">
          {total === 0 ? (
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

      <div className="overflow-x-auto">
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
                  <td className="sticky left-0 z-10 border-b border-neutral-800 bg-neutral-900 align-middle">
                    <textarea
                      rows={1}
                      className="field-sizing-content block w-full resize-none break-words bg-transparent px-2 pt-1.5 text-sm leading-snug outline-none focus:bg-neutral-800/60"
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
                    <div
                      className="px-2 pb-1 text-[11px] text-neutral-500"
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
                        style={scheduled ? { backgroundColor: tint(hc, "26") } : undefined}
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
      <div className="w-full" contentEditable={false}>
        <HabitTracker
          data={parseData(block.props.data)}
          editable={editor.isEditable}
          color={block.props.color}
          icon={block.props.icon}
          iconColor={block.props.iconColor}
          onStyleChange={(patch) => editor.updateBlock(block, { props: patch })}
          onChange={(next) => editor.updateBlock(block, { props: { data: JSON.stringify(next) } })}
        />
      </div>
    ),
  }
);
