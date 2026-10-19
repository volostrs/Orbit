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
  done: string[]; // recent completion dates ("YYYY-MM-DD"); older history is left out to keep the payload small
}

const HISTORY_DAYS = 70;

type Block = { type?: string; props?: Record<string, any>; children?: unknown };

export function extractHabits(notes: { id: string; title: string; content: unknown }[], now = new Date()): DashHabit[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - HISTORY_DAYS);
  const pad = (n: number) => String(n).padStart(2, "0");
  const cutoffKey = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  const out: DashHabit[] = [];
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
              if (!h || typeof h.id !== "string") continue;
              const done: unknown = data.done?.[h.id];
              out.push({
                noteId: note.id,
                noteTitle: note.title,
                id: h.id,
                name: typeof h.name === "string" ? h.name : "Habit",
                mode: h.mode === "target" ? "target" : "days",
                days: Array.isArray(h.days) ? h.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) : [0, 1, 2, 3, 4, 5, 6],
                target: Number.isInteger(h.target) ? h.target : 3,
                color: typeof h.color === "string" ? h.color : "#a855f7",
                done: Array.isArray(done) ? done.filter((k): k is string => typeof k === "string" && k >= cutoffKey).slice(0, 200) : [],
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
