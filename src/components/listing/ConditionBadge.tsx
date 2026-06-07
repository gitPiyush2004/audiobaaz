import { cn } from "@/lib/utils/cn";
import type { ConditionGrade } from "@/types";

export interface ConditionBadgeProps {
  grade: ConditionGrade;
  /**
   * `compact` shows only the grade letter (e.g. "A").
   * `full`    shows the labelled form (e.g. "A — Mint").
   * Defaults to `compact` — full label is mostly for the listing detail page.
   */
  variant?: "compact" | "full";
  size?: "sm" | "md";
  className?: string;
}

const gradeLabel: Record<ConditionGrade, string> = {
  S: "Sealed",
  A: "Mint",
  B: "Excellent",
  C: "Good",
  D: "Fair",
};

const gradeStyles: Record<ConditionGrade, string> = {
  S: "bg-grade-s/10 text-grade-s border-grade-s/30",
  A: "bg-grade-a/10 text-grade-a border-grade-a/30",
  B: "bg-grade-b/10 text-grade-b border-grade-b/30",
  C: "bg-grade-c/10 text-grade-c border-grade-c/30",
  D: "bg-grade-d/10 text-grade-d border-grade-d/30",
};

const sizeStyles: Record<NonNullable<ConditionBadgeProps["size"]>, string> = {
  sm: "h-5  px-1.5 text-[11px] gap-1",
  md: "h-6  px-2   text-xs    gap-1.5",
};

/**
 * Color-coded condition grade pill. Used on listing cards, listing pages,
 * search results, and anywhere a grade needs to be communicated quickly.
 *
 * Backed by CSS variables `--grade-{s|a|b|c|d}` so colour stays consistent
 * with the design system token if it ever changes.
 */
export function ConditionBadge({
  grade,
  variant = "compact",
  size = "md",
  className,
}: ConditionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-mono font-semibold uppercase tracking-wide",
        "backdrop-blur-sm",
        gradeStyles[grade],
        sizeStyles[size],
        className
      )}
      aria-label={`Condition grade ${grade} — ${gradeLabel[grade]}`}
    >
      <span>{grade}</span>
      {variant === "full" && (
        <span className="font-sans font-medium normal-case opacity-80">
          — {gradeLabel[grade]}
        </span>
      )}
    </span>
  );
}
