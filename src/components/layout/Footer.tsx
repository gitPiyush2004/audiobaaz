import Link from 'next/link';

export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #E8E8E4', padding: '28px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1 }}>
        <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 800, fontSize: '18px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0a0a0a' }}>AUDIO</span>
        <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 800, fontSize: '18px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0a0a0a', textDecoration: 'underline', textDecorationColor: '#E8FF4D', textDecorationThickness: '3px', textUnderlineOffset: '3px' }}>BAAZ</span>
      </span>
      <span style={{ fontSize: '11px', color: '#999', letterSpacing: '0.04em' }}>
        © 2025 Lapidaria. All rights reserved.
      </span>
      <div style={{ display: 'flex', gap: '20px' }}>
        {['About', 'How it works', 'Terms', 'Privacy'].map(l => (
          <Link key={l} href="#" style={{ fontSize: '11px', color: '#999', textDecoration: 'none', letterSpacing: '0.04em', transition: 'color 0.1s' }}
            className="hover:text-[#0a0a0a]"
          >
            {l}
          </Link>
        ))}
      </div>
    </footer>
  );
}
