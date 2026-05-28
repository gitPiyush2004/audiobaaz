"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/formatting";
import { validateOfferAmount } from "@/lib/offers/draft";
import type { OfferRange } from "@/lib/offers/types";

export interface OfferAmountInputProps {
  range:    OfferRange;
  /**
   * Initial amount in PAISE. Falls back to the midpoint of the range
   * when omitted. If the supplied value is out of range, it is clamped.
   */
  defaultValue?: number;
  /** Form input name. The hidden input is what gets submitted. */
  name?: string;
  className?: string;
}

/**
 * Controlled offer amount picker. Slider + numeric input, both bound to
 * the same paise value. Live validation message renders below.
 *
 * Pure UI. No submit logic, no fetch, no awareness of where the value
 * goes — the parent form decides. The hidden input is what gets posted.
 *
 * Currency math is in paise everywhere (per ENGINEERING.md money rule). The
 * slider's `step` is ₹100 = 100 paise to keep values clean, but the
 * numeric input accepts any rupee amount which is then converted.
 */
export function OfferAmountInput({
  range,
  defaultValue,
  name = "offer",
  className,
}: OfferAmountInputProps) {
  const initial = clamp(defaultValue ?? Math.round((range.min + range.max) / 2), range);
  const [paise, setPaise] = useState<number>(initial);

  const error = validateOfferAmount(paise, range);
  const sliderId = useId();
  const inputId  = useId();

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPaise(Number.parseInt(e.target.value, 10));
  };

  const handleNumeric = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rupees = e.target.value.replace(/[^0-9]/g, "");
    if (rupees === "") {
      setPaise(0);
      return;
    }
    const next = Number.parseInt(rupees, 10) * 100;
    setPaise(Number.isFinite(next) ? next : 0);
  };

  const pct = range.max === range.min
    ? 100
    : Math.round(((paise - range.min) / (range.max - range.min)) * 100);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <input type="hidden" name={name} value={paise} />

      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wider text-dim-foreground">
          Your offer
        </label>
        <span className="text-[11px] text-muted-foreground">
          Asking {formatPrice(range.max)}
        </span>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
        <span className="font-mono text-base text-muted-foreground">₹</span>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={Math.round(paise / 100).toString()}
          onChange={handleNumeric}
          className="w-full bg-transparent font-mono text-lg font-semibold text-foreground outline-none placeholder:text-dim-foreground"
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-invalid={error ? true : undefined}
        />
      </div>

      <input
        id={sliderId}
        type="range"
        min={range.min}
        max={range.max}
        step={100}
        value={Math.min(Math.max(paise, range.min), range.max)}
        onChange={handleSlider}
        aria-label="Offer amount slider"
        className={cn(
          "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-grab",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:cursor-grab",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        )}
        style={{
          background: `linear-gradient(to right, rgb(var(--accent-ch)) 0%, rgb(var(--accent-ch)) ${pct}%, var(--surface-2) ${pct}%, var(--surface-2) 100%)`,
        }}
      />

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-mono">{formatPrice(range.min)}</span>
        <span className="font-mono">{formatPrice(range.max)}</span>
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}

function clamp(value: number, range: OfferRange): number {
  if (value < range.min) return range.min;
  if (value > range.max) return range.max;
  return value;
}
