"use client";

import { useState } from "react";
import { DynamicIcon } from "./DynamicIcon";
import { FloatingPopover } from "@/components/ui/floating-popover";
import * as Icons from "lucide-react";

const ICON_LIST = [
  "FileText", "Wrench", "Settings", "Heart", "Clock", "Target", "Folder",
  "Book", "Sparkles", "Zap", "Award", "Terminal", "Code", "Cpu",
  "Database", "Layout", "CheckSquare", "Calendar", "BarChart2", "Shield",
  "User", "Briefcase", "Globe", "Bookmark", "Lightbulb", "Flag"
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

export function IconPicker({
  currentIcon,
  currentColor,
  onSelectIcon,
  onRemoveIcon,
  compact = false,
}: {
  currentIcon?: string | null;
  currentColor?: string | null;
  onSelectIcon: (icon: string, color: string) => void;
  onRemoveIcon: () => void;
  // Small trigger for use inside custom blocks; shows a placeholder glyph until an icon is chosen.
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(currentIcon || "FileText");
  const [selectedColor, setSelectedColor] = useState(currentColor || "#10b981");

  const handleIconClick = (iconName: string) => {
    setSelectedIcon(iconName);
    onSelectIcon(iconName, selectedColor);
  };

  const handleColorClick = (colorHex: string) => {
    setSelectedColor(colorHex);
    onSelectIcon(selectedIcon, colorHex);
  };

  return (
    <div className="inline-block">
      <FloatingPopover
        open={isOpen}
        onOpenChange={setIsOpen}
        triggerLabel={compact ? (currentIcon ? "Block icon" : "Choose icon") : "Change note icon"}
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
        className="w-72 rounded-xl p-4 shadow-2xl"
      >
        <div className="mb-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">Icon color</div>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => handleColorClick(c.value)}
                className={`h-6 w-6 rounded-full border-2 ring-1 ring-inset ring-neutral-700 transition-transform hover:scale-110 ${
                  selectedColor === c.value ? "scale-110 border-neutral-100" : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
                aria-label={c.label}
              />
            ))}
          </div>
        </div>

        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">Icon</div>
        <div className="grid max-h-48 grid-cols-5 gap-1.5 overflow-y-auto pr-1">
          {ICON_LIST.map((iconName) => (
            <button
              key={iconName}
              type="button"
              onClick={() => handleIconClick(iconName)}
              aria-label={iconName}
              className={`flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-neutral-800 ${
                selectedIcon === iconName ? "bg-neutral-800 ring-1 ring-neutral-600" : ""
              }`}
            >
              <DynamicIcon name={iconName} color={selectedColor} className="h-5 w-5" />
            </button>
          ))}
        </div>

        {currentIcon && (
          <div className="mt-3 flex justify-end border-t border-neutral-800 pt-2">
            <button
              type="button"
              onClick={() => {
                onRemoveIcon();
                setIsOpen(false);
              }}
              className="text-xs text-neutral-400 transition-colors hover:text-red-400"
            >
              Remove icon
            </button>
          </div>
        )}
      </FloatingPopover>
    </div>
  );
}
