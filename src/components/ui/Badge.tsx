import type { ReactNode } from "react";
import { cn } from "@/lib/utils/formatting";
import type { ConditionGrade } from "@/types";

type StatusVariant = "success" | "warning" | "error" | "info";

type BadgeProps =
  | { variant: StatusVariant; grade?: never; children: ReactNode; className?: string }
  | { grade: ConditionGrade;  variant?: never; children?: never;  className?: string };

const statusStyles: Record<StatusVariant, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  error:   "bg-error/10   text-error   border-error/20",
  info:    "bg-info/10    text-info    border-info/20",
};

const gradeStyles: Record<ConditionGrade, string> = {
  S: "bg-grade-s/10 text-grade-s border-grade-s/20",
  A: "bg-grade-a/10 text-grade-a border-grade-a/20",
  B: "bg-grade-b/10 text-grade-b border-grade-b/20",
  C: "bg-grade-c/10 text-grade-c border-grade-c/20",
  D: "bg-grade-d/10 text-grade-d border-grade-d/20",
};

const gradeLabels: Record<ConditionGrade, string> = {
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
