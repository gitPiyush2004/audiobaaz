// ─── User ────────────────────────────────────────────────────────────────────

export type UserRole = "buyer" | "seller" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  phone?: string;
  role: UserRole;
  /** Internal score — never exposed publicly */
  seller_score?: number;
  /** Internal score — never exposed publicly */
  buyer_score?: number;
  upi_id?: string;
  availability_toggle?: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Product catalogue ───────────────────────────────────────────────────────

export type ProductType =
  | "iem"
  | "headphone"
  | "dac"
  | "amp"
  | "dac-amp"
  | "speaker"
  | "cable"
  | "source"
  | "other";

export interface Product {
  id: string;
  type: ProductType;
  brand: string;
  model: string;
  /** Supabase storage URL for product reference image */
  image_url?: string;
  created_at: string;
}

// ─── Listings ────────────────────────────────────────────────────────────────

/**
 * S = Sealed (unopened)
 * A = Mint (used but flawless)
 * B = Excellent (minor signs of use)
 * C = Good (visible wear, fully functional)
 * D = Fair (heavy wear or minor issue)
 */
export type Condition = "S" | "A" | "B" | "C" | "D";

/**
 * draft → pending → approved → reserved → sold → completed
 *                             ↘ rejected  (back to editing)
 *                                         ↘ delisted (seller removes)
 */
export type ListingStatus =
  | "draft"
  | "pending"
  | "approved"
  | "reserved"
  | "sold"
  | "completed"
  | "rejected"
  | "delisted";

export interface Listing {
  id: string;
  seller_id: string;
  seller?: User;
  product_id?: string;
  product?: Product;
  title: string;
  description: string;
  /** Asking price in paise (INR × 100) */
  price: number;
  /**
   * Minimum acceptable price in paise — NEVER sent to client.
   * Excluded from all API responses reaching buyers.
   */
  floor_price?: number;
  /** auto_accept threshold in paise — server-side only */
  auto_accept_threshold?: number;
  negotiation_enabled: boolean;
  condition: Condition;
  inclusions: string[];
  images: string[];
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

// ─── Price history ────────────────────────────────────────────────────────────

export interface PriceHistory {
  id: string;
  product_id: string;
  /** Sale price in paise */
  sold_price: number;
  condition: Condition;
  sold_at: string;
}

// ─── Offers ──────────────────────────────────────────────────────────────────

/**
 * pending → accepted → paid
 *         ↘ declined
 *         ↘ expired   (no seller response in 24hrs)
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
  id: string;
  listing_id: string;
  listing?: Listing;
  buyer_id: string;
  buyer?: User;
  /** Offered amount in paise */
  amount: number;
  message?: string;
  status: OfferStatus;
  /** Offer expires if seller doesn't respond within 24hrs */
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

/**
 * payment_pending → escrow_held → shipped → delivered →
 * inspection → completed
 *              ↘ disputed → resolved
 *              ↘ refunded
 */
export type OrderStatus =
  | "payment_pending"
  | "escrow_held"
  | "shipped"
  | "delivered"
  | "inspection"
  | "completed"
  | "disputed"
  | "resolved"
  | "refunded";

export interface Order {
  id: string;
  listing_id: string;
  listing?: Listing;
  offer_id?: string;
  offer?: Offer;
  buyer_id: string;
  buyer?: User;
  seller_id: string;
  seller?: User;
  /** Final paid amount in paise */
  amount: number;
  /** Platform commission in paise (10% of amount) */
  platform_fee: number;
  /** Amount remitted to seller in paise (90% of amount) */
  seller_payout: number;
  status: OrderStatus;
  payment_id?: string;
  tracking_id?: string;
  courier?: string;
  /** Packing video URL (mandatory before shipping) */
  packing_video_url?: string;
  /** 48hr inspection window; escrow auto-releases on expiry */
  inspection_expires_at?: string;
  created_at: string;
  updated_at: string;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export type PaymentStatus = "created" | "authorized" | "captured" | "failed" | "refunded";

export interface Payment {
  id: string;
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  /** Amount in paise */
  amount: number;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

// ─── Disputes ────────────────────────────────────────────────────────────────

export type DisputeStatus = "open" | "under_review" | "resolved" | "closed";

export type DisputeReason =
  | "item_not_received"
  | "item_not_as_described"
  | "item_damaged"
  | "payment_issue"
  | "other";

export interface Dispute {
  id: string;
  order_id: string;
  order?: Order;
  raised_by: string;
  raised_by_user?: User;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolution?: string;
  resolved_by?: string;
  created_at: string;
  updated_at: string;
}

// ─── Ratings ─────────────────────────────────────────────────────────────────

export interface Rating {
  id: string;
  order_id: string;
  order?: Order;
  rater_id: string;
  rater?: User;
  ratee_id: string;
  ratee?: User;
  rating: 1 | 2 | 3 | 4 | 5;
  review?: string;
  created_at: string;
}

// ─── Watchlist & saved searches ──────────────────────────────────────────────

export interface Watchlist {
  id: string;
  user_id: string;
  listing_id: string;
  listing?: Listing;
  created_at: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  query: string;
  filters: Record<string, unknown>;
  /** Max 3 alerts per day per search */
  last_alerted_at?: string;
  created_at: string;
}

// ─── Notifications (Telegram log) ────────────────────────────────────────────

export type NotificationEvent =
  | "listing_submitted"
  | "listing_approved"
  | "listing_rejected"
  | "offer_received"
  | "offer_accepted"
  | "offer_declined"
  | "order_placed"
  | "order_shipped"
  | "order_delivered"
  | "dispute_opened"
  | "payout_sent";

export interface AppNotification {
  id: string;
  user_id: string;
  event: NotificationEvent;
  payload: Record<string, unknown>;
  telegram_message_id?: number;
  sent_at?: string;
  created_at: string;
}

// ─── Admin — listing review log ──────────────────────────────────────────────

export type ReviewAction = "approved" | "rejected" | "edit_requested";

export interface ListingReview {
  id: string;
  listing_id: string;
  reviewed_by: string;
  reviewer?: User;
  action: ReviewAction;
  notes?: string;
  created_at: string;
}

// ─── API response envelope ───────────────────────────────────────────────────

export type ApiSuccess<T> = { data: T; error: null };
export type ApiError = { data: null; error: { message: string; code: string } };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
