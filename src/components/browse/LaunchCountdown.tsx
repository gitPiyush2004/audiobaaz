"use client";

import { useEffect, useState } from "react";

const LAUNCH = new Date("2026-07-07T00:00:00+05:30");

function diff() {
  const ms = LAUNCH.getTime() - Date.now();
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function LaunchCountdown() {
  const [t, setT] = useState(diff);

  useEffect(() => {
    const id = setInterval(() => setT(diff()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      borderBottom: "1px solid #E8E8E4",
      padding: "72px 40px 64px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "0",
      textAlign: "center",
    }}>
      {/* Eyebrow */}
      <div style={{
        fontSize: "9px", fontWeight: 700, letterSpacing: "0.22em",
        textTransform: "uppercase", color: "#999", marginBottom: "28px",
      }}>
        Curated gear goes live in
      </div>

      {/* Clock */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, auto)",
        gap: "0",
        marginBottom: "8px",
      }}>
        {[
          { v: t.d,  l: "Days" },
          { v: t.h,  l: "Hrs"  },
          { v: t.m,  l: "Min"  },
          { v: t.s,  l: "Sec"  },
        ].map(({ v, l }, i) => (
          <div key={l} style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{
              padding: "0 32px",
              borderRight: i < 3 ? "1px solid #E8E8E4" : "none",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
            }}>
              <span style={{
                fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                fontSize: "clamp(48px, 6vw, 80px)",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "#0a0a0a",
                tabularNums: "tabular-nums",
              } as React.CSSProperties}>
                {pad(v)}
              </span>
              <span style={{
                fontSize: "8px", fontWeight: 700, letterSpacing: "0.2em",
                textTransform: "uppercase", color: "#bbb",
              }}>
                {l}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: "40px", height: "2px", background: "#E8FF4D", margin: "32px 0 28px" }} />

      {/* Sub-copy */}
      <p style={{
        fontSize: "13px", color: "#666", lineHeight: 1.7,
        maxWidth: "340px", marginBottom: "28px",
      }}>
        We&apos;re onboarding early sellers and curating the first batch of listings.
        List your gear now — it goes live the moment we launch.
      </p>

      {/* CTA */}
      <a
        href="/sell"
        style={{
          background: "#E8FF4D", color: "#0a0a0a",
          padding: "13px 32px",
          fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: "8px",
        }}
      >
        List your gear early
        <span style={{ fontSize: "14px" }}>↗</span>
      </a>
    </div>
  );
}
