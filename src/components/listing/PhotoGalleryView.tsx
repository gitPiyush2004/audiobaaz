"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface PhotoGalleryViewProps {
  photos: string[];
  alt:    string;
  className?: string;
}

/**
 * Client island for `PhotoGallery`. Owns active-photo state only — no other
 * concerns. Keep this file small; if interaction grows (zoom, swipe,
 * keyboard nav), refactor by composition rather than expanding here.
 */
export function PhotoGalleryView({ photos, alt, className }: PhotoGalleryViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(Math.max(activeIndex, 0), photos.length - 1);
  const active = photos[safeIndex];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-surface-2">
        <Image
          key={active}
          src={active}
          alt={`${alt} — photo ${safeIndex + 1} of ${photos.length}`}
          fill
          priority={safeIndex === 0}
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />
      </div>

      {photos.length > 1 && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(photos.length, 6)}, minmax(0, 1fr))` }}
          role="tablist"
          aria-label="Listing photos"
        >
          {photos.map((src, i) => {
            const isActive = i === safeIndex;
            return (
              <button
                key={src}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Show photo ${i + 1}`}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                  isActive
                    ? "border-accent ring-1 ring-accent"
                    : "border-border hover:border-border-2 opacity-70 hover:opacity-100"
                )}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
