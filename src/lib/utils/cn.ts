import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Canonical class-name utility for the project.
 *
 * Combines `clsx` (conditional class composition) with `tailwind-merge`
 * (resolves conflicting Tailwind utilities — last one wins).
 *
 * Always import from `@/lib/utils/cn`. Do not duplicate this elsewhere.
 *
 * @example
 *   cn("p-4", isActive && "bg-accent", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
