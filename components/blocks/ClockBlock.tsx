"use client";

import { useEffect, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { Settings2 } from "lucide-react";
import { BlockShell, frameStyle, StyleMenu } from "./blockStyle";
import { FloatingPopover } from "../ui/floating-popover";

// Display preferences only. The current time is never stored; it is read from the clock while rendering.
export interface ClockSettings {
  hour12: boolean;
  seconds: boolean;
  date: boolean;
}

const DEFAULTS: ClockSettings = { hour12: true, seconds: true, date: true };

export const DEFAULT_CLOCK_DATA = () => JSON.stringify(DEFAULTS);

export function parseClockSettings(raw: string): ClockSettings {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object") {
      return {
        hour12: typeof p.hour12 === "boolean" ? p.hour12 : DEFAULTS.hour12,
        seconds: typeof p.seconds === "boolean" ? p.seconds : DEFAULTS.seconds,
        date: typeof p.date === "boolean" ? p.date : DEFAULTS.date,
      };
    }
  } catch {}
  return DEFAULTS;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatClock(d: Date, s: ClockSettings) {
  const h = d.getHours();
  const hh = s.hour12 ? h % 12 || 12 : pad(h);
  const time = `${hh}:${pad(d.getMinutes())}${s.seconds ? `:${pad(d.getSeconds())}` : ""}`;
  return { time, period: s.hour12 ? (h < 12 ? "AM" : "PM") : "" };
}

// null until the client has mounted, so server HTML and the first client render are identical
// (a neutral placeholder) and no timestamp can mismatch during hydration. After that it ticks on the
// next second (or minute) boundary; this is local state only and never touches the editor document.
function useNow(seconds: boolean) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const step = seconds ? 1000 : 60_000;
    const tick = () => {
      const d = new Date();
      setNow(d);
      timer = setTimeout(tick, step - (d.getTime() % step) + 5);
    };
    tick();
    // Timers are throttled in background tabs; resync as soon as the tab is visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [seconds]);
  return now;
}

const segment = (on: boolean) =>
  `rounded border px-2 py-0.5 text-[11px] ${on ? "border-neutral-300 bg-neutral-700 text-neutral-100" : "border-neutral-700 text-neutral-400"}`;

function Clock({
  settings,
  editable,
  onSettings,
  color,
  icon,
  iconColor,
  onStyleChange,
}: {
  settings: ClockSettings;
  editable: boolean;
  onSettings: (s: ClockSettings) => void;
  color: string;
  icon: string;
  iconColor: string;
  onStyleChange: (patch: { color?: string; icon?: string; iconColor?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const now = useNow(settings.seconds);
  const f = now ? formatClock(now, settings) : null;
  const placeholder = settings.seconds ? "--:--:--" : "--:--";

  return (
    <div className="my-2 w-full rounded-lg border border-neutral-800 bg-neutral-900/40 text-neutral-200" style={frameStyle(color)}>
      <div className="flex items-center gap-1 px-2 pt-1.5 text-xs">
        <StyleMenu color={color} icon={icon} iconColor={iconColor} editable={editable} onChange={onStyleChange} />
        {editable && (
          <FloatingPopover
            open={open}
            onOpenChange={setOpen}
            triggerLabel="Clock settings"
            triggerClassName="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            trigger={<Settings2 className="h-3.5 w-3.5" />}
            className="w-56 space-y-2.5 p-2.5"
          >
            <div className="space-y-1">
              <div className="text-neutral-400">Format</div>
              <div className="flex gap-1" role="group" aria-label="Time format">
                <button type="button" aria-pressed={settings.hour12} className={segment(settings.hour12)} onClick={() => onSettings({ ...settings, hour12: true })}>
                  12-hour
                </button>
                <button type="button" aria-pressed={!settings.hour12} className={segment(!settings.hour12)} onClick={() => onSettings({ ...settings, hour12: false })}>
                  24-hour
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-neutral-300">
              <input type="checkbox" checked={settings.seconds} onChange={(e) => onSettings({ ...settings, seconds: e.target.checked })} />
              Show seconds
            </label>
            <label className="flex items-center gap-2 text-neutral-300">
              <input type="checkbox" checked={settings.date} onChange={(e) => onSettings({ ...settings, date: e.target.checked })} />
              Show date
            </label>
          </FloatingPopover>
        )}
      </div>
      <div className="px-3 pb-3 text-center">
        <time
          data-clock-time
          dateTime={now?.toISOString()}
          aria-label={f ? `Current time ${f.time} ${f.period}`.trim() : "Current time loading"}
          className="inline-flex items-baseline gap-2 font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl"
        >
          <span>{f ? f.time : placeholder}</span>
          {settings.hour12 && <span className="text-base font-medium text-neutral-400">{f ? f.period : "--"}</span>}
        </time>
        {settings.date && (
          <div data-clock-date className="mt-1 min-h-5 text-sm text-neutral-400">
            {now ? now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : " "}
          </div>
        )}
      </div>
    </div>
  );
}

export const clockBlock = createReactBlockSpec(
  {
    type: "clock",
    propSchema: {
      // JSON-serialised ClockSettings (display preferences only; the time is never stored).
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
        <Clock
          settings={parseClockSettings(block.props.data)}
          editable={editor.isEditable}
          color={block.props.color}
          icon={block.props.icon}
          iconColor={block.props.iconColor}
          onStyleChange={(patch) => editor.updateBlock(block, { props: patch })}
          onSettings={(next) => editor.updateBlock(block, { props: { data: JSON.stringify(next) } })}
        />
      </BlockShell>
    ),
  }
);
