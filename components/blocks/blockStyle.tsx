"use client";

import { useEffect, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { Palette } from "lucide-react";
import { DynamicIcon } from "../DynamicIcon";
import { IconPicker } from "../IconPicker";

// Small built-in palette. Colors are applied as low-alpha tints so text stays readable on any theme.
export const PALETTE = [
  { name: "Gray", hex: "#9ca3af" },
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Green", hex: "#22c55e" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
];

// hex is "#rrggbb"; alpha is a two-digit hex suffix.
export const tint = (hex: string | undefined, alpha: string) => (hex ? `${hex}${alpha}` : undefined);

export function frameStyle(color: string) {
  return color ? { backgroundColor: tint(color, "14"), borderColor: tint(color, "66") } : undefined;
}

export function ColorSwatches({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        aria-label={`${label} none`}
        onClick={() => onChange("")}
        className={`h-5 rounded border px-1.5 text-[10px] text-neutral-400 ${
          value === "" ? "border-neutral-300" : "border-neutral-700"
        }`}
      >
        None
      </button>
      {PALETTE.map((c) => (
        <button
          type="button"
          key={c.hex}
          aria-label={`${label} ${c.name}`}
          title={c.name}
          onClick={() => onChange(c.hex)}
          className={`h-5 w-5 rounded-full border-2 ${value === c.hex ? "border-neutral-100" : "border-transparent"}`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}

// Header controls shared by the custom blocks: the note icon picker (icon name + icon color, the same
// format notes use) and a small block-color popover. Values saved earlier as emoji still render as text.
export function StyleMenu({
  color,
  icon,
  iconColor,
  editable,
  onChange,
}: {
  color: string;
  icon: string;
  iconColor: string;
  editable: boolean;
  onChange: (patch: { color?: string; icon?: string; iconColor?: string }) => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);

  if (!editable) {
    if (!icon) return null;
    return (
      <span aria-label="Block icon" className="flex h-6 min-w-6 items-center justify-center">
        {icon in Icons ? (
          <DynamicIcon name={icon} color={iconColor} className="h-4 w-4" />
        ) : (
          <span className="text-base leading-none">{icon}</span>
        )}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <IconPicker
        compact
        currentIcon={icon || null}
        currentColor={iconColor || null}
        onSelectIcon={(name, c) => onChange({ icon: name, iconColor: c })}
        onRemoveIcon={() => onChange({ icon: "", iconColor: "" })}
      />
      <div className="relative">
        <button
          type="button"
          aria-label="Block color"
          onClick={() => setColorOpen(!colorOpen)}
          className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <Palette className="h-3.5 w-3.5" />
        </button>
        {colorOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 w-56 space-y-2 rounded-md border border-neutral-700 bg-neutral-900 p-2 text-xs shadow-lg">
            <div className="text-neutral-400">Block color</div>
            <ColorSwatches value={color} onChange={(hex) => onChange({ color: hex })} label="Color" />
          </div>
        )}
      </div>
    </div>
  );
}

// ProseMirror handles mousedown on non-editable block content before React sees it, and treats a
// click on a button as selecting (and possibly dragging) the whole block. Controls inside a custom
// block stop the native event so only the control reacts.
export function BlockShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("button, input, select, textarea, label, a")) e.stopPropagation();
    };
    el.addEventListener("mousedown", stop);
    return () => el.removeEventListener("mousedown", stop);
  }, []);
  return (
    <div ref={ref} className="w-full" contentEditable={false}>
      {children}
    </div>
  );
}
