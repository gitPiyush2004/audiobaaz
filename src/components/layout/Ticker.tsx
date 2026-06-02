'use client';

import type { ListingCardData } from '@/lib/listings/types';
import { formatPrice } from '@/lib/utils/formatting';

const MOCK: { brand: string; name: string; price: number; grade: string }[] = [
  { brand: 'Sennheiser',   name: 'HD 800 S',       price: 14500000, grade: 'A' },
  { brand: 'Audeze',       name: 'LCD-2 Classic',   price: 6800000,  grade: 'B' },
  { brand: 'Chord',        name: 'Mojo 2',          price: 3200000,  grade: 'A' },
  { brand: 'iFi',          name: 'xDSD Gryphon',    price: 2400000,  grade: 'A' },
  { brand: 'Moondrop',     name: 'Blessing 3',      price: 1800000,  grade: 'S' },
  { brand: 'Sony',         name: 'WH-1000XM5',      price: 1900000,  grade: 'A' },
  { brand: 'HiFiMan',      name: 'Sundara',         price: 2800000,  grade: 'B' },
  { brand: 'Topping',      name: 'D90SE',           price: 3500000,  grade: 'S' },
  { brand: 'Beyerdynamic', name: 'DT 1990 Pro',     price: 4200000,  grade: 'A' },
  { brand: 'Focal',        name: 'Elear',           price: 5500000,  grade: 'B' },
];

const GRADE_STYLE: Record<string, { background: string; color: string }> = {
  S: { background: '#DBEAFE', color: '#1D4ED8' },
  A: { background: '#DCFCE7', color: '#15803D' },
  B: { background: '#FEF9C3', color: '#A16207' },
  C: { background: '#FEF3C7', color: '#92400E' },
  D: { background: '#FEE2E2', color: '#B91C1C' },
};

interface Props { listings: ListingCardData[]; }

export function Ticker({ listings }: Props) {
  const realItems = listings.slice(0, 8).map(l => ({
    brand: l.brand,
    name:  l.product_name,
    price: l.asking_price,
    grade: l.condition_grade as string,
  }));
  const items = realItems.length >= 5 ? realItems : [...realItems, ...MOCK.slice(0, 10 - realItems.length)];
  const doubled = [...items, ...items];

  return (
    <div
      style={{ borderBottom: '1px solid #E8E8E4', overflow: 'hidden', background: '#FFFFFF', position: 'relative' }}
    >
      {/* Fade masks */}
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: '80px', background: 'linear-gradient(to right, #fff, transparent)', zIndex: 2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: '0 0 0 auto', width: '80px', background: 'linear-gradient(to left, #fff, transparent)', zIndex: 2, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', width: 'max-content', animation: 'tickerScroll 32s linear infinite', padding: '12px 0' }}>
        <style>{`
          @keyframes tickerScroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
        `}</style>
        {doubled.map((item, i) => {
          const gs = GRADE_STYLE[item.grade] ?? GRADE_STYLE.D;
          return (
            <div
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                border: '1px solid #E8E8E4',
                padding: '7px 16px',
                marginRight: '10px',
                background: '#FFFFFF',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999' }}>
                {item.brand}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#0a0a0a', whiteSpace: 'nowrap' }}>
                {item.name}
              </span>
              <span style={{ fontFamily: 'var(--font-mono), "JetBrains Mono", monospace', fontSize: '12px', fontWeight: 600, color: '#0a0a0a', letterSpacing: '-0.02em' }}>
                {formatPrice(item.price)}
              </span>
              <span style={{ ...gs, fontSize: '9px', fontWeight: 700, padding: '2px 6px' }}>
                {item.grade}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
