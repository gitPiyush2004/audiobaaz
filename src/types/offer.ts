import type { User } from "./user";
import type { Listing } from "./listing";

/**
 * pending → accepted → paid
 *         ↘ declined
 *         ↘ expired   (no seller response in 24hrs OR buyer didn't pay in time)
 *         ↘ cancelled (buyer retracted before acceptance)
 */
export type OfferStatus =
  | "pending"
  | "accepted"
  | "paid"
  | "declined"
  | "expired"
  | "cancelled";

export interface Offer {
  id:          string;
  listing_id:  string;
  listing?:    Listing;
  buyer_id:    string;
  buyer?:      User;
  seller_id:   string;
  seller?:     User;
  /** Offered amount in paise */
  offered_price:             number;
  status:                    OfferStatus;
  /** Offer auto-expires if seller doesn't respond by this time */
  seller_must_respond_by:    string;
  /** Set when accepted — buyer must pay within 24hrs */
  buyer_must_pay_by?:        string;
  created_at:                string;
  updated_at:                string;
}
