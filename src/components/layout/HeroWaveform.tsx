'use client';

import { useEffect, useRef } from 'react';

const BAR_COUNT = 56;
const BAR_W     = 3.5;
const BAR_GAP   = 4.5;
const BAR_R     = 2;
const MAX_FRAC  = 0.38;

// dotXFrac mirrors the mockup's dotXs array
const REVIEWS = [
  { id: 'rv1', style: { top: '44px',  left: '28px'  },                                    dotXFrac: 0.20, delay: 700,  hold: 5800, cycle: 13000, initials: 'RK', name: 'Rohan K.',     product: 'HD 800 S · Grade A',      text: '"Arrived in mint condition. Exactly as described, maybe better."' },
  { id: 'rv2', style: { top: '32px',  right: '24px' },                                    dotXFrac: 0.72, delay: 3400, hold: 6200, cycle: 14500, initials: 'AT', name: 'Arjun T.',     product: 'LCD-2 Classic · Grade B', text: '"Escrow made me feel safe buying a ₹68k headphone online."' },
  { id: 'rv3', style: { bottom: '110px', left: '18px' },                                  dotXFrac: 0.16, delay: 6100, hold: 5400, cycle: 12000, initials: 'SV', name: 'Siddharth V.', product: 'Chord Mojo 2 · Sold',     text: '"Sold my Mojo 2 in 3 days. Payout was faster than expected."' },
  { id: 'rv4', style: { bottom: '44px', right: '28px' },                                  dotXFrac: 0.80, delay: 1900, hold: 6600, cycle: 15500, initials: 'PM', name: 'Priya M.',     product: 'Blessing 3 · Grade S',    text: '"Grade S IEMs showed up literally sealed. Unbelievable."' },
  { id: 'rv5', style: { top: '42%', left: '50%', transform: 'translateX(-50%) translateY(-50%)' }, dotXFrac: 0.50, delay: 9200, hold: 5000, cycle: 13500, initials: 'NK', name: 'Nikhil K.', product: 'Topping D90SE · Grade A', text: '"Condition grading is honest. Zero surprises."' },
];

export function HeroWaveform() {
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef   = useRef<number>(0);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const panel  = panelRef.current;
    const canvas = canvasRef.current;
    if (!panel || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
      const pos  = i / (BAR_COUNT - 1);
      const c    = Math.exp(-Math.pow((pos - 0.5) * 2.6, 2));
      const base = 0.18 + c * 0.72;
      return { cur: base, tgt: base, base, phase: Math.random() * Math.PI * 2, spd: 0.006 + Math.random() * 0.01 };
    });

    function roundBar(x: number, y: number, w: number, h: number, r: number, topRound: boolean) {
      if (h < 1) return;
      if (h < r * 2) r = h / 2;
      ctx!.beginPath();
      if (topRound) {
        ctx!.moveTo(x + r, y); ctx!.lineTo(x + w - r, y);
        ctx!.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx!.lineTo(x + w, y + h); ctx!.lineTo(x, y + h); ctx!.lineTo(x, y + r);
        ctx!.quadraticCurveTo(x, y, x + r, y);
      } else {
        ctx!.moveTo(x, y); ctx!.lineTo(x + w, y);
        ctx!.lineTo(x + w, y + h - r); ctx!.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx!.lineTo(x + r, y + h); ctx!.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx!.lineTo(x, y);
      }
      ctx!.closePath(); ctx!.fill();
    }

    let tick = 0;

    function draw() {
      // Resize canvas to panel every frame — same as mockup
      const W = canvas!.width  = panel!.offsetWidth;
      const H = canvas!.height = panel!.offsetHeight;
      ctx!.clearRect(0, 0, W, H);

      const totalW = BAR_COUNT * BAR_W + (BAR_COUNT - 1) * BAR_GAP;
      const startX = (W - totalW) / 2;
      const cy = H / 2;

      bars.forEach((bar, i) => {
        bar.tgt = bar.base * (0.5 + 0.5 * Math.sin(tick * bar.spd + bar.phase));
        bar.cur += (bar.tgt - bar.cur) * 0.05;
        const bh  = Math.max(2, bar.cur * MAX_FRAC * H);
        const bx  = startX + i * (BAR_W + BAR_GAP);
        const pos = i / (BAR_COUNT - 1);
        const c   = Math.exp(-Math.pow((pos - 0.5) * 2.4, 2));
        ctx!.fillStyle = `rgba(10,10,10,${0.22 + c * 0.55})`;
        roundBar(bx, cy - bh, BAR_W, bh, BAR_R, true);
        roundBar(bx, cy,      BAR_W, bh * 0.68, BAR_R, false);
      });

      // Update dot positions on the centre line every frame
      REVIEWS.forEach((r, i) => {
        const el = dotRefs.current[i];
        if (!el) return;
        el.style.left = `${startX + r.dotXFrac * totalW}px`;
        el.style.top  = `${cy}px`;
      });

      tick++;
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    // Schedule review cards
    const FADE_DUR = 1600;
    function show(i: number) {
      cardRefs.current[i]?.classList.remove('abw-fading');
      cardRefs.current[i]?.classList.add('abw-visible');
      dotRefs.current[i]?.classList.add('abw-dot-visible');
    }
    function hide(i: number) {
      cardRefs.current[i]?.classList.add('abw-fading');
      dotRefs.current[i]?.classList.remove('abw-dot-visible');
      const t = setTimeout(() => cardRefs.current[i]?.classList.remove('abw-visible', 'abw-fading'), FADE_DUR);
      timers.current.push(t);
    }

    REVIEWS.forEach((r, i) => {
      const t1 = setTimeout(() => {
        show(i);
        const t2 = setTimeout(() => hide(i), r.hold);
        timers.current.push(t2);
        const iv = setInterval(() => {
          show(i);
          const t3 = setTimeout(() => hide(i), r.hold);
          timers.current.push(t3);
        }, r.cycle);
        timers.current.push(iv as unknown as ReturnType<typeof setTimeout>);
      }, r.delay);
      timers.current.push(t1);
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: '480px', overflow: 'hidden', background: 'transparent' }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }}
      />

      {REVIEWS.map((r, i) => (
        <div
          key={r.id}
          ref={el => { cardRefs.current[i] = el; }}
          className="abw-review"
          style={{ ...(r.style as React.CSSProperties), maxWidth: '188px', boxSizing: 'border-box' }}
        >
          <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#0a0a0a', marginBottom: '7px' }}>★★★★★</div>
          <div style={{ fontSize: '11.5px', fontWeight: 400, color: '#444', lineHeight: 1.6, marginBottom: '10px', fontStyle: 'italic' }}>{r.text}</div>
          <div style={{ height: '1px', background: '#f0f0ee', marginBottom: '10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#E8FF4D', flexShrink: 0 }}>
              {r.initials}
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#0a0a0a', lineHeight: 1.2 }}>{r.name}</div>
              <div style={{ fontSize: '9px', color: '#aaa', marginTop: '1px' }}>{r.product}</div>
            </div>
          </div>
        </div>
      ))}

      {REVIEWS.map((_, i) => (
        <div key={`dot-${i}`} ref={el => { dotRefs.current[i] = el; }} className="abw-dot" />
      ))}
    </div>
  );
}
