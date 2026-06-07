/**
 * Browse — buyer inventory surface.
 * Server component. Filters + sort read from URL search params for
 * shareability, back-button correctness, and future SSR caching.
 */

import Link from "next/link";
import {
  getBrowseListings,
  parseBrowseSearchParams,
  VALID_CATEGORIES,
  VALID_PRICE_BUCKETS,
} from "@/lib/listings/browse";
import type { BrowseSort, PriceBucket } from "@/lib/listings/types";
import { ListingCard } from "@/components/listing/ListingCard";
import type { ConditionGrade, ProductCategory } from "@/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Browse — Audiobaaz",
  description: "Browse condition-graded, escrow-protected secondhand audio gear.",
};

// ── Static maps ──────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  iem:       "IEM",
  headphone: "Headphone",
  dac:       "DAC",
  amp:       "Amp",
  dac_amp:   "DAC + Amp",
  cable:     "Cable",
  source:    "Source",
  accessory: "Accessory",
  other:     "Other",
};

const PRICE_LABEL: Record<PriceBucket, string> = {
  under_5k:  "Under ₹5,000",
  "5k_15k":  "₹5,000 – ₹15,000",
  "15k_30k": "₹15,000 – ₹30,000",
  "30k_75k": "₹30,000 – ₹75,000",
  "75k_plus":"₹75,000+",
};

const SORT_LABEL: Record<BrowseSort, string> = {
  newest:      "Newest",
  price_asc:   "Price ↑",
  price_desc:  "Price ↓",
  rating_desc: "Seller rating",
  most_viewed: "Most viewed",
};

const SORT_ORDER: BrowseSort[] = ["newest", "price_asc", "price_desc", "rating_desc", "most_viewed"];

const GRADE_ACTIVE: Record<string, { bg: string; color: string; border: string }> = {
  S: { bg: "#DBEAFE", color: "#1D4ED8", border: "#1D4ED8" },
  A: { bg: "#DCFCE7", color: "#15803D", border: "#15803D" },
  B: { bg: "#FEF9C3", color: "#A16207", border: "#A16207" },
  C: { bg: "#F3F4F6", color: "#374151", border: "#374151" },
  D: { bg: "#FEE2E2", color: "#B91C1C", border: "#B91C1C" },
};

const GRADE_EXPLAINER = [
  { grade: "S", title: "Sealed / Mint", desc: "Unopened or pristine. Original packaging, zero use. Indistinguishable from new.", bg: "#DBEAFE", color: "#1D4ED8" },
  { grade: "A", title: "Like new",      desc: "Light use, no visible wear. May be missing minor accessories. Fully functional.", bg: "#DCFCE7", color: "#15803D" },
  { grade: "B", title: "Good",          desc: "Normal signs of use. Minor cosmetic marks. Sounds and functions perfectly.",      bg: "#FEF9C3", color: "#A16207" },
  { grade: "C", title: "Fair",          desc: "Visible wear but fully working. Clearly described and priced accordingly.",      bg: "#F3F4F6", color: "#374151" },
];

// ── Page ─────────────────────────────────────────────────────────────────────

interface BrowsePageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const filters  = parseBrowseSearchParams(searchParams);
  const listings = await getBrowseListings(filters);

  // Build a URL that preserves all current filters except the given overrides.
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string> = {};
    if (filters.categories?.length)              merged.category   = filters.categories.join(",");
    if (filters.conditions?.length)              merged.condition  = filters.conditions.join(",");
    if (filters.priceBucket)                     merged.price      = filters.priceBucket;
    if (filters.negotiableOnly)                  merged.negotiable = "1";
    if (filters.sort && filters.sort !== "newest") merged.sort     = filters.sort;
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete merged[k]; else merged[k] = v;
    }
    const qs = new URLSearchParams(merged).toString();
    return qs ? `/browse?${qs}` : "/browse";
  };

  const toggle = (list: string[], val: string) =>
    list.includes(val) ? list.filter(v => v !== val) : [...list, val];

  const catHref   = (c: ProductCategory) => {
    const next = toggle(filters.categories ?? [], c);
    return buildHref({ category: next.length ? next.join(",") : undefined });
  };
  const condHref  = (g: ConditionGrade) => {
    const next = toggle(filters.conditions ?? [], g);
    return buildHref({ condition: next.length ? next.join(",") : undefined });
  };
  const priceHref = (b: PriceBucket | undefined) => buildHref({ price: b });
  const sortHref  = (s: BrowseSort) => buildHref({ sort: s === "newest" ? undefined : s });
  const negHref   = () => buildHref({ negotiable: filters.negotiableOnly ? undefined : "1" });

  const activeSort   = filters.sort ?? "newest";
  const isAllCats    = !filters.categories?.length;

  return (
    <>
      {/* ── Page header ── */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        padding: "36px 40px 20px", borderBottom: "1px solid #E8E8E4",
      }}>
        <div>
          <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#999", marginBottom: "6px" }}>
            {listings.length} {listings.length === 1 ? "listing" : "listings"} live right now
          </div>
          <h1 style={{ fontSize: "32px", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>
            Browse{" "}
            <em style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>listings</em>
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#999", marginRight: "4px" }}>
            Sort
          </span>
          {SORT_ORDER.map(s => {
            const on = activeSort === s;
            return (
              <Link
                key={s}
                href={sortHref(s)}
                style={{
                  fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em",
                  padding: "6px 14px",
                  border: `1.5px solid ${on ? "#0a0a0a" : "#E8E8E4"}`,
                  color: on ? "#ffffff" : "#666",
                  background: on ? "#0a0a0a" : "#ffffff",
                  textTransform: "uppercase", whiteSpace: "nowrap",
                  textDecoration: "none", display: "inline-block",
                }}
              >
                {SORT_LABEL[s]}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Browse body ── */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "calc(100vh - 220px)" }}>

        {/* Sidebar */}
        <aside style={{ borderRight: "1px solid #E8E8E4", padding: "28px 24px", position: "sticky", top: "60px", height: "fit-content" }}>

          {/* Category */}
          <div style={{ marginBottom: "28px" }}>
            <div style={LABEL_STYLE}>Category</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <Link href="/browse" style={chipStyle(isAllCats)}>All</Link>
              {(VALID_CATEGORIES as ProductCategory[]).map(c => (
                <Link key={c} href={catHref(c)} style={chipStyle(filters.categories?.includes(c))}>
                  {CATEGORY_LABEL[c]}
                </Link>
              ))}
            </div>
          </div>

          <Rule />

          {/* Condition */}
          <div style={{ marginBottom: "28px" }}>
            <div style={LABEL_STYLE}>Condition</div>
            <div style={{ display: "flex", gap: "6px" }}>
              {(["S", "A", "B", "C"] as ConditionGrade[]).map(g => {
                const on = filters.conditions?.includes(g);
                const a  = GRADE_ACTIVE[g];
                return (
                  <Link
                    key={g}
                    href={condHref(g)}
                    style={{
                      width: "36px", height: "36px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: 800,
                      textDecoration: "none", flexShrink: 0,
                      border: `1.5px solid ${on ? a.border : "#E8E8E4"}`,
                      background: on ? a.bg : "#fff",
                      color: on ? a.color : "#0a0a0a",
                    }}
                  >
                    {g}
                  </Link>
                );
              })}
            </div>
          </div>

          <Rule />

          {/* Price */}
          <div style={{ marginBottom: "28px" }}>
            <div style={LABEL_STYLE}>Price</div>
            <PriceOpt href={priceHref(undefined)} active={!filters.priceBucket} last={false}>Any price</PriceOpt>
            {VALID_PRICE_BUCKETS.map((b, i) => (
              <PriceOpt key={b} href={priceHref(b)} active={filters.priceBucket === b} last={i === VALID_PRICE_BUCKETS.length - 1}>
                {PRICE_LABEL[b]}
              </PriceOpt>
            ))}
          </div>

          <Rule />

          {/* Negotiable */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", fontWeight: 400, color: "#666" }}>Negotiable only</span>
              <Link href={negHref()} style={{ textDecoration: "none" }}>
                <div style={{ width: "36px", height: "20px", background: filters.negotiableOnly ? "#E8FF4D" : "#E8E8E4", borderRadius: "10px", position: "relative" }}>
                  <div style={{ position: "absolute", width: "14px", height: "14px", background: "#fff", borderRadius: "50%", top: "3px", left: filters.negotiableOnly ? "19px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                </div>
              </Link>
            </div>
          </div>

          <Rule />

          <Link href="/browse" style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", textDecoration: "none", borderBottom: "1px solid #E8E8E4", paddingBottom: "1px", display: "inline-block", marginTop: "4px" }}>
            Reset filters
          </Link>
        </aside>

        {/* Main */}
        <main>
          {listings.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              {listings.map((l, i) => (
                <ListingCard key={l.id} listing={l} priority={i < 3} />
              ))}
            </div>
          ) : (
            <>
              {/* Notify strip */}
              <div style={{ margin: "24px 32px", border: "1px solid #E8E8E4", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#999", marginBottom: "5px" }}>Early access</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.02em" }}>Get notified when listings go live</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "3px", lineHeight: 1.5 }}>{"We'll email you the moment gear matching your filters is listed. No spam."}</div>
                </div>
                <form style={{ display: "flex" }}>
                  <input
                    type="email"
                    name="email"
                    placeholder="your@email.com"
                    style={{ fontFamily: "inherit", fontSize: "12px", padding: "9px 14px", border: "1.5px solid #0a0a0a", borderRight: "none", outline: "none", width: "220px", color: "#0a0a0a", background: "#fff" }}
                  />
                  <button
                    type="submit"
                    style={{ background: "#0a0a0a", color: "#fff", border: "none", padding: "9px 18px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Notify me
                  </button>
                </form>
              </div>

              {/* Grade explainer */}
              <div style={{ borderTop: "1px solid #E8E8E4" }}>
                <div style={{ padding: "20px 32px 0" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#999", marginBottom: "6px" }}>How we grade</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "16px" }}>Every listing condition-verified before going live</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid #E8E8E4" }}>
                  {GRADE_EXPLAINER.map((item, i) => (
                    <div key={item.grade} style={{ padding: "16px 24px", borderRight: i < GRADE_EXPLAINER.length - 1 ? "1px solid #E8E8E4" : "none" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", fontSize: "13px", fontWeight: 800, background: item.bg, color: item.color, marginBottom: "8px" }}>
                        {item.grade}
                      </div>
                      <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>{item.title}</div>
                      <div style={{ fontSize: "11px", color: "#666", lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

// ── Sidebar helpers ───────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em",
  textTransform: "uppercase", color: "#999", marginBottom: "12px",
};

function Rule() {
  return <div style={{ height: "1px", background: "#E8E8E4", margin: "4px 0 24px" }} />;
}

function chipStyle(active: boolean | undefined): React.CSSProperties {
  return {
    fontSize: "11px", fontWeight: 500, padding: "5px 12px",
    border: `1px solid ${active ? "#0a0a0a" : "#E8E8E4"}`,
    color: active ? "#fff" : "#666",
    background: active ? "#0a0a0a" : "#fff",
    textDecoration: "none", display: "inline-block", letterSpacing: "0.01em",
  };
}

function PriceOpt({ href, active, last, children }: { href: string; active: boolean; last: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        fontSize: "12px", fontWeight: active ? 600 : 400,
        color: active ? "#0a0a0a" : "#666",
        padding: "9px 0",
        borderBottom: last ? "none" : "1px solid #E8E8E4",
        display: "flex", alignItems: "center", gap: "8px",
        textDecoration: "none",
      }}
    >
      {active && (
        <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#E8FF4D", flexShrink: 0, boxShadow: "0 0 4px #E8FF4D" }} />
      )}
      {children}
    </Link>
  );
}
