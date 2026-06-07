import type { User } from "./user";

export type ProductCategory =
  | "iem"
  | "headphone"
  | "dac"
  | "amp"
  | "dac_amp"
  | "cable"
  | "source"
  | "accessory"
  | "other";

export interface Product {
  id:            string;
  name:          string;
  brand:         string;
  model:         string;
  category:      ProductCategory;
  subcategory?:  string;
  /** Retail price in paise */
  retail_price?: number;
  year_released?: number;
  description?:  string;
  specs?:        Record<string, unknown>;
  image_url?:    string;
  is_verified:   boolean;
  created_by?:   string;
  created_at:    string;
}

/** S = Sealed, A = Mint, B = Excellent, C = Good, D = Fair */
export type ConditionGrade = "S" | "A" | "B" | "C" | "D";

export type OwnershipProofType = "invoice" | "email" | "screenshot" | "none";

/**
 * draft → pending → approved → reserved → sold → completed
 *                             ↘ rejected
 *                                         ↘ delisted | archived
 */
export type ListingStatus =
  | "draft"
  | "pending"
  | "approved"
  | "reserved"
  | "sold"
  | "completed"
  | "rejected"
  | "delisted"
  | "archived";

export interface Listing {
  id:          string;
  seller_id:   string;
  seller?:     User;
  product_id?: string;
  product?:    Product;
  product_name: string;
  brand:        string;
  category:     ProductCategory;
  condition_grade:  ConditionGrade;
  condition_notes?: string;
  known_defects?:   string;
  /** JSONB — e.g. { original_box: true, stock_cable: false } */
  inclusions:   Record<string, boolean>;
  photos:       string[];
  photo_count?: number; // generated column
  /** Asking price in paise */
  asking_price:   number;
  platform_fee_pct: number;
  seller_payout?: number; // generated column
  is_negotiable:  boolean;
  /**
   * Minimum acceptable price in paise.
   * SERVER-SIDE ONLY — never include in API responses to buyers.
   */
  floor_price?:             number;
  auto_accept_threshold?:   number; // server-side only
  ownership_proof_type?:    OwnershipProofType;
  ownership_proof_url?:     string;
  status:           ListingStatus;
  rejection_reason?: string;
  rejection_fields?: string[];
  slug?:       string;
  share_url?:  string; // generated column
  view_count:  number;
  watchlist_count: number;
  submitted_at?:  string;
  approved_at?:   string;
  reserved_at?:   string;
  reserved_until?: string;
  sold_at?:       string;
  completed_at?:  string;
  created_at:     string;
  updated_at:     string;
}

export interface PriceHistory {
  id:              string;
  product_id?:     string;
  product_name:    string;
  category:        ProductCategory;
  condition_grade: ConditionGrade;
  /** Sold price in paise */
  sold_price:      number;
  listing_id?:     string;
  sold_at:         string;
}
