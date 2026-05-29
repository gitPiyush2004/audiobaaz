import { redirect } from "next/navigation";

/**
 * `/orders` index — redirects to the offers dashboard for now.
 *
 * Future buyer dashboard sections (orders, watchlist, saved searches,
 * disputes) will share the `/orders/*` namespace. When the dashboard
 * gains a real overview, replace this redirect with the overview page.
 */
export default function OrdersIndexPage() {
  redirect("/orders/offers");
}
