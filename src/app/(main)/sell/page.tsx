import Link from 'next/link';
import type { Metadata } from 'next';
import { PayoutCalculator } from './PayoutCalculator';

export const metadata: Metadata = {
  title: 'Sell Your Gear — Audiobaaz',
  description: 'List your secondhand audio gear on India\'s managed marketplace. Admin-verified, escrow-protected, Telegram-notified.',
};

const font  = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const serif = '"Instrument Serif", Georgia, serif';
const B     = '#E8E8E4'; // border

const steps = [
  { n: '01', title: 'Create your listing',  tag: '~10 min',       body: 'Walk through our 6-step guided form — product, condition grade, inclusions, photos, and price. Takes about 10 minutes.' },
  { n: '02', title: 'Admin review',         tag: '2–4 hrs',       body: 'We verify your listing for accuracy and completeness. Most reviews finish in 2–4 hours between 9 am and 9 pm IST.' },
  { n: '03', title: 'Go live',              tag: 'Same day',      body: 'Your listing appears in the marketplace. Buyers can save it, make offers, and start negotiations.' },
  { n: '04', title: 'Accept an offer',      tag: 'Your pace',     body: 'You get notified on Telegram the moment an offer arrives. Accept or decline — no pressure. Parallel negotiations are fine; first buyer to pay wins.' },
  { n: '05', title: 'Ship & get paid',      tag: 'UPI payout',    body: 'Ship the gear. Buyer has 48 hours to inspect. If they confirm, escrow releases to your UPI. If they don\'t respond, it auto-releases.' },
];

const features = [
  { title: 'Escrow protection',          body: 'Funds are collected before the buyer receives the gear. You are never left waiting for payment.' },
  { title: 'Dispute support',            body: 'If a buyer raises a dispute, our team arbitrates and protects you against false claims.' },
  { title: 'Telegram notifications',     body: 'Every offer, payment, and shipping update lands directly in your Telegram — no app to install.' },
  { title: '48-hour inspection window',  body: 'Buyers have 48 hours to raise a concern. After that, escrow auto-releases to you — no action needed.' },
];

const timeline = [
  { label: 'Submit listing',    time: 'Day 0',          done: true,  active: false },
  { label: 'Admin review',      time: '2–4 hrs',        done: true,  active: false },
  { label: 'Go live',           time: 'Same day',       done: false, active: true  },
  { label: 'Buyer inspection',  time: '48 hrs',         done: false, active: false },
  { label: 'UPI payout',        time: 'After inspection', done: false, active: false },
];

export default function SellPage() {
  return (
    <div style={{ fontFamily: font, color: '#0a0a0a', background: '#fff' }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '520px', borderBottom: `1px solid ${B}` }}>

        {/* Left */}
        <div style={{ padding: '80px 64px 80px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '28px', borderRight: `1px solid ${B}` }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content', border: `1px solid ${B}`, padding: '5px 14px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#999' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', flexShrink: 0, display: 'inline-block' }} />
            10% fee only when you sell
          </div>

          <h1 style={{ fontSize: 'clamp(48px, 5.5vw, 72px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.92, color: '#0a0a0a' }}>
            Sell your gear to people<br />
            <em style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400, display: 'block', marginTop: '4px' }}>who actually care.</em>
          </h1>

          <p style={{ fontSize: '15px', color: '#666', lineHeight: 1.7, maxWidth: '420px' }}>
            Audiobaaz is India&apos;s managed secondhand audio marketplace. We verify every listing, protect every transaction, and handle the back-and-forth so you can focus on finding the right buyer.
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link href="/sell/new" style={{ background: '#E8FF4D', color: '#0a0a0a', padding: '13px 28px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Start a listing
            </Link>
          </div>
        </div>

        {/* Right — calculator */}
        <div style={{ background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 48px' }}>
          <PayoutCalculator />
        </div>
      </section>

      {/* ── Video ────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 40px', borderBottom: `1px solid ${B}` }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#999', marginBottom: '12px' }}>See how it works</div>
        <div style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.92, marginBottom: '32px' }}>
          From listing to <em style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400 }}>payout.</em>
        </div>
        <div style={{ border: `1px solid ${B}`, overflow: 'hidden', maxWidth: '860px' }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', display: 'block' }}
          >
            <source src="/signin-story.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section style={{ padding: '72px 40px', borderBottom: `1px solid ${B}` }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#999', marginBottom: '12px' }}>Process</div>
        <div style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.92, marginBottom: '48px' }}>
          How it works.<br />
          <em style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400 }}>Five steps, start to payout.</em>
        </div>

        <div style={{ maxWidth: '780px' }}>
          {steps.map(({ n, title, tag, body }) => (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '32px', alignItems: 'start', padding: '28px 0', borderBottom: `1px solid ${B}` }}>
              <div style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: B }}>{n}</div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>{title}</div>
                <div style={{ fontSize: '14px', color: '#666', lineHeight: 1.7, maxWidth: '560px' }}>{body}</div>
                <span style={{ display: 'inline-block', marginTop: '10px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', border: `1px solid ${B}`, padding: '3px 10px' }}>{tag}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fee ──────────────────────────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${B}`, minHeight: '360px' }}>
        <div style={{ padding: '72px 64px 72px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px', borderRight: `1px solid ${B}` }}>
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#999' }}>Pricing</div>
          <div style={{ fontSize: 'clamp(36px, 4.5vw, 56px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.92 }}>One simple fee.</div>
          <p style={{ fontSize: '15px', color: '#666', lineHeight: 1.7, maxWidth: '380px' }}>
            We charge <strong style={{ color: '#0a0a0a' }}>10%</strong> when your gear sells. No listing fees. No subscription. No fine print. If it does not sell, you pay nothing.
          </p>
        </div>

        <div style={{ padding: '72px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#FAFAF8' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#999', marginBottom: '20px' }}>Example payout</div>
          {[
            { label: 'Your listing price', val: '₹10,000', color: '#0a0a0a' },
            { label: 'Platform fee (10%)', val: '− ₹1,000', color: '#E24B4A' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', borderBottom: `1px solid ${B}` }}>
              <span style={{ fontSize: '13px', color: '#666' }}>{label}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.02em', color }}>{val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', marginTop: '4px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#0a0a0a' }}>You receive</span>
            <span style={{ fontSize: '28px', fontWeight: 900, color: '#0a0a0a', letterSpacing: '-0.04em' }}>₹9,000</span>
          </div>
        </div>
      </section>

      {/* ── We've got your back ───────────────────────────────────────── */}
      <section style={{ padding: '72px 40px', borderBottom: `1px solid ${B}` }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#999', marginBottom: '12px' }}>Seller protection</div>
        <div style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.92, marginBottom: '16px' }}>We&apos;ve got your back.</div>
        <p style={{ fontSize: '15px', color: '#666', marginBottom: '40px', maxWidth: '440px', lineHeight: 1.6 }}>Audiobaaz manages the hard parts so you don&apos;t have to.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: B, border: `1px solid ${B}`, maxWidth: '860px' }}>
          {features.map(({ title, body }) => (
            <div key={title} style={{ background: '#fff', padding: '28px 32px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E8FF4D', marginBottom: '14px' }} />
              <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em', marginBottom: '8px' }}>{title}</div>
              <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.65 }}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Timeline ─────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 40px', borderBottom: `1px solid ${B}` }}>
        <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#999', marginBottom: '12px' }}>Timeline</div>
        <div style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.92, marginBottom: '40px' }}>What to expect, and when.</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', maxWidth: '860px', position: 'relative', marginTop: '40px' }}>
          {/* Connecting line */}
          <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', height: '1px', background: B, zIndex: 0 }} />

          {timeline.map(({ label, time, done, active }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: '20px', height: '20px',
                border: `2px solid ${active ? '#E8FF4D' : done ? '#0a0a0a' : B}`,
                background: active ? '#E8FF4D' : done ? '#0a0a0a' : '#fff',
                borderRadius: '50%',
              }} />
              <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '-0.01em' }}>{label}</div>
              <div style={{ fontSize: '10px', color: '#999', fontWeight: 500 }}>{time}</div>
            </div>
          ))}
        </div>

        <p style={{ marginTop: '28px', fontSize: '11px', color: '#999', lineHeight: 1.5, maxWidth: '540px' }}>
          Reviews happen between 9 am and 9 pm IST. Listings submitted outside those hours are reviewed the following morning.
        </p>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section style={{ background: '#0a0a0a', padding: '96px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <div style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.92, color: '#fff' }}>
          Ready to find your gear<br />
          <em style={{ fontFamily: serif, fontStyle: 'italic', fontWeight: 400, color: '#E8FF4D' }}>a new home?</em>
        </div>
        <p style={{ fontSize: '14px', color: '#555', maxWidth: '360px', lineHeight: 1.6 }}>
          It takes about 10 minutes to create a listing. We&apos;ll take it from there.
        </p>
        <Link href="/sell/new" style={{ background: '#E8FF4D', color: '#0a0a0a', padding: '16px 40px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', marginTop: '8px' }}>
          Start a listing
        </Link>
      </section>

    </div>
  );
}
