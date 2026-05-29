import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface ListingGridProps {
  /**
   * Cards to render. Pass `<ListingCard />` instances or any other grid item.
   * The grid does NOT know about listing shape — it's a pure layout primitive.
   */
  children?: ReactNode;
  /**
   * Render skeleton placeholders. Use during initial fetches so the grid
   * doesn't pop layout when data arrives.
   */
  loading?: boolean;
  /** Number of skeletons to render when `loading` is true. Defaults to 8. */
  skeletonCount?: number;
  /**
   * Slot shown when the grid has no children and is not loading.
   * If omitted, a sensible default empty state is rendered.
   */
  empty?: ReactNode;
  className?: string;
}

const gridClasses = cn(
  "grid grid-cols-1 gap-4",
  "sm:grid-cols-2 sm:gap-5",
  "lg:grid-cols-3",
  "xl:grid-cols-4"
);

/**
 * Responsive grid for listing cards.
 *
 * Breakpoints:
 *   default  →  1 column (mobile portrait)
 *   sm 640+  →  2
 *   lg 1024+ →  3
 *   xl 1280+ →  4
 *
 * Spacing matches the card padding rhythm (16/20px) so hover lift doesn't
 * collide with neighbours.
 */
export function ListingGrid({
  children,
  loading = false,
  skeletonCount = 8,
  empty,
  className,
}: ListingGridProps) {
  if (loading) {
    return (
      <div className={cn(gridClasses, className)} aria-busy="true" aria-live="polite">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Resolve "no children" robustly — handles arrays, fragments, null, false.
  const hasChildren =
    children !== null &&
    children !== undefined &&
    children !== false &&
    !(Array.isArray(children) && children.length === 0);

  if (!hasChildren) {
    return (
      <div className={cn("w-full", className)}>
        {empty ?? <DefaultEmptyState />}
      </div>
    );
  }

  return <div className={cn(gridClasses, className)}>{children}</div>;
}

function DefaultEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/40 px-6 py-16 text-center">
      <p className="text-sm font-medium text-foreground">No listings here yet</p>
      <p className="text-xs text-muted-foreground">
        Try adjusting your filters or check back soon.
      </p>
    </div>
  );
}

function ListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="aspect-[4/3] w-full animate-pulse bg-surface-2" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="mt-1 h-5 w-24 animate-pulse rounded bg-surface-2" />
        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
