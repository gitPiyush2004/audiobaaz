'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
}

export function Logo({ size = 38, showWordmark = true }: LogoProps) {
  const vinylRef = useRef<SVGGElement>(null);
  const glowRefs = useRef<(SVGPolylineElement | null)[]>([null, null, null, null]);

  useEffect(() => {
    const t1 = setTimeout(() => {
      if (vinylRef.current) vinylRef.current.style.animationPlayState = 'running';
    }, 600);
    const t2 = setTimeout(() => {
      glowRefs.current.forEach(el => {
        if (el) el.style.animationPlayState = 'running';
      });
    }, 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function onEnter() {
    glowRefs.current.forEach(el => {
      if (!el) return;
      el.style.animationPlayState = 'paused';
      el.style.opacity = '1';
    });
  }
  function onLeave() {
    glowRefs.current.forEach(el => {
      if (!el) return;
      el.style.animationPlayState = 'running';
      el.style.opacity = '';
    });
  }

  return (
    <Link
      href="/"
      aria-label="Audiobaaz home"
      style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', flexShrink: 0 }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        aria-hidden
      >
        <style>{`
          @keyframes vinylSpin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes arrowPulse {
            0%   { opacity: 0; }
            25%  { opacity: 1; }
            65%  { opacity: 1; }
            100% { opacity: 0; }
          }
          #ab-vinyl {
            transform-box: fill-box;
            transform-origin: center;
            animation: vinylSpin 6s linear infinite;
            animation-play-state: paused;
          }
          .ab-ag {
            animation: arrowPulse 3.5s ease-in-out infinite;
            animation-play-state: paused;
            opacity: 0;
          }
          #ab-ag-r { animation-delay: 0.35s; }
          #ab-ag-b { animation-delay: 0.70s; }
          #ab-ag-l { animation-delay: 1.05s; }
        `}</style>

        {/* 1. Outer body */}
        <circle cx="60" cy="60" r="58" fill="#111111" />
        {/* 2. Silver rim */}
        <circle cx="60" cy="60" r="58" fill="none" stroke="#888888" strokeWidth="2" />
        {/* 3. Groove rings */}
        <circle cx="60" cy="60" r="53" fill="none" stroke="#333333" strokeWidth="1.2" />
        <circle cx="60" cy="60" r="47" fill="none" stroke="#2a2a2a" strokeWidth="1" />
        <circle cx="60" cy="60" r="41" fill="none" stroke="#333333" strokeWidth="1.2" />
        {/* 4. Inner wheel ring */}
        <circle cx="60" cy="60" r="36" fill="#181818" />
        <circle cx="60" cy="60" r="36" fill="none" stroke="#3a3a3a" strokeWidth="1" />
        {/* 5. Center vinyl (rotating) */}
        <g id="ab-vinyl" ref={vinylRef}>
          <circle cx="60" cy="60" r="24" fill="#141414" />
          <circle cx="60" cy="60" r="24" fill="none" stroke="#303030" strokeWidth="1" />
          <circle cx="60" cy="60" r="20" fill="none" stroke="#252525" strokeWidth="0.8" />
          <circle cx="60" cy="60" r="16" fill="none" stroke="#202020" strokeWidth="0.8" />
          <circle cx="60" cy="60" r="11" fill="#1e1a14" />
          <circle cx="60" cy="60" r="11" fill="none" stroke="#2e2820" strokeWidth="0.8" />
          <circle cx="60" cy="50" r="1.5" fill="#444444" />
          <circle cx="60" cy="60" r="2.5" fill="#ffffff" fillOpacity="0.7" />
        </g>
        {/* 6. Arrow base layer */}
        <polyline points="56,30 60,25 64,30" fill="none" stroke="#444444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="90,56 95,60 90,64" fill="none" stroke="#444444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="56,90 60,95 64,90" fill="none" stroke="#444444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="30,56 25,60 30,64" fill="none" stroke="#444444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* 7. Arrow glow layer */}
        <polyline
          id="ab-ag-t" className="ab-ag"
          ref={el => { glowRefs.current[0] = el; }}
          points="56,30 60,25 64,30"
          fill="none" stroke="#E8FF4D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 3px #E8FF4D)' }}
        />
        <polyline
          id="ab-ag-r" className="ab-ag"
          ref={el => { glowRefs.current[1] = el; }}
          points="90,56 95,60 90,64"
          fill="none" stroke="#E8FF4D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 3px #E8FF4D)' }}
        />
        <polyline
          id="ab-ag-b" className="ab-ag"
          ref={el => { glowRefs.current[2] = el; }}
          points="56,90 60,95 64,90"
          fill="none" stroke="#E8FF4D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 3px #E8FF4D)' }}
        />
        <polyline
          id="ab-ag-l" className="ab-ag"
          ref={el => { glowRefs.current[3] = el; }}
          points="30,56 25,60 30,64"
          fill="none" stroke="#E8FF4D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 3px #E8FF4D)' }}
        />
      </svg>

      {showWordmark && (
        <span style={{ marginLeft: '10px', lineHeight: 1, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
          <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 800, fontSize: '18px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0a0a0a' }}>AUDIO</span>
          <span style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: 800, fontSize: '18px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0a0a0a', background: '#E8FF4D', padding: '0 3px' }}>BAAZ</span>
        </span>
      )}
    </Link>
  );
}
