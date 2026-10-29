import clsx from "clsx";
import type { ComponentType, ReactNode } from "react";

const VARIANT = {
  default: "bg-white/20 text-white",
  warning: "bg-yellow/20 text-yellow",
  danger: "bg-red/20 text-red",
  success: "bg-green/20 text-green",
} as const;

/** Status badge (shipped module 40975). */
export function Badge({
  variant = "default",
  icon: Icon,
  className,
  children,
}: {
  variant?: keyof typeof VARIANT;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      data-slot="badge"
      className={clsx(
        "text-d-mono relative inline-flex h-6 items-center gap-1 pr-1.5 font-mono whitespace-nowrap uppercase select-none",
        VARIANT[variant],
        Icon ? "pl-1" : "pl-1.5",
        className,
      )}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </span>
  );
}
