import { cn } from "@/lib/utils/cn";
import { PhotoGalleryView } from "./PhotoGalleryView";

export interface PhotoGalleryProps {
  /** Ordered photo URLs. The first is the default cover. */
  photos: string[];
  /** Alt text base; we'll suffix with the photo index. */
  alt:    string;
  className?: string;
}

/**
 * Listing detail photo gallery. One main image + thumbnail strip below.
 * Tapping a thumbnail swaps the main image. No zoom / lightbox in this
 * iteration — that ships when the listing detail surface earns it.
 *
 * This file is the server-component shell so future structural additions
 * (SSR-rendered EXIF, schema.org tags, photo count badges) don't force the
 * leaf back to the server. The interactive piece is `PhotoGalleryView`
 * (a client component).
 */
export function PhotoGallery({ photos, alt, className }: PhotoGalleryProps) {
  if (photos.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-border bg-surface text-sm text-dim-foreground",
          className
        )}
      >
        No photos available
      </div>
    );
  }

  return <PhotoGalleryView photos={photos} alt={alt} className={className} />;
}
