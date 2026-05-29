import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface AccessoryListProps {
  /**
   * Inclusions map: `{ "Carrying case": true, "Stock cable": false, ... }`.
   * Keys are the human-readable accessory labels stored on the listing.
   * Values: `true` = included, `false` = explicitly absent.
   * Keys missing from the map render as "not specified" (not shown).
   */
  inclusions: Record<string, boolean>;
  className?: string;
}

/**
 * Visual ✓/✗ checklist of what comes with the listing. Items the seller
 * marked included render with the success colour; items they explicitly
 * excluded render dimmed with a strikethrough so the buyer can see what's
 * missing without having to compare against the box-fresh expectation.
 *
 * Server component. Order is iteration order of the map (we trust the
 * seller's intent — alphabetising would hide intentional grouping).
 */
export function AccessoryList({ inclusions, className }: AccessoryListProps) {
  const entries = Object.entries(inclusions);

  if (entries.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Inclusions not specified.
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {entries.map(([label, included]) => (
        <li
          key={label}
          className={cn(
            "flex items-center gap-2 text-sm",
            included ? "text-foreground" : "text-dim-foreground line-through"
          )}
        >
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
              included
                ? "bg-success/15 text-success"
                : "bg-error/10 text-error"
            )}
            aria-hidden
          >
            {included ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
