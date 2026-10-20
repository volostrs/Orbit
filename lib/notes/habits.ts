// Reads habits out of notes' Habit Tracker blocks for the Dashboard calendar's habit panel. Read-only: the blocks
// remain the single source of truth for schedules and completions, and nothing here writes to them.

export interface DashHabit {
  noteId: string;
  noteTitle: string;
  id: string;
  name: string;
  mode: "days" | "target";
  days: number[]; // weekday indexes, 0 = Monday ... 6 = Sunday
  target: number;
  color: string;
  icon?: string; // optional lucide icon name and color, as set on the habit in its tracker
  iconColor?: string;
  done: string[]; // recent completion dates ("YYYY-MM-DD"); older history is left out to keep the payload small
}

const HISTORY_DAYS = 400;

// What the Calendar draws for one date. Derived on the fly from the habits' schedule and completion records, never
// stored: a weekday habit is expected on its scheduled weekdays; a weekly-target habit has no fixed days, so it only
// appears on dates it was actually completed. A completion on an unscheduled date is still shown.
export interface HabitOccurrence {
  habit: DashHabit;
  done: boolean;
}

export function habitsOnDate(habits: DashHabit[], dateKey: string, weekdayIndex: number): HabitOccurrence[] {
  const out: HabitOccurrence[] = [];
  for (const habit of habits) {
    const done = habit.done.includes(dateKey);
    if (done || (habit.mode === "days" && habit.days.includes(weekdayIndex))) out.push({ habit, done });
  }
  return out;
}

type Block = { type?: string; props?: Record<string, any>; children?: unknown };

export function extractHabits(notes: { id: string; title: string; content: unknown }[], now = new Date()): DashHabit[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - HISTORY_DAYS);
  const pad = (n: number) => String(n).padStart(2, "0");
  const cutoffKey = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  const out: DashHabit[] = [];
  const seen = new Set<string>(); // a copied tracker block repeats its habit ids; each habit is listed once per note
  for (const note of notes) {
    const walk = (blocks: unknown) => {
      if (!Array.isArray(blocks)) return;
      for (const b of blocks as Block[]) {
        if (!b || typeof b !== "object") continue;
        if (b.type === "habitTracker") {
          let data: any = null;
          try {
            data = JSON.parse(String(b.props?.data));
          } catch {}
          if (Array.isArray(data?.habits)) {
            for (const h of data.habits) {
              if (!h || typeof h.id !== "string" || seen.has(note.id + ":" + h.id)) continue;
              seen.add(note.id + ":" + h.id);
              const done: unknown = data.done?.[h.id];
              out.push({
                noteId: note.id,
                noteTitle: note.title,
                id: h.id,
                name: typeof h.name === "string" ? h.name : "Habit",
                mode: h.mode === "target" ? "target" : "days",
                days: Array.isArray(h.days) ? h.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) : [0, 1, 2, 3, 4, 5, 6],
                target: Number.isInteger(h.target) ? h.target : 3,
                color: typeof h.color === "string" && h.color ? h.color : "#a855f7",
                icon: typeof h.icon === "string" && h.icon ? h.icon : undefined,
                iconColor: typeof h.iconColor === "string" && h.iconColor ? h.iconColor : undefined,
                done: Array.isArray(done) ? done.filter((k): k is string => typeof k === "string" && k >= cutoffKey).slice(0, HISTORY_DAYS + 30) : [],
              });
            }
          }
        }
        walk(b.children);
      }
    };
    walk(note.content);
  }
  return out;
}
