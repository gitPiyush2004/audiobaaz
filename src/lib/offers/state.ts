/**
 * Offer state machine.
 *
 * Pure-function module. No side effects, no I/O, no React. Encodes the
 * negotiation lifecycle defined in ENGINEERING.md "Offer Status Flow" and the
 * locked product decisions in `docs/context/buyer-flow.md`.
 *
 *   pending  → accepted → paid       (terminal: success)
 *           ↘ declined               (terminal: seller said no)
 *           ↘ expired                (terminal: timeout — see below)
 *           ↘ cancelled              (terminal: buyer retracted before accept)
 *
 * Two timeouts can produce `expired`:
 *   - From `pending`:  seller didn't respond in 24h.
 *   - From `accepted`: buyer didn't pay in 24h.
 *
 * Locked product invariants enforced here:
 *   - No counter-offers — only seller accept / decline. There is no
 *     transition that emits a different amount.
 *   - Buyer can retract (cancel) ONLY before seller acceptance.
 *     `pending → cancelled` is allowed; `accepted → cancelled` is not.
 *   - Parallel accepted offers are allowed in the marketplace but that
 *     concurrency is handled at the listing layer (listing → reserved →
 *     sold). This module is concerned with one offer's own lifecycle.
 *
 * Why this lives in `lib/offers/state.ts` and not inline in components:
 *   - The same predicates are needed by the buyer dashboard (cancel button),
 *     the seller dashboard (accept/decline buttons), the API routes
 *     (server-side authoritative checks), and any future Telegram alert
 *     job. One source of truth prevents drift.
 *   - This module is the contract-of-truth for the negotiation state
 *     machine. Replace the body of `validateOfferTransition` with stricter
 *     rules later (e.g. role checks) without touching call sites.
 */

import type { OfferStatus } from "@/lib/offers/types";

// ─────────────────────────────────────────────────────────────────────────
// Transitions — the single source of truth
// ─────────────────────────────────────────────────────────────────────────

/**
 * Named events that can drive a transition. The actor (buyer / seller /
 * system) is encoded in the event name so call sites are explicit and the
 * state machine can decline transitions that come from the wrong actor.
 */
export type OfferEvent =
  | "seller_accept"        // pending  → accepted
  | "seller_decline"       // pending  → declined
  | "buyer_cancel"         // pending  → cancelled  (only before acceptance)
  | "buyer_pay"            // accepted → paid
  | "system_expire_seller" // pending  → expired    (24h no seller response)
  | "system_expire_buyer"; // accepted → expired    (24h no buyer payment)

/**
 * Transition table. Each row is `(from, event) → to`. Anything not in this
 * table is an illegal transition and `validateOfferTransition` will reject
 * it. Add a row here, and the rest of the file picks it up automatically.
 */
const TRANSITIONS: ReadonlyArray<{
  from:  OfferStatus;
  event: OfferEvent;
  to:    OfferStatus;
}> = [
  { from: "pending",  event: "seller_accept",        to: "accepted"  },
  { from: "pending",  event: "seller_decline",       to: "declined"  },
  { from: "pending",  event: "buyer_cancel",         to: "cancelled" },
  { from: "pending",  event: "system_expire_seller", to: "expired"   },
  { from: "accepted", event: "buyer_pay",            to: "paid"      },
  { from: "accepted", event: "system_expire_buyer",  to: "expired"   },
];

// ─────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────

export type TransitionResult =
  | { ok: true;  next: OfferStatus }
  | { ok: false; reason: string };

/**
 * Validate a transition. Returns the next status (or a reason string) but
 * does NOT mutate anything — callers persist the result.
 *
 * Server-side API routes MUST call this. Client UIs SHOULD call it for
 * disabled-button affordances. Both share the same rules.
 */
export function validateOfferTransition(
  from:  OfferStatus,
  event: OfferEvent
): TransitionResult {
  const row = TRANSITIONS.find((t) => t.from === from && t.event === event);
  if (!row) {
    return {
      ok:     false,
      reason: `Cannot apply ${event} when offer is ${from}.`,
    };
  }
  return { ok: true, next: row.to };
}

// ─────────────────────────────────────────────────────────────────────────
// Predicates — the buttons / affordances UIs need
// ─────────────────────────────────────────────────────────────────────────

/** Terminal states have no outgoing transitions. */
export function isTerminal(status: OfferStatus): boolean {
  return TRANSITIONS.every((t) => t.from !== status);
}

/** Is the offer awaiting the seller's accept/decline? */
export function isAwaitingSeller(status: OfferStatus): boolean {
  return status === "pending";
}

/** Is the offer accepted and awaiting the buyer's payment? */
export function isAwaitingBuyer(status: OfferStatus): boolean {
  return status === "accepted";
}

/**
 * Can the buyer retract this offer right now?
 *
 * Only allowed before seller acceptance. `accepted` cannot be cancelled
 * by the buyer — at that point the buyer either pays or lets it expire.
 */
export function canBuyerCancel(status: OfferStatus): boolean {
  return canFire(status, "buyer_cancel");
}

/** Can the seller accept this offer right now? */
export function canSellerAccept(status: OfferStatus): boolean {
  return canFire(status, "seller_accept");
}

/** Can the seller decline this offer right now? */
export function canSellerDecline(status: OfferStatus): boolean {
  return canFire(status, "seller_decline");
}

/** Can the buyer pay for this offer right now? */
export function canBuyerPay(status: OfferStatus): boolean {
  return canFire(status, "buyer_pay");
}

function canFire(status: OfferStatus, event: OfferEvent): boolean {
  return validateOfferTransition(status, event).ok;
}

// ─────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Human-friendly status label for the buyer surface.
 *
 * Seller-side labels live in seller-flow's domain (e.g. "New offer" reads
 * differently from "Pending response"). Centralised here so all buyer
 * surfaces use the same words.
 */
export function buyerStatusLabel(status: OfferStatus): string {
  switch (status) {
    case "pending":   return "Awaiting response";
    case "accepted":  return "Accepted — pay within 24 hours";
    case "paid":      return "Paid";
    case "declined":  return "Declined";
    case "expired":   return "Expired";
    case "cancelled": return "Cancelled";
  }
}

/**
 * Pick a status colour token name. Components map this to a Badge variant.
 * Returning a token-string keeps this file framework-agnostic — no
 * Tailwind classes, no React.
 */
export function statusToneToken(
  status: OfferStatus
): "info" | "success" | "warning" | "error" | "neutral" {
  switch (status) {
    case "pending":   return "info";
    case "accepted":  return "warning";  // time-pressured — buyer must act
    case "paid":      return "success";
    case "declined":  return "error";
    case "expired":   return "neutral";
    case "cancelled": return "neutral";
  }
}
