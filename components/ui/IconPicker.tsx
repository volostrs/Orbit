"use client";

import { useMemo, useRef, useState } from "react";
import { DynamicIcon } from "./DynamicIcon";
import { FloatingPopover } from "@/components/ui/floating-popover";
import * as Icons from "lucide-react";

// [lucide icon name, readable label, extra search keywords]. Saved icons are stored by lucide name, so names here
// must stay valid; icons saved earlier that are not listed still render (DynamicIcon resolves any lucide name).
type Entry = readonly [name: string, label: string, keywords: string];

const CATEGORIES: { id: string; label: string; icons: Entry[] }[] = [
  {
    id: "productivity",
    label: "Productivity",
    icons: [
      ["Target", "Target", "goal aim focus"],
      ["ListChecks", "Checklist", "todo tasks list"],
      ["CheckSquare", "Task", "todo done checkbox"],
      ["Calendar", "Calendar", "date schedule event"],
      ["Clock", "Clock", "time hour"],
      ["Timer", "Timer", "stopwatch countdown pomodoro"],
      ["Flag", "Flag", "milestone mark"],
      ["Notebook", "Notebook", "journal notes"],
      ["ClipboardList", "Clipboard", "plan list"],
      ["Lightbulb", "Idea", "lightbulb tip"],
      ["FileText", "Document", "page note file"],
      ["Folder", "Folder", "directory files"],
      ["Pin", "Pin", "pinned"],
      ["Inbox", "Inbox", "tray"],
    ],
  },
  {
    id: "school",
    label: "School",
    icons: [
      ["Book", "Book", "read"],
      ["BookOpen", "Open book", "reading study"],
      ["GraduationCap", "Graduation cap", "school college degree"],
      ["Pencil", "Pencil", "write edit"],
      ["Calculator", "Calculator", "math"],
      ["FlaskConical", "Flask", "chemistry science lab"],
      ["Atom", "Atom", "physics science"],
      ["Microscope", "Microscope", "biology science"],
      ["Languages", "Languages", "translate foreign"],
      ["Library", "Library", "books"],
      ["Backpack", "Backpack", "school bag"],
      ["Brain", "Brain", "mind learn think"],
    ],
  },
  {
    id: "health",
    label: "Health & habits",
    icons: [
      ["Heart", "Heart", "love health"],
      ["Droplets", "Water", "drink hydrate"],
      ["BedDouble", "Sleep", "bed rest"],
      ["Footprints", "Running", "walk steps run"],
      ["Dumbbell", "Dumbbell", "gym workout strength"],
      ["Bike", "Bike", "cycling exercise"],
      ["Flower2", "Meditation", "calm mindfulness lotus yoga"],
      ["Apple", "Apple", "fruit food healthy"],
      ["Salad", "Salad", "vegetables diet"],
      ["Pill", "Medicine", "pill vitamins"],
      ["Stethoscope", "Doctor", "health medical"],
      ["Activity", "Pulse", "heartbeat fitness"],
    ],
  },
  {
    id: "work",
    label: "Work & projects",
    icons: [
      ["Briefcase", "Briefcase", "job career"],
      ["Code", "Code", "programming dev"],
      ["Terminal", "Terminal", "command shell"],
      ["Laptop", "Laptop", "computer"],
      ["Wrench", "Wrench", "tool fix build"],
      ["BarChart2", "Chart", "graph stats analytics"],
      ["Rocket", "Rocket", "launch startup"],
      ["Cpu", "Chip", "processor hardware"],
      ["Database", "Database", "data storage"],
      ["Layout", "Layout", "design wireframe"],
      ["Users", "Team", "people group"],
      ["Presentation", "Presentation", "slides talk"],
      ["Mail", "Mail", "email message"],
      ["Globe", "Globe", "world web internet"],
      ["Bot", "Robot", "ai assistant"],
    ],
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    icons: [
      ["Music", "Music", "song audio"],
      ["Gamepad2", "Game controller", "gaming video games"],
      ["Camera", "Camera", "photo"],
      ["Home", "Home", "house"],
      ["Coffee", "Coffee", "cafe drink"],
      ["ShoppingBag", "Shopping bag", "store buy"],
      ["Wallet", "Wallet", "money budget finance"],
      ["Utensils", "Food", "meal cooking restaurant"],
      ["Plane", "Travel", "flight trip"],
      ["Car", "Car", "drive vehicle"],
      ["Film", "Film", "movie video"],
      ["Headphones", "Headphones", "listen podcast"],
      ["Paintbrush", "Art", "paint draw creative"],
      ["Shirt", "Clothes", "fashion outfit"],
    ],
  },
  {
    id: "nature",
    label: "Nature & general",
    icons: [
      ["Sun", "Sun", "day weather"],
      ["Moon", "Moon", "night"],
      ["Leaf", "Leaf", "plant eco"],
      ["Sprout", "Sprout", "grow seedling flower"],
      ["TreePine", "Tree", "forest"],
      ["Cloud", "Cloud", "weather"],
      ["Flame", "Flame", "fire streak hot"],
      ["Star", "Star", "favorite"],
      ["Mountain", "Mountain", "hike outdoors"],
      ["Waves", "Waves", "ocean sea water"],
      ["Snowflake", "Snowflake", "winter cold"],
      ["Umbrella", "Umbrella", "rain"],
      ["PawPrint", "Paw print", "pet animal dog cat"],
      ["Bird", "Bird", "animal"],
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    icons: [
      ["Check", "Check", "done tick"],
      ["Plus", "Plus", "add"],
      ["Bell", "Bell", "notification reminder alert"],
      ["Trophy", "Trophy", "win prize"],
      ["Award", "Award", "badge ribbon"],
      ["Bookmark", "Bookmark", "save"],
      ["Gift", "Gift", "present birthday"],
      ["Smile", "Smile", "happy face"],
      ["PartyPopper", "Celebrate", "party congrats"],
      ["Zap", "Lightning", "bolt energy fast"],
      ["Sparkles", "Sparkles", "magic ai new"],
      ["Crown", "Crown", "king best"],
      ["Shield", "Shield", "security protect"],
      ["User", "Person", "profile account"],
      ["Key", "Key", "access"],
      ["Lock", "Lock", "secure private"],
      ["Eye", "Eye", "view watch"],
      ["Puzzle", "Puzzle", "piece"],
      ["Infinity", "Infinity", "loop forever"],
      ["Settings", "Settings", "gear cog preferences"],
    ],
  },
];

const COLOR_PRESETS = [
  { label: "White", value: "#ffffff" },
  { label: "Neutral", value: "#a3a3a3" },
  { label: "Emerald", value: "#10b981" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Amber", value: "#f59e0b" },
];

// Only names that exist in the installed icon library are offered.
const VALID = CATEGORIES.map((c) => ({ ...c, icons: c.icons.filter(([name]) => name in Icons) }));

const SEARCH_INDEX = VALID.flatMap((c) =>
  c.icons.map((e) => ({ entry: e, text: `${e[0]} ${e[1]} ${e[2]} ${c.label}`.toLowerCase() }))
);

const cellClass =
  "flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 transition-colors hover:bg-neutral-800 focus-visible:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500";

export function IconPicker({
  currentIcon,
  currentColor,
  onSelectIcon,
  onRemoveIcon,
  compact = false,
  label,
}: {
  currentIcon?: string | null;
  currentColor?: string | null;
  onSelectIcon: (icon: string, color: string) => void;
  onRemoveIcon: () => void;
  // Small trigger for use inside custom blocks; shows a placeholder glyph until an icon is chosen.
  compact?: boolean;
  // Accessible name for the trigger; defaults to a generic one.
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(currentIcon || "FileText");
  const [selectedColor, setSelectedColor] = useState(currentColor || "#10b981");
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(
    () => (terms.length ? SEARCH_INDEX.filter((i) => terms.every((t) => i.text.includes(t))).map((i) => i.entry) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query]
  );

  const handleIconClick = (iconName: string) => {
    setSelectedIcon(iconName);
    onSelectIcon(iconName, selectedColor);
    setIsOpen(false);
  };

  const handleColorClick = (colorHex: string) => {
    setSelectedColor(colorHex);
    // Recoloring only applies to an icon that is already set; with no icon it just chooses the color for the next pick.
    if (currentIcon) onSelectIcon(selectedIcon, colorHex);
  };

  // Arrow keys move focus between icons: left/right in reading order, up/down to the nearest icon above/below.
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const cells = Array.from(scrollRef.current?.querySelectorAll<HTMLButtonElement>("button[data-icon]") ?? []);
    const i = cells.indexOf(document.activeElement as HTMLButtonElement);
    if (i === -1) return;
    e.preventDefault();
    let next: HTMLButtonElement | undefined;
    if (e.key === "Home") next = cells[0];
    else if (e.key === "End") next = cells[cells.length - 1];
    else {
      // Icons flow in columns, so every arrow picks the nearest icon in that direction by position.
      const from = cells[i].getBoundingClientRect();
      const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight";
      const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
      let best = Infinity;
      for (const c of cells) {
        const r = c.getBoundingClientRect();
        const along = (horizontal ? r.left - from.left : r.top - from.top) * dir;
        if (along < 4) continue;
        const across = Math.abs(horizontal ? r.top - from.top : r.left - from.left);
        const score = along * 10 + across;
        if (score < best) {
          best = score;
          next = c;
        }
      }
    }
    next?.focus();
    next?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const grid = (icons: readonly Entry[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-0.5">
      {icons.map(([name, text]) => {
        const selected = !!currentIcon && selectedIcon === name;
        return (
          <button
            key={name}
            type="button"
            data-icon={name}
            onClick={() => handleIconClick(name)}
            aria-label={text}
            aria-pressed={selected}
            title={text}
            className={`${cellClass} ${selected ? "bg-neutral-800 ring-1 ring-neutral-600" : ""}`}
          >
            <DynamicIcon name={name} color={selectedColor} className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="inline-block">
      <FloatingPopover
        open={isOpen}
        onOpenChange={(o) => {
          setIsOpen(o);
          if (!o) setQuery("");
        }}
        triggerLabel={label ?? (compact ? (currentIcon ? "Block icon" : "Choose icon") : "Change note icon")}
        triggerClassName={
          compact
            ? "flex cursor-pointer items-center justify-center rounded p-1 transition-colors hover:bg-neutral-800/60"
            : "flex cursor-pointer items-center justify-center rounded-xl p-2 transition-colors hover:bg-neutral-800/60"
        }
        trigger={
          compact && !currentIcon ? (
            <Icons.SmilePlus className="w-4 h-4 text-neutral-400" />
          ) : compact && !(selectedIcon in Icons) ? (
            // Previously saved emoji values are shown as-is rather than falling back to a default icon.
            <span className="text-base leading-none">{selectedIcon}</span>
          ) : (
            <DynamicIcon name={selectedIcon} color={selectedColor} className={compact ? "w-4 h-4" : "w-10 h-10"} />
          )
        }
        className="w-80 rounded-xl p-0 shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex max-h-[min(30rem,calc(var(--available-height,32rem)-2px))] flex-col">
          <div className="flex items-center justify-between px-3 pb-2 pt-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Choose icon</div>
            {currentIcon && (
              <button
                type="button"
                onClick={() => {
                  onRemoveIcon();
                  setIsOpen(false);
                }}
                className="rounded px-1.5 py-0.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
              >
                Remove icon
              </button>
            )}
          </div>

          <div className="px-3">
            <div className="relative">
              <Icons.Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" aria-hidden />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    scrollRef.current?.querySelector<HTMLButtonElement>("button[data-icon]")?.focus();
                  }
                }}
                placeholder="Search icons…"
                aria-label="Search icons"
                className="h-8 w-full rounded-lg border border-neutral-800 bg-neutral-950/60 pl-7 pr-2 text-xs text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 px-3 py-2" role="group" aria-label="Icon color">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleColorClick(c.value)}
                className={`h-5 w-5 rounded-full border-2 ring-1 ring-inset ring-neutral-700 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                  selectedColor === c.value ? "scale-110 border-neutral-100" : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
                aria-label={`${c.label} icon color`}
                aria-pressed={selectedColor === c.value}
              />
            ))}
          </div>

          <div
            ref={scrollRef}
            onKeyDown={onGridKeyDown}
            className={`relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${results ? "border-t border-neutral-800" : ""}`}
          >
            {results ? (
              results.length ? (
                grid(results)
              ) : (
                <p className="py-6 text-center text-xs text-neutral-500">No icons match &ldquo;{query.trim()}&rdquo;.</p>
              )
            ) : (
              VALID.map((c) => (
                <section key={c.id} className="mb-3 last:mb-0">
                  <h3 className="mb-1 text-[11px] font-medium text-neutral-500">{c.label}</h3>
                  {grid(c.icons)}
                </section>
              ))
            )}
          </div>
        </div>
      </FloatingPopover>
    </div>
  );
}
