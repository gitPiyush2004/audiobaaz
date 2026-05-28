import type { ReactNode } from "react";
import { cn } from "@/lib/utils/formatting";
import type { Condition } from "@/types";

type StatusVariant = "success" | "warning" | "error" | "info";

type BadgeProps =
  | {
      variant: StatusVariant;
      grade?: never;
      children: ReactNode;
      className?: string;
    }
  | {
      grade: Condition;
      variant?: never;
      children?: never;
      className?: string;
    };

const statusStyles: Record<StatusVariant, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  error:   "bg-error/10   text-error   border-error/20",
  info:    "bg-info/10    text-info    border-info/20",
};

// Colors per ENGINEERING.md: S=accent, A=success, B=info/blue, C=warning, D=error
const gradeStyles: Record<Condition, string> = {
  S: "bg-accent/10 text-accent border-accent/20",
  A: "bg-success/10 text-success border-success/20",
  B: "bg-info/10    text-info    border-info/20",
  C: "bg-warning/10 text-warning border-warning/20",
  D: "bg-error/10   text-error   border-error/20",
};

const gradeLabels: Record<Condition, string> = {
  S: "S — Sealed",
  A: "A — Mint",
  B: "B — Excellent",
  C: "C — Good",
  D: "D — Fair",
};

export function Badge({ variant, grade, children, className }: BadgeProps) {
  const styles  = grade ? gradeStyles[grade] : statusStyles[variant!];
  const content = grade ? gradeLabels[grade] : children;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        styles,
        className
      )}
    >
      {content}
    </span>
  );
}
