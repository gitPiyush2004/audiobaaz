import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/formatting";

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
