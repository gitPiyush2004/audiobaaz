export const dynamic = 'force-dynamic';

import Link from "next/link";
import { getBrowseListings } from "@/lib/listings/browse";
import { ListingCard } from "@/components/listing/ListingCard";
import { Ticker } from "@/components/layout/Ticker";
import { HeroWaveform } from "@/components/layout/HeroWaveform";

export default async function HomePage() {
  const listings  = await getBrowseListings({ sort: "newest", limit: 10 });
  const gridItems = listings.slice(0, 5);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #E8E8E4', minHeight: '480px' }}>

        {/* Left */}
        <div style={{ padding: '48px 40px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px', borderRight: '1px solid #E8E8E4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#999' }}>
              Managed · Verified · Trusted
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(44px, 5vw, 72px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.92, color: '#0a0a0a', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            The market for<br />
            <em style={{ fontFamily: 'var(--font-serif), "Instrument Serif", Georgia, serif', fontStyle: 'italic', fontWeight: 400 }}>
              audio obsessives.
            </em>
          </h1>

          <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.7, maxWidth: '420px', fontWeight: 400 }}>
            India&apos;s managed secondhand marketplace for headphones, speakers, DACs, amps, and more.
            Every listing condition-graded. Every transaction escrow-protected.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link href="/browse" style={{ background: '#E8FF4D', color: '#0a0a0a', border: 'none', padding: '13px 28px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 0, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} className="transition-opacity hover:opacity-80">
              Browse Listings
            </Link>
            <Link href="/sell" style={{ background: 'transparent', color: '#0a0a0a', border: '1.5px solid #0a0a0a', padding: '13px 28px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 0, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} className="transition-opacity hover:opacity-60">
              Sell Your Gear
            </Link>
          </div>
        </div>

        {/* Right — waveform fills the grid cell directly */}
        <HeroWaveform />
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
