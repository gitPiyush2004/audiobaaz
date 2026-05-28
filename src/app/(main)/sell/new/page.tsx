'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/formatting';

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = ['Product type', 'Product details', 'Condition', 'Inclusions', 'Photos', 'Price & terms'];

const PRODUCT_TYPES = [
  { id: 'iem',      label: 'IEM',       desc: 'In-ear monitor' },
  { id: 'headphone',label: 'Headphone', desc: 'Over / on-ear' },
  { id: 'dac',      label: 'DAC',       desc: 'Digital to analogue' },
  { id: 'amp',      label: 'Amp',       desc: 'Amplifier' },
  { id: 'dac_amp',  label: 'DAC + Amp', desc: 'Combined unit' },
  { id: 'cable',    label: 'Cable',     desc: 'IEM / headphone cable' },
  { id: 'source',   label: 'Source',    desc: 'DAP / streamer' },
  { id: 'other',    label: 'Other',     desc: 'Accessories & more' },
];

const GRADES = [
  { id: 'S', label: 'Sealed',    desc: 'Unopened, factory sealed.',             colorClass: 'border-grade-s text-grade-s' },
  { id: 'A', label: 'Mint',      desc: 'Used but flawless. No visible wear.',   colorClass: 'border-grade-a text-grade-a' },
  { id: 'B', label: 'Excellent', desc: 'Minor signs of use, fully functional.', colorClass: 'border-grade-b text-grade-b' },
  { id: 'C', label: 'Good',      desc: 'Visible wear but works perfectly.',     colorClass: 'border-grade-c text-grade-c' },
  { id: 'D', label: 'Fair',      desc: 'Heavy wear or cosmetic damage.',        colorClass: 'border-grade-d text-grade-d' },
];

const CONDITION_CHECKS: Record<string, string[]> = {
  iem: [
    'Drivers are working in both ears',
    'No driver flex or channel imbalance',
    'Shells are intact — no cracks or chips',
    'Nozzle is clean and undamaged',
    'Stock filters / screens are present',
    'Cable has no kinks, breaks, or fraying',
  ],
  headphone: [
    'Both drivers are working correctly',
    'No channel imbalance or distortion',
    'Ear pads are in stated condition',
    'Headband is intact — no cracks or peeling',
    'Hinges and joints move smoothly',
    'Cable is functional (if detachable, connector is clean)',
  ],
  dac: [
    'Unit powers on and off cleanly',
    'All input / output ports are functional',
    'No audible hiss, hum, or noise floor issues',
    'Display / indicators work (if present)',
    'Casing has no structural damage',
  ],
  amp: [
    'Unit powers on and off cleanly',
    'Volume pot is smooth with no channel drop-out',
    'All input / output ports are functional',
    'No audible hiss, hum, or noise floor issues',
    'Casing has no structural damage',
  ],
  dac_amp: [
    'Unit powers on and off cleanly',
    'DAC section functional on all inputs',
    'Amp section has no channel drop-out',
    'All ports are functional',
    'No audible hiss, hum, or noise floor issues',
    'Casing has no structural damage',
  ],
  cable: [
    'No kinks, breaks, or fraying along the length',
    'Connectors are clean and undamaged',
    'No channel imbalance or intermittent signal',
    'Strain relief is intact at both ends',
  ],
  source: [
    'Device powers on and off cleanly',
    'All buttons and scroll wheels are functional',
    'Screen has no cracks or dead pixels',
    'Battery holds charge as described',
    'All ports (USB, card slot, headphone out) are functional',
  ],
  other: [
    'Item is in the condition described',
    'All stated functions are working',
    'No undisclosed damage',
  ],
};

const INCLUSIONS: Record<string, string[]> = {
  iem:      ['Stock ear tips (S / M / L)', 'Foam tips', 'Ear hooks', 'Carrying case', 'Stock cable', 'Documentation / warranty card'],
  headphone:['Carrying case', 'Extra ear pads', 'Detachable cable', '6.35 mm adapter', 'Documentation / warranty card'],
  dac:      ['Power adapter', 'USB cable', 'Optical cable', 'Documentation / warranty card'],
  amp:      ['Power adapter', 'Interconnect cables', 'Documentation / warranty card'],
  dac_amp:  ['Power adapter', 'USB cable', 'Optical cable', 'Interconnect cables', 'Documentation / warranty card'],
  cable:    ['3.5 mm adapter', '6.35 mm adapter', 'Cable storage pouch'],
  source:   ['Charging cable / adapter', 'Memory card', 'Protective case', 'Screen protector', 'Documentation / warranty card'],
  other:    ['Original packaging', 'Documentation'],
};

const PHOTO_SLOTS = [
  { key: 'main',   label: 'Main — full item' },
  { key: 'detail', label: 'Condition close-up' },
  { key: 'box',    label: 'Box & accessories' },
  { key: 'extra',  label: 'Additional angle' },
];

// Mock sold prices (paise) — replaced with real price_history query once Supabase is wired
const MOCK_PRICE_HISTORY = [14500000, 13200000, 15000000, 12800000, 14000000];

// ── Types ────────────────────────────────────────────────────────────────────

interface PhotoEntry {
  file: File;
  previewUrl: string;
}

interface Draft {
  productTypeId: string;
  productBrand: string;
  productName: string;
  grade: string;
  conditionChecks: Record<string, boolean>;
  inclusions: Record<string, boolean>;
  photos: PhotoEntry[];
  askingPricePaise: number | null;
  negotiationEnabled: boolean;
  floorPricePaise: number | null;
  autoAcceptPaise: number | null;
}

function emptyDraft(): Draft {
  return {
    productTypeId: '',
    productBrand: '',
    productName: '',
    grade: '',
    conditionChecks: {},
    inclusions: {},
    photos: [],
    askingPricePaise: null,
    negotiationEnabled: false,
    floorPricePaise: null,
    autoAcceptPaise: null,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseRupees(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(n) || n < 0) return null;
  return Math.floor(n * 100);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function NewListingPage() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [priceWarning, setPriceWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  function canAdvance(): boolean {
    switch (step) {
      case 0: return !!draft.productTypeId;
      case 1: return !!draft.productBrand.trim() && !!draft.productName.trim();
      case 2: return !!draft.grade;
      case 3: return true;
      case 4: return draft.photos.length >= 1;
      case 5: return !!draft.askingPricePaise && draft.askingPricePaise > 0;
      default: return false;
    }
  }

  function handlePhotoAdd(files: FileList | null) {
    if (!files) return;
    setPhotoError(null);
    const slots = PHOTO_SLOTS.length - draft.photos.length;
    const toAdd = Array.from(files).slice(0, slots);

    if (fileInputRef.current) fileInputRef.current.value = '';

    toAdd.forEach(file => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (Math.max(w, h) < 1200 || Math.min(w, h) < 900) {
          setPhotoError(`"${file.name}" is ${w}×${h} px — minimum is 1200×900 px.`);
          URL.revokeObjectURL(url);
        } else {
          setDraft(prev => ({ ...prev, photos: [...prev.photos, { file, previewUrl: url }] }));
        }
      };
      img.src = url;
    });
  }

  function removePhoto(index: number) {
    setDraft(prev => {
      URL.revokeObjectURL(prev.photos[index].previewUrl);
      return { ...prev, photos: prev.photos.filter((_, i) => i !== index) };
    });
  }

  function handlePriceChange(raw: string) {
    const paise = parseRupees(raw);
    update('askingPricePaise', paise);
    if (paise && MOCK_PRICE_HISTORY.length > 0) {
      const avg = MOCK_PRICE_HISTORY.reduce((a, b) => a + b, 0) / MOCK_PRICE_HISTORY.length;
      setPriceWarning(
        paise > avg * 1.3
          ? `Your price is more than 30% above the recent average of ${formatPrice(Math.round(avg))}.`
          : null,
      );
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    // TODO (next session): POST to /api/listings — saves draft, sets status → 'pending',
    // triggers Telegram notification to admin.
    await new Promise(r => setTimeout(r, 800));
    setSubmitting(false);
    alert('Submitted for review! (Supabase wiring coming next session)');
  }

  const checks       = CONDITION_CHECKS[draft.productTypeId] ?? CONDITION_CHECKS.other;
  const inclusions   = INCLUSIONS[draft.productTypeId]       ?? INCLUSIONS.other;
  const payout       = draft.askingPricePaise ? Math.floor(draft.askingPricePaise * 0.9) : null;
  const priceAvg     = Math.round(MOCK_PRICE_HISTORY.reduce((a, b) => a + b, 0) / MOCK_PRICE_HISTORY.length);
  const productLabel = PRODUCT_TYPES.find(p => p.id === draft.productTypeId)?.label ?? '';

  // ── Input class shared across all steps ──────────────────
  const inputCls = [
    'w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground',
    'placeholder:text-dim-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors',
  ].join(' ');

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg">

      {/* top bar */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="font-heading text-sm font-semibold text-foreground">New listing</span>
          <Link href="/sell" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Cancel
          </Link>
        </div>
      </div>

      {/* step indicator */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-2xl overflow-x-auto px-4 sm:px-6">
          <ol className="flex min-w-max">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i >= step}
                  className="flex items-center gap-2 px-3 py-4 text-xs font-medium transition-colors disabled:cursor-default"
                >
                  <span className={[
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                    i === step
                      ? 'border-accent bg-accent text-black'
                      : i < step
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-border bg-surface-2 text-dim-foreground',
                  ].join(' ')}>
                    {i + 1}
                  </span>
                  <span className={
                    i === step ? 'text-foreground' : i < step ? 'text-muted-foreground' : 'text-dim-foreground'
                  }>
                    {label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className="text-dim-foreground select-none">›</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* step body */}
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

        {/* ── Step 0 — Product type ── */}
        {step === 0 && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">What are you selling?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Select the category that best fits your item.</p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRODUCT_TYPES.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => {
                    update('productTypeId', pt.id);
                    update('conditionChecks', {});
                    update('inclusions', {});
                  }}
                  className={[
                    'flex flex-col items-start rounded-xl border p-4 text-left transition-all',
                    draft.productTypeId === pt.id
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-surface hover:border-border-2 hover:bg-surface-2',
                  ].join(' ')}
                >
                  <span className={[
                    'font-heading text-base font-semibold',
                    draft.productTypeId === pt.id ? 'text-accent' : 'text-foreground',
                  ].join(' ')}>
                    {pt.label}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">{pt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1 — Product details ── */}
        {step === 1 && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">Which product is it?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the brand and model name exactly as sold. This helps buyers search for it.
            </p>

            <div className="mt-8 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Moondrop, Sennheiser, Topping"
                  value={draft.productBrand}
                  onChange={e => update('productBrand', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Model name</label>
                <input
                  type="text"
                  placeholder="e.g. Aria 2, HD 660S, D90 SE"
                  value={draft.productName}
                  onChange={e => update('productName', e.target.value)}
                  className={inputCls}
                />
              </div>

              {draft.productBrand && draft.productName && (
                <div className="rounded-xl border border-border bg-surface-2 p-4">
                  <p className="text-xs text-muted-foreground">Listing as</p>
                  <p className="mt-1 font-heading text-base font-semibold text-foreground">
                    {draft.productBrand} {draft.productName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{productLabel}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2 — Condition ── */}
        {step === 2 && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">What condition is it in?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Be honest — buyers rely on this grade to make decisions.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {GRADES.map(g => (
                <button
                  key={g.id}
                  onClick={() => update('grade', g.id)}
                  className={[
                    'flex min-w-[130px] flex-col rounded-xl border-2 p-4 text-left transition-all',
                    draft.grade === g.id
                      ? g.colorClass + ' bg-surface-2'
                      : 'border-border bg-surface text-muted-foreground hover:border-border-2',
                  ].join(' ')}
                >
                  <span className={[
                    'font-heading text-xl font-black',
                    draft.grade !== g.id ? 'text-foreground' : '',
                  ].join(' ')}>
                    {g.id}
                  </span>
                  <span className="mt-1 text-sm font-semibold">{g.label}</span>
                  <span className="mt-1 text-xs leading-relaxed opacity-80">{g.desc}</span>
                </button>
              ))}
            </div>

            {draft.grade && (
              <div className="mt-8">
                <p className="mb-4 text-sm font-medium text-foreground">Confirm the following apply:</p>
                <div className="space-y-3">
                  {checks.map(item => (
                    <label key={item} className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!!draft.conditionChecks[item]}
                        onChange={e =>
                          update('conditionChecks', { ...draft.conditionChecks, [item]: e.target.checked })
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[#E8FF4D]"
                      />
                      <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3 — Inclusions ── */}
        {step === 3 && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">What&apos;s included?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Tick everything you&apos;re putting in the box.</p>

            <div className="mt-8 space-y-3">
              {inclusions.map(item => (
                <label
                  key={item}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-2"
                >
                  <input
                    type="checkbox"
                    checked={!!draft.inclusions[item]}
                    onChange={e =>
                      update('inclusions', { ...draft.inclusions, [item]: e.target.checked })
                    }
                    className="h-4 w-4 shrink-0 rounded border-border accent-[#E8FF4D]"
                  />
                  <span className="text-sm text-foreground">{item}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 4 — Photos ── */}
        {step === 4 && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">Add photos</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Minimum 1200×900 px per photo. At least one is required.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {PHOTO_SLOTS.map((slot, i) => {
                const photo = draft.photos[i];
                return (
                  <div key={slot.key} className="flex flex-col gap-2">
                    <span className="text-xs text-muted-foreground">{slot.label}</span>
                    {photo ? (
                      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.previewUrl} alt={slot.label} className="h-full w-full object-cover" />
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-bg/80 text-xs text-foreground transition-colors hover:bg-error hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface transition-colors hover:border-border-2 hover:bg-surface-2"
                      >
                        <span className="text-xl text-dim-foreground">+</span>
                        <span className="text-[10px] text-dim-foreground">Add photo</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handlePhotoAdd(e.target.files)}
            />

            {photoError && (
              <p className="mt-4 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
                {photoError}
              </p>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              Photos are uploaded when you submit. Accepted: JPG, PNG, WEBP.
            </p>
          </div>
        )}

        {/* ── Step 5 — Price & terms ── */}
        {step === 5 && (
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">Set your price</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Buyers see your asking price. You keep 90% when it sells.
            </p>

            {/* price oracle */}
            <div className="mt-8 rounded-xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Recent sold prices — {draft.productBrand} {draft.productName}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MOCK_PRICE_HISTORY.map((p, i) => (
                  <span key={i} className="rounded-md border border-border bg-surface-2 px-3 py-1 font-mono text-sm text-foreground">
                    {formatPrice(p)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Market average: <span className="font-medium text-foreground">{formatPrice(priceAvg)}</span>
              </p>
            </div>

            {/* asking price */}
            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Asking price (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">₹</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  onChange={e => handlePriceChange(e.target.value)}
                  className={inputCls.replace('px-4', 'pl-8 pr-4') + ' font-mono'}
                />
              </div>
              {priceWarning && (
                <p className="mt-2 text-xs text-warning">{priceWarning}</p>
              )}
            </div>

            {/* payout preview */}
            {payout !== null && (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
                <span className="text-sm text-muted-foreground">Your payout after 10% fee</span>
                <span className="font-mono font-bold text-accent">{formatPrice(payout)}</span>
              </div>
            )}

            {/* negotiation toggle */}
            <div className="mt-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Accept offers?</p>
                  <p className="text-xs text-muted-foreground">Buyers can negotiate below your asking price.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={draft.negotiationEnabled}
                  onClick={() => update('negotiationEnabled', !draft.negotiationEnabled)}
                  className={[
                    'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg',
                    draft.negotiationEnabled ? 'border-accent bg-accent' : 'border-border bg-surface-2',
                  ].join(' ')}
                >
                  <span className={[
                    'absolute top-0.5 h-5 w-5 rounded-full transition-transform',
                    draft.negotiationEnabled ? 'translate-x-5 bg-black' : 'translate-x-0.5 bg-foreground',
                  ].join(' ')} />
                </button>
              </div>

              {draft.negotiationEnabled && (
                <div className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5">
                  <p className="text-xs text-muted-foreground">
                    These values are private — buyers never see them.
                  </p>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Floor price (₹) — lowest offer you&apos;ll consider
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">₹</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        onChange={e => update('floorPricePaise', parseRupees(e.target.value))}
                        className={inputCls.replace('px-4', 'pl-8 pr-4') + ' font-mono'}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-foreground">
                      Auto-accept threshold (₹) — offers at or above this auto-accept
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">₹</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        onChange={e => update('autoAcceptPaise', parseRupees(e.target.value))}
                        className={inputCls.replace('px-4', 'pl-8 pr-4') + ' font-mono'}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* post-submit note */}
            <div className="mt-8 rounded-xl border border-border bg-surface-2 p-5">
              <p className="text-sm font-medium text-foreground">After you submit</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Your listing goes into the review queue. We typically approve within
                2–4 hours between 9 am and 9 pm IST. You&apos;ll get a Telegram message
                the moment it goes live.
              </p>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              Back
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="inline-flex h-10 items-center rounded-lg bg-accent px-6 text-sm font-semibold text-black transition-all hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance() || submitting}
              className="inline-flex h-10 items-center rounded-lg bg-accent px-6 text-sm font-semibold text-black transition-all hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
