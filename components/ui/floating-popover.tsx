"use client";

import type { ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";

// One popover for every menu that lives inside Orbit's scrolling or clipped containers (custom blocks,
// the note sidebar). The panel is portalled to <body>, so no parent's overflow can clip it; it flips and
// shifts to stay inside the viewport and is capped to the space available. Outside click, Escape and
// focus return are handled by Base UI.
export function FloatingPopover({
  trigger,
  triggerClassName,
  triggerLabel,
  open,
  onOpenChange,
  align = "start",
  side = "bottom",
  className = "",
  children,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  side?: "bottom" | "top" | "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger type="button" aria-label={triggerLabel} className={triggerClassName}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side={side} align={align} sideOffset={6} collisionPadding={8} className="z-50 outline-none">
          <Popover.Popup
            className={`max-h-(--available-height) max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 text-xs text-neutral-200 shadow-lg outline-none ${className}`}
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
