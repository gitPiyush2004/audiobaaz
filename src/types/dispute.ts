import type { User } from "./user";
import type { Order } from "./order";
import type { Listing } from "./listing";

export type DisputeReason =
  | "condition_mismatch"
  | "non_functional"
  | "missing_accessory"
  | "not_received"
  | "wrong_item";

export type DisputeStatus = "open" | "under_review" | "resolved" | "closed";

export type DisputeResolution =
  | "full_refund"
  | "partial_refund"
  | "rejected"
  | "replacement";

export interface Dispute {
  id:        string;
  order_id:  string;
  order?:    Order;
  buyer_id:  string;
  buyer?:    User;
  seller_id: string;
  seller?:   User;
  reason:       DisputeReason;
  description:  string;
  evidence_urls: string[];
  status:       DisputeStatus;
  resolution?:  DisputeResolution;
  /** Partial refund amount in paise */
  refund_amount?: number;
  admin_notes?:   string;
  resolved_by?:   string;
  resolved_at?:   string;
  created_at:     string;
  updated_at:     string;
}

export interface Rating {
  id:        string;
  order_id:  string;
  buyer_id:  string;
  buyer?:    User;
  seller_id: string;
  seller?:   User;
  stars:     1 | 2 | 3 | 4 | 5;
  review?:   string;
  created_at: string;
}

export interface SellerRatingSummary {
  seller_id:      string;
  total_ratings:  number;
  average_rating: number;
  five_star:      number;
  four_star:      number;
  three_star:     number;
  low_star:       number;
}

export interface Watchlist {
  id:         string;
  user_id:    string;
  listing_id: string;
  listing?:   Listing;
  /** Price at time of saving — used to detect price drops */
  price_at_save: number;
  created_at:    string;
}

export interface SavedSearchFilters {
  query?:             string;
  category?:          string;
  condition_grades?:  string[];
  max_price?:         number;
  min_price?:         number;
  is_negotiable?:     boolean;
}

export interface SavedSearch {
  id:               string;
  user_id:          string;
  label?:           string;
  filters:          SavedSearchFilters;
  alerts_enabled:   boolean;
  /** Resets daily — capped at 3 alerts per day per search */
  alert_count_today: number;
  last_alert_at?:    string;
  created_at:        string;
}

export type NotificationType =
  | "listing_approved"
  | "listing_rejected"
  | "offer_received"
  | "offer_accepted"
  | "offer_declined"
  | "order_placed"
  | "order_shipped"
  | "order_delivered"
  | "dispute_opened"
  | "dispute_resolved"
  | "payout_sent"
  | "price_drop"
  | "saved_search_match";

export interface AppNotification {
  id:           string;
  user_id:      string;
  type:         NotificationType;
  message:      string;
  sent_via:     string;
  status:       string;
  reference_id?: string;
  created_at:   string;
}

export type ReviewAction = "approved" | "rejected" | "flagged";

export interface ListingReview {
  id:          string;
  listing_id:  string;
  reviewed_by: string;
  reviewer?:   User;
  action:      ReviewAction;
  notes?:      string;
  created_at:  string;
}
