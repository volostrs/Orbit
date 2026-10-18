"use client";

import * as Icons from "lucide-react";
import { LucideProps } from "lucide-react";

type DynamicIconProps = Omit<LucideProps, "color" | "name"> & {
  name: string | null | undefined;
  color?: string | null;
  className?: string;
  size?: number;
};

export function DynamicIcon({
  name,
  color,
  className = "w-5 h-5",
  size,
  ...props
}: DynamicIconProps) {
  if (!name) return <Icons.FileText className={className} size={size} {...props} />;

  const IconComponent = (Icons as Record<string, unknown>)[name];
  const Icon = IconComponent as React.ComponentType<LucideProps> | undefined;

  if (!Icon) {
    return <Icons.FileText className={className} size={size} {...props} />;
  }

  return (
    <Icon
      className={className}
      // A white icon would vanish on a light page, so "white" follows the theme's strongest foreground.
      style={{ color: color?.toLowerCase() === "#ffffff" ? "var(--icon-white)" : color || "currentColor" }}
      size={size}
      {...props}
    />
  );
}