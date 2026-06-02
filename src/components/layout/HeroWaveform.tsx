'use client';

import { useEffect, useRef } from 'react';

const BAR_COUNT = 54;
const BAR_W     = 3.5;
const BAR_GAP   = 4.2;
const BAR_R     = 2;
const MAX_FRAC  = 0.38;

const HOLD    = 5000;
const OUT_DUR = 1000;
const GAP     = 1200;

type Corner = 'tl' | 'tr' | 'bl' | 'br';

const REVIEWS: { av: string; name: string; prod: string; text: string; corner: Corner }[] = [
  { av: 'RK', name: 'Rohan K.',     prod: 'HD 800 S · Grade A',            text: '"Arrived in mint condition. Exactly as described, maybe better."',     corner: 'tl' },
  { av: 'AT', name: 'Arjun T.',     prod: 'LCD-2 Classic · Grade B',        text: '"Escrow made me feel safe buying a ₹68k headphone from a stranger."', corner: 'tr' },
  { av: 'SV', name: 'Siddharth V.', prod: 'Chord Mojo 2 · Sold',            text: '"Sold my Mojo 2 in 3 days. Payout was faster than expected."',        corner: 'bl' },
  { av: 'PM', name: 'Priya M.',     prod: 'Blessing 3 · Grade S',           text: '"Grade S IEMs showed up literally sealed. Unbelievable value."',      corner: 'br' },
  { av: 'NK', name: 'Nikhil K.',    prod: 'Topping D90SE · Grade A',        text: '"Condition grading is honest. Zero surprises on arrival."',           corner: 'tl' },
  { av: 'AS', name: 'Ananya S.',    prod: 'Beyerdynamic DT 1990 · Grade A', text: '"The whole process felt premium. Will buy again for sure."',          corner: 'br' },
];

export function HeroWaveform() {
  const panelRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bTextRef  = useRef<HTMLDivElement>(null);
  const bAvRef    = useRef<HTMLDivElement>(null);
  const bNameRef  = useRef<HTMLDivElement>(null);
  const bProdRef  = useRef<HTMLDivElement>(null);
  const rafRef    = useRef<number>(0);
  const timers    = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const panel  = panelRef.current;
    const canvas = canvasRef.current;
    const bubble = bubbleRef.current;
    if (!panel || !canvas || !bubble) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Waveform ──
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
        ctx!.fillStyle = `rgba(10,10,10,${0.2 + c * 0.58})`;
        roundBar(bx, cy - bh, BAR_W, bh, BAR_R, true);
        roundBar(bx, cy,      BAR_W, bh * 0.68, BAR_R, false);
      });
      tick++;
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    // ── Bubble cycle ──
    let current = 0;

    function showNext() {
      if (!bubble) return;
      const r = REVIEWS[current % REVIEWS.length];
      current++;

      bubble.className = `hbw-bubble corner-${r.corner}`;
      if (bTextRef.current) bTextRef.current.textContent = r.text;
      if (bAvRef.current)   bAvRef.current.textContent   = r.av;
      if (bNameRef.current) bNameRef.current.textContent = r.name;
      if (bProdRef.current) bProdRef.current.textContent = r.prod;

      // Force reflow so animation restarts cleanly
      void bubble.offsetWidth;
      bubble.classList.add(`in-${r.corner}`);

      const t1 = setTimeout(() => {
        bubble.classList.remove(`in-${r.corner}`);
        bubble.classList.add(`out-${r.corner}`);

        const t2 = setTimeout(() => {
          bubble.classList.remove(`out-${r.corner}`);
          bubble.style.opacity = '0';
          const t3 = setTimeout(showNext, GAP);
          timers.current.push(t3);
        }, OUT_DUR);
        timers.current.push(t2);
      }, HOLD);
      timers.current.push(t1);
    }

    const t0 = setTimeout(showNext, 1200);
    timers.current.push(t0);

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
      <div ref={bubbleRef} className="hbw-bubble">
        <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#0a0a0a', marginBottom: '7px' }}>★★★★★</div>
        <div
          ref={bTextRef}
          style={{ fontSize: '11.5px', color: '#444', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '11px' }}
        />
        <div style={{ height: '1px', background: '#f0f0ee', marginBottom: '10px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            ref={bAvRef}
            style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#E8FF4D', flexShrink: 0, letterSpacing: '0.04em' }}
          />
          <div>
            <div ref={bNameRef} style={{ fontSize: '10px', fontWeight: 700, color: '#0a0a0a', lineHeight: 1.2 }} />
            <div ref={bProdRef} style={{ fontSize: '9px', color: '#aaa', marginTop: '2px' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
