/**
 * Mock seller view-models.
 *
 * Intentionally NOT typed as the full `User` row from the DB — only the public
 * fields the buyer surface ever shows. Server-only fields (`seller_score`,
 * `buyer_score`, `phone`, `email`, `upi_id`, `telegram_chat_id`) are absent
 * by construction so they can't leak.
 *
 * Realistic mess: mixed cities, mixed rating volumes, one new seller with no
 * rating yet, one without a `full_name`.
 */

export interface MockSeller {
  id:           string;
  full_name?:   string;
  city?:        string;
  /** Public-facing rating, 0–5. Distinct from internal `seller_score`. */
  rating?:      number;
  rating_count?: number;
}

export const mockSellers = [
  {
    id:           "seller-001",
    full_name:    "Rohan Mehta",
    city:         "Mumbai",
    rating:       4.8,
    rating_count: 47,
  },
  {
    id:           "seller-002",
    full_name:    "Priya Nair",
    city:         "Bangalore",
    rating:       4.9,
    rating_count: 122,
  },
  {
    id:           "seller-003",
    full_name:    "Aakash Kulkarni",
    city:         "Pune",
    rating:       4.5,
    rating_count: 18,
  },
  {
    id:           "seller-004",
    full_name:    "Tanvi Shah",
    city:         "Ahmedabad",
    rating:       4.2,
    rating_count: 9,
  },
  // No name set yet — show fallback "Verified seller"
  {
    id:           "seller-005",
    city:         "Hyderabad",
    rating:       4.7,
    rating_count: 31,
  },
  {
    id:           "seller-006",
    full_name:    "Ishaan Gupta",
    city:         "Delhi",
    rating:       3.9,
    rating_count: 6,
  },
  // New seller — no rating yet (rating undefined, count undefined)
  {
    id:           "seller-007",
    full_name:    "Meera Iyer",
    city:         "Chennai",
  },
  {
    id:           "seller-008",
    full_name:    "Karan Bhat",
    city:         "Kolkata",
    rating:       5.0,
    rating_count: 4,
  },
] as const satisfies readonly MockSeller[];

export type MockSellerId = (typeof mockSellers)[number]["id"];

export function findMockSeller(id: string): MockSeller | undefined {
  return mockSellers.find((s) => s.id === id);
}
