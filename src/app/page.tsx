export const dynamic = 'force-dynamic';

import Link from "next/link";
import Image from "next/image";
import { getBrowseListings } from "@/lib/listings/browse";
import { ListingCard } from "@/components/listing/ListingCard";
import { Ticker } from "@/components/layout/Ticker";
import { formatPrice } from "@/lib/utils/formatting";

const GRADE_STYLE: Record<string, { background: string; color: string }> = {
  S: { background: '#DBEAFE', color: '#1D4ED8' },
  A: { background: '#DCFCE7', color: '#15803D' },
  B: { background: '#FEF9C3', color: '#A16207' },
  C: { background: '#FEF3C7', color: '#92400E' },
  D: { background: '#FEE2E2', color: '#B91C1C' },
};

export default async function HomePage() {
  const listings  = await getBrowseListings({ sort: "newest", limit: 10 });
  const featured  = listings[0] ?? null;
  const gridItems = listings.slice(featured ? 1 : 0, 6);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section style={{ borderBottom: '1px solid #E8E8E4', padding: '80px 0 72px' }}>
      <div style={{
        padding: '0 40px',
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '60px',
        alignItems: 'center',
      }}>

        {/* Left */}
        <div>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#999' }}>
              Managed · Verified · Trusted
            </span>
          </div>

          {/* Headline — serif italic flourish */}
          <h1 style={{
            fontSize: 'clamp(52px, 5.5vw, 80px)',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            lineHeight: 0.92,
            color: '#0a0a0a',
            marginBottom: '28px',
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
          }}>
            The market for<br />
            <em style={{
              fontFamily: 'var(--font-serif), "Instrument Serif", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              color: '#0a0a0a',
            }}>
              audio obsessives.
            </em>
          </h1>

          <p style={{ fontSize: '15px', color: '#666', lineHeight: 1.7, maxWidth: '460px', marginBottom: '36px', fontWeight: 400 }}>
            India&apos;s managed secondhand marketplace for headphones, speakers, DACs, amps, and more.
            Every listing condition-graded. Every transaction escrow-protected.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Accent 1/2 */}
            <Link href="/browse" style={{ background: '#E8FF4D', color: '#0a0a0a', border: 'none', padding: '13px 28px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 0, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} className="transition-opacity hover:opacity-80">
              Browse Listings
            </Link>
            <Link href="/sell" style={{ background: 'transparent', color: '#0a0a0a', border: '1.5px solid #0a0a0a', padding: '13px 28px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 0, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} className="transition-opacity hover:opacity-60">
              Sell Your Gear
            </Link>
          </div>
        </div>

        {/* Right — featured listing card */}
        {featured ? (
          <Link href={`/listing/${featured.slug ?? featured.id}`} style={{ border: '1px solid #E8E8E4', background: '#FFFFFF', display: 'block', textDecoration: 'none' }} className="transition-opacity hover:opacity-90">
            <div style={{ aspectRatio: '4/3', background: '#F5F5F2', position: 'relative', overflow: 'hidden' }}>
              {featured.photos[0] ? (
                <Image src={featured.photos[0]} alt={featured.product_name} fill sizes="380px" className="object-cover" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '11px', color: '#999' }}>
                  No photo
                </div>
              )}
              <span style={{ position: 'absolute', bottom: '12px', left: '12px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999' }}>
                Featured listing
              </span>
            </div>
            <div style={{ padding: '16px', borderTop: '1px solid #E8E8E4' }}>
              <p style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '3px' }}>
                {featured.brand}
              </p>
              <p style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.02em', color: '#0a0a0a', marginBottom: '10px' }}>
                {featured.product_name}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', color: '#0a0a0a' }}>
                  {formatPrice(featured.asking_price)}
                </span>
                <span style={{ ...GRADE_STYLE[featured.condition_grade], fontSize: '9px', fontWeight: 700, padding: '3px 8px' }}>
                  {featured.condition_grade} — {featured.condition_grade === 'S' ? 'Sealed' : featured.condition_grade === 'A' ? 'Like new' : featured.condition_grade === 'B' ? 'Excellent' : featured.condition_grade === 'C' ? 'Good' : 'Fair'}
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <div style={{ border: '1px solid #E8E8E4', aspectRatio: '4/3', background: '#F5F5F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '11px', color: '#999' }}>No featured listing yet</span>
          </div>
        )}
      </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────── */}
      <Ticker listings={listings} />

      {/* ── Stats ────────────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #E8E8E4' }}>
        {[
          { n: '100%',          l: 'Escrow-protected' },
          { n: 'Every listing', l: 'Condition-graded' },
          { n: '48hr',          l: 'Dispute window' },
        ].map((s, i) => (
          <div key={s.l} style={{ padding: '28px 40px', borderRight: i < 2 ? '1px solid #E8E8E4' : 'none' }}>
            <p style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: '#0a0a0a', marginBottom: '5px' }}>
              {s.n}
            </p>
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999' }}>
              {s.l}
            </p>
          </div>
        ))}
      </section>

      {/* ── Listings grid ────────────────────────────────── */}
      <section style={{ padding: '0 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '32px 0 20px', borderBottom: '1px solid #E8E8E4' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999', marginBottom: '3px' }}>
              Sennheiser · Audeze · Chord · iFi · more
            </p>
            <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: '#0a0a0a' }}>
              Recently listed
            </h2>
          </div>
          <Link href="/browse" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0a0a0a', textDecoration: 'none', borderBottom: '1.5px solid #0a0a0a', paddingBottom: '1px' }}>
            View all
          </Link>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5,1fr)',
          borderLeft: '1px solid #E8E8E4',
          borderTop: '1px solid #E8E8E4',
          marginBottom: '48px',
        }}>
          {gridItems.length > 0 ? gridItems.map(l => (
            <ListingCard key={l.id} listing={l} />
          )) : (
            <div style={{ gridColumn: 'span 5', padding: '64px', textAlign: 'center', color: '#999', fontSize: '14px', borderRight: '1px solid #E8E8E4', borderBottom: '1px solid #E8E8E4' }}>
              No listings yet. <Link href="/sell" style={{ color: '#0a0a0a', textDecoration: 'underline' }}>List your gear</Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Trust pillars ────────────────────────────────── */}
      <section style={{ borderTop: '1px solid #E8E8E4', borderBottom: '1px solid #E8E8E4', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '0 40px', marginBottom: '48px' }}>
        {[
          { n: '01', title: 'Escrow-protected payments', body: "Your money is held securely until you've inspected the gear and confirmed it matches the listing." },
          { n: '02', title: 'Every listing verified',    body: 'Each item is condition-graded by our team before going live. S, A, B — no surprises on arrival.' },
          { n: '03', title: '48-hour dispute window',    body: 'Something wrong? You have 48 hours after delivery to raise a dispute. We handle it.' },
        ].map((t, i) => (
          <div key={t.n} style={{ padding: '32px', borderRight: i < 2 ? '1px solid #E8E8E4' : 'none', paddingLeft: i === 0 ? 0 : '32px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#999', marginBottom: '8px' }}>
              {t.n}
            </p>
            <p style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px', color: '#0a0a0a' }}>
              {t.title}
            </p>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, fontWeight: 400 }}>
              {t.body}
            </p>
          </div>
        ))}
      </section>
    </>
  );
}
