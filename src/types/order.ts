import type { User } from "./user";
import type { Listing } from "./listing";
import type { Offer } from "./offer";

/**
 * payment_pending → payment_failed
 *                ↘ escrow_held → seller_confirmed → shipped → delivered →
 *                  inspection → completed
 *                              ↘ disputed → resolved
 *                              ↘ refunded | partially_refunded
 */
export type OrderStatus =
  | "payment_pending"
  | "payment_failed"
  | "escrow_held"
  | "seller_confirmed"
  | "shipped"
  | "delivered"
  | "inspection"
  | "completed"
  | "disputed"
  | "refunded"
  | "partially_refunded";

export type PayoutStatus = "pending" | "processing" | "paid" | "failed";

export interface Order {
  id:         string;
  listing_id: string;
  listing?:   Listing;
  buyer_id:   string;
  buyer?:     User;
  seller_id:  string;
  seller?:    User;
  offer_id?:  string;
  offer?:     Offer;
  /** Original asking price in paise */
  listing_price: number;
  /** Amount buyer actually paid in paise */
  paid_price:    number;
  /** Platform commission in paise (10%) */
  platform_fee:  number;
  /** Shipping fee in paise (buyer pays) */
  shipping_fee:  number;
  /** Amount remitted to seller in paise */
  seller_payout: number;
  // Delivery address — snapshot at time of order
  delivery_name:    string;
  delivery_phone:   string;
  delivery_line1:   string;
  delivery_line2?:  string;
  delivery_city:    string;
  delivery_pincode: string;
  delivery_state:   string;
  status: OrderStatus;
  // Shipping
  shiprocket_order_id?:    string;
  shiprocket_shipment_id?: string;
  tracking_number?:        string;
  courier_name?:           string;
  estimated_delivery?:     string;
  // Timing
  escrow_held_at?:        string;
  shipped_at?:            string;
  delivered_at?:          string;
  /** 48hr window — escrow auto-releases on expiry */
  inspection_expires_at?: string;
  completed_at?:          string;
  seller_must_ship_by?:   string;
  // Payout
  payout_status:    PayoutStatus;
  payout_reference?: string;
  payout_at?:        string;
  created_at:        string;
  updated_at:        string;
}

export type PaymentStatus =
  | "created"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded";

export interface Payment {
  id:                    string;
  order_id:              string;
  razorpay_order_id:     string;
  razorpay_payment_id?:  string;
  razorpay_signature?:   string;
  /** Amount in paise */
  amount:   number;
  currency: string;
  status:   PaymentStatus;
  /** upi | card | netbanking | wallet */
  method?:   string;
  created_at: string;
  updated_at: string;
}
