"use client";

import { useState, useRef, useEffect } from "react";
import { DynamicIcon } from "./DynamicIcon";
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
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleIconClick = (iconName: string) => {
    setSelectedIcon(iconName);
    onSelectIcon(iconName, selectedColor);
  };

  const handleColorClick = (colorHex: string) => {
    setSelectedColor(colorHex);
    onSelectIcon(selectedIcon, colorHex);
  };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={compact ? (currentIcon ? "Block icon" : "Choose icon") : undefined}
        className={
          compact
            ? "p-1 rounded hover:bg-neutral-800/60 transition-colors flex items-center justify-center cursor-pointer"
            : "p-2.5 rounded-xl hover:bg-neutral-800/60 transition-colors flex items-center justify-center cursor-pointer"
        }
      >
        {compact && !currentIcon ? (
          <Icons.SmilePlus className="w-4 h-4 text-neutral-400" />
        ) : compact && !(selectedIcon in Icons) ? (
          // Previously saved emoji values are shown as-is rather than falling back to a default icon.
          <span className="text-base leading-none">{selectedIcon}</span>
        ) : (
          <DynamicIcon
            name={selectedIcon}
            color={selectedColor}
            className={compact ? "w-4 h-4" : "w-10 h-10"}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-4 z-50 text-neutral-200">
          {/* Color Selection */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-neutral-400 mb-2">
              ICON COLOR
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleColorClick(c.value)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    selectedColor === c.value
                      ? "border-white scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Icon Grid */}
          <div className="text-xs font-semibold text-neutral-400 mb-2">
            SELECT ICON
          </div>
          <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {ICON_LIST.map((iconName) => (
              <button
                key={iconName}
                type="button"
                onClick={() => handleIconClick(iconName)}
                className={`p-2 rounded-lg flex items-center justify-center hover:bg-neutral-800 transition-colors ${
                  selectedIcon === iconName ? "bg-neutral-800 ring-1 ring-neutral-600" : ""
                }`}
              >
                <DynamicIcon
                  name={iconName}
                  color={selectedColor}
                  className="w-5 h-5"
                />
              </button>
            ))}
          </div>

          {/* Remove Icon */}
          {currentIcon && (
            <div className="mt-3 pt-2 border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onRemoveIcon();
                  setIsOpen(false);
                }}
                className="text-xs text-neutral-400 hover:text-red-400 transition-colors"
              >
                Remove Icon
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}