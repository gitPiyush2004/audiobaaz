import { Badge } from "@/components/ui/Badge";
import { buyerStatusLabel, statusToneToken } from "@/lib/offers/state";
import type { OfferStatus } from "@/lib/offers/types";

export interface OfferStatusBadgeProps {
  status: OfferStatus;
  className?: string;
}

/**
 * Thin mapping from `OfferStatus` to the design-system `Badge`. The mapping
 * itself lives in `state.statusToneToken()` so seller-side and admin-side
 * surfaces (when they arrive) can use a different label-helper but the
 * SAME tone tokens, keeping colour semantics consistent across the app.
 *
 * Server component. Buyer-facing label is the default — when a seller
 * variant is needed, ship `OfferStatusBadge` with a `label` override or
 * a sibling component. Don't fork the colour mapping.
 */
export function OfferStatusBadge({ status, className }: OfferStatusBadgeProps) {
  return (
    <Badge variant={statusToneToken(status)} className={className}>
      {buyerStatusLabel(status)}
    </Badge>
  );
}
