export type UserRole = "user" | "admin";
export type UserAvailability = "active" | "away" | "paused";

export interface TelegramAlerts {
  listing_approved:    boolean;
  offer_received:      boolean;
  offer_accepted:      boolean;
  order_update:        boolean;
  price_drop:          boolean;
  saved_search_match:  boolean;
  payout_sent:         boolean;
  dispute_update:      boolean;
}

export interface User {
  id:                 string;
  phone:              string;
  email?:             string;
  full_name?:         string;
  city?:              string;
  pincode?:           string;
  upi_id?:            string;
  telegram_chat_id?:  string;
  telegram_alerts:    TelegramAlerts;
  role:               UserRole;
  /** Internal trust score 0–200. Never expose publicly. */
  seller_score:       number;
  /** Internal trust score 0–200. Never expose publicly. */
  buyer_score:        number;
  is_active:          boolean;
  availability:       UserAvailability;
  availability_until?: string;
  strike_count:       number;
  created_at:         string;
  updated_at:         string;
}
