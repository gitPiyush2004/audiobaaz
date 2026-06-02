'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/utils/formatting';

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = ['Product type', 'Product details', 'Condition', 'Inclusions', 'Photos', 'Price & terms'];

const STEP_SIDEBAR_DESCS = [
  'Select category',
  'Brand, model, year',
  'Grade S through D',
  'Box, cables, extras',
  'Min. 1 photo required',
  'Set your asking price',
];

const STEP_TIPS: string[][] = [
  [
    'Pick the most specific category — it helps buyers find your listing faster.',
    'If your item fits multiple categories, pick the primary function.',
    'Use "Other" for turntables, stands, or anything niche.',
  ],
  [
    'Search our catalogue first — it auto-fills brand and model accurately.',
    'Include the exact model revision (e.g. HD 660S2, not just HD 660S).',
    'Brand + model determine how we display your listing in search results.',
  ],
  [
    'Be honest — buyers rely on this grade to make purchase decisions.',
    'When in doubt, grade down — it avoids disputes after delivery.',
    'Grade D is still a valid listing. Be transparent about defects.',
  ],
  [
    'Buyers check inclusions carefully before making offers.',
    'Missing original items can lower the offers you receive.',
    'Check your box before ticking items off this list.',
  ],
  [
    'Photos must be at least 1200×900 px — enforced on upload.',
    'Natural light gives the cleanest results. Avoid flash.',
    'Include a close-up of any defects, even minor ones.',
  ],
  [
    'Recent sold prices are shown above — use them as a reference.',
    'You keep 90% of the final sale price after our 10% fee.',
    'Floor price is private — buyers never see it.',
  ],
];

const PRODUCT_TYPES = [
  { id: 'iem',       label: 'IEM',       desc: 'In-ear monitor' },
  { id: 'headphone', label: 'Headphone', desc: 'Over / on-ear' },
  { id: 'dac',       label: 'DAC',       desc: 'Digital to analogue' },
  { id: 'amp',       label: 'Amp',       desc: 'Amplifier' },
  { id: 'dac_amp',   label: 'DAC + Amp', desc: 'Combined unit' },
  { id: 'cable',     label: 'Cable',     desc: 'IEM / headphone cable' },
  { id: 'source',    label: 'Source',    desc: 'DAP / streamer' },
  { id: 'other',     label: 'Other',     desc: 'Accessories & more' },
];

// Grade D intentionally kept — internal spec defines S through D (5 grades)
const GRADES = [
  { id: 'S', label: 'Sealed',    desc: 'Unopened, factory sealed.',             color: '#1D4ED8' },
  { id: 'A', label: 'Mint',      desc: 'Used but flawless. No visible wear.',   color: '#15803D' },
  { id: 'B', label: 'Excellent', desc: 'Minor signs of use, fully functional.', color: '#A16207' },
  { id: 'C', label: 'Good',      desc: 'Visible wear but works perfectly.',     color: '#92400E' },
  { id: 'D', label: 'Fair',      desc: 'Heavy wear or cosmetic damage.',        color: '#B91C1C' },
];

const CONDITION_CHECKS: Record<string, string[]> = {
  iem:      ['Drivers are working in both ears','No driver flex or channel imbalance','Shells are intact — no cracks or chips','Nozzle is clean and undamaged','Stock filters / screens are present','Cable has no kinks, breaks, or fraying'],
  headphone:['Both drivers are working correctly','No channel imbalance or distortion','Ear pads are in stated condition','Headband is intact — no cracks or peeling','Hinges and joints move smoothly','Cable is functional (if detachable, connector is clean)'],
  dac:      ['Unit powers on and off cleanly','All input / output ports are functional','No audible hiss, hum, or noise floor issues','Display / indicators work (if present)','Casing has no structural damage'],
  amp:      ['Unit powers on and off cleanly','Volume pot is smooth with no channel drop-out','All input / output ports are functional','No audible hiss, hum, or noise floor issues','Casing has no structural damage'],
  dac_amp:  ['Unit powers on and off cleanly','DAC section functional on all inputs','Amp section has no channel drop-out','All ports are functional','No audible hiss, hum, or noise floor issues','Casing has no structural damage'],
  cable:    ['No kinks, breaks, or fraying along the length','Connectors are clean and undamaged','No channel imbalance or intermittent signal','Strain relief is intact at both ends'],
  source:   ['Device powers on and off cleanly','All buttons and scroll wheels are functional','Screen has no cracks or dead pixels','Battery holds charge as described','All ports (USB, card slot, headphone out) are functional'],
  other:    ['Item is in the condition described','All stated functions are working','No undisclosed damage'],
};

const INCLUSIONS: Record<string, string[]> = {
  iem:      ['Stock ear tips (S / M / L)','Foam tips','Ear hooks','Carrying case','Stock cable','Documentation / warranty card'],
  headphone:['Carrying case','Extra ear pads','Detachable cable','6.35 mm adapter','Documentation / warranty card'],
  dac:      ['Power adapter','USB cable','Optical cable','Documentation / warranty card'],
  amp:      ['Power adapter','Interconnect cables','Documentation / warranty card'],
  dac_amp:  ['Power adapter','USB cable','Optical cable','Interconnect cables','Documentation / warranty card'],
  cable:    ['3.5 mm adapter','6.35 mm adapter','Cable storage pouch'],
  source:   ['Charging cable / adapter','Memory card','Protective case','Screen protector','Documentation / warranty card'],
  other:    ['Original packaging','Documentation'],
};

const PHOTO_SLOTS = [
  { key: 'main',   label: 'Main — full item' },
  { key: 'detail', label: 'Condition close-up' },
  { key: 'box',    label: 'Box & accessories' },
  { key: 'extra',  label: 'Additional angle' },
];

// ── Category icons ────────────────────────────────────────────────────────────

function CatIcon({ id, selected }: { id: string; selected: boolean }) {
  const stroke = selected ? '#ffffff' : '#0a0a0a';
  const op = selected ? 1 : 0.45;
  const s: React.CSSProperties = { display: 'block' };
  switch (id) {
    case 'iem': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={s} opacity={op}>
        <ellipse cx="10" cy="16" rx="5" ry="6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
        <ellipse cx="10" cy="16" rx="2" ry="2.5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="5" y1="12" x2="2" y2="9" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="5" y1="12" x2="1" y2="14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M15 16 Q20 10 28 12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    );
    case 'headphone': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={s} opacity={op}>
        <path d="M6 16 a10 10 0 0 1 20 0" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <rect x="4" y="15" width="5" height="9" rx="2" stroke={stroke} strokeWidth="1.8" fill="none"/>
        <rect x="23" y="15" width="5" height="9" rx="2" stroke={stroke} strokeWidth="1.8" fill="none"/>
      </svg>
    );
    case 'dac': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={s} opacity={op}>
        <rect x="3" y="11" width="26" height="10" rx="1.5" stroke={stroke} strokeWidth="1.8" fill="none"/>
        <circle cx="10" cy="16" r="2.5" stroke={stroke} strokeWidth="1.5" fill="none"/>
        <circle cx="17" cy="16" r="2.5" stroke={stroke} strokeWidth="1.5" fill="none"/>
        <line x1="23" y1="14" x2="27" y2="14" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="23" y1="16" x2="28" y2="16" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="23" y1="18" x2="27" y2="18" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    );
    case 'amp': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={s} opacity={op}>
        <rect x="3" y="9" width="26" height="14" rx="1.5" stroke={stroke} strokeWidth="1.8" fill="none"/>
        <circle cx="10" cy="16" r="3" stroke={stroke} strokeWidth="1.5" fill="none"/>
        <line x1="20" y1="13" x2="26" y2="13" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="20" y1="16" x2="28" y2="16" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
        <line x1="20" y1="19" x2="26" y2="19" stroke={stroke} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    );
    case 'dac_amp': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={s} opacity={op}>
        <rect x="3" y="7" width="26" height="8" rx="1.5" stroke={stroke} strokeWidth="1.8" fill="none"/>
        <rect x="3" y="17" width="26" height="8" rx="1.5" stroke={stroke} strokeWidth="1.8" fill="none"/>
        <circle cx="8" cy="11" r="2" stroke={stroke} strokeWidth="1.4" fill="none"/>
        <circle cx="8" cy="21" r="2" stroke={stroke} strokeWidth="1.4" fill="none"/>
      </svg>
    );
    case 'cable': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={s} opacity={op}>
        <path d="M4 16 Q12 8 20 16 Q28 24 28 16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <circle cx="4" cy="16" r="2" stroke={stroke} strokeWidth="1.5" fill="none"/>
        <circle cx="28" cy="16" r="2" stroke={stroke} strokeWidth="1.5" fill="none"/>
      </svg>
    );
    case 'source': return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={s} opacity={op}>
        <rect x="9" y="5" width="14" height="22" rx="2" stroke={stroke} strokeWidth="1.8" fill="none"/>
        <rect x="12" y="9" width="8" height="10" rx="1" stroke={stroke} strokeWidth="1.4" fill="none"/>
        <circle cx="16" cy="23" r="1.2" stroke={stroke} strokeWidth="1.2" fill="none"/>
      </svg>
    );
    default: return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={s} opacity={op}>
        <circle cx="16" cy="16" r="12" stroke={stroke} strokeWidth="1.8" fill="none"/>
        <line x1="16" y1="11" x2="16" y2="16" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="16" cy="20" r="1.2" stroke={stroke} strokeWidth="1.5"/>
      </svg>
    );
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PhotoEntry {
  file?:       File;
  previewUrl:  string;
  storageUrl?: string;
}

interface Draft {
  productTypeId:      string;
  productBrand:       string;
  productName:        string;
  grade:              string;
  conditionChecks:    Record<string, boolean>;
  inclusions:         Record<string, boolean>;
  photos:             PhotoEntry[];
  askingPricePaise:   number | null;
  negotiationEnabled: boolean;
  floorPricePaise:    number | null;
  autoAcceptPaise:    number | null;
}

interface ProductSuggestion {
  id:       string;
  name:     string;
  brand:    string;
  model:    string;
  category: string;
}

export interface ListingFormInitialData {
  productTypeId?:     string;
  productBrand?:      string;
  productName?:       string;
  grade?:             string;
  inclusions?:        Record<string, boolean>;
  existingPhotoUrls?: string[];
  askingPricePaise?:  number;
  negotiationEnabled?: boolean;
}

interface Props {
  draftId?:     string;
  initialData?: ListingFormInitialData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseRupees(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(n) || n < 0) return null;
  return Math.floor(n * 100);
}

function initDraft(initial?: ListingFormInitialData): Draft {
  return {
    productTypeId:     initial?.productTypeId     ?? '',
    productBrand:      initial?.productBrand      ?? '',
    productName:       initial?.productName       ?? '',
    grade:             initial?.grade             ?? '',
    conditionChecks:   {},
    inclusions:        initial?.inclusions        ?? {},
    photos:            (initial?.existingPhotoUrls ?? []).map(url => ({
      previewUrl: url,
      storageUrl: url,
    })),
    askingPricePaise:   initial?.askingPricePaise   ?? null,
    negotiationEnabled: initial?.negotiationEnabled ?? false,
    floorPricePaise:    null,
    autoAcceptPaise:    null,
  };
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const font    = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const B       = '#E8E8E4';   // border
const OFF     = '#FAFAF8';   // off-white
const MUTED   = '#999';
const MID     = '#666';
const ACCENT  = '#E8FF4D';
const BLACK   = '#0a0a0a';

const inputSt: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: `1.5px solid ${B}`, background: '#fff',
  fontSize: 14, color: BLACK, outline: 'none',
  fontFamily: font, borderRadius: 0, boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700,
  letterSpacing: '0.12em', textTransform: 'uppercase',
  color: MID, marginBottom: 7,
};

// ── Component ────────────────────────────────────────────────────────────────

export function ListingForm({ draftId, initialData }: Props) {
  const [step,           setStep]          = useState(0);
  const [draft,          setDraft]         = useState<Draft>(() => initDraft(initialData));
  const [photoError,     setPhotoError]    = useState<string | null>(null);
  const [priceWarning,   setPriceWarning]  = useState<string | null>(null);
  const [submitting,     setSubmitting]    = useState(false);
  const [submitError,    setSubmitError]   = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [priceHistory,   setPriceHistory]  = useState<number[]>([]);
  const [productQuery,   setProductQuery]  = useState('');
  const [suggestions,    setSuggestions]   = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedDraftIdRef = useRef<string | null>(draftId ?? null);
  const router = useRouter();

  const update = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (productQuery.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const qs  = new URLSearchParams({ q: productQuery });
        if (draft.productTypeId) qs.set('category', draft.productTypeId);
        const res  = await fetch(`/api/products/search?${qs}`);
        const json = await res.json();
        if (!json.error) setSuggestions(json.data ?? []);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [productQuery, draft.productTypeId]);

  useEffect(() => {
    if (step !== 5 || !draft.productName) return;
    fetch(`/api/price-oracle?model=${encodeURIComponent(draft.productName)}&brand=${encodeURIComponent(draft.productBrand)}`)
      .then(r => r.json())
      .then(json => {
        if (json.data?.length > 0) setPriceHistory(json.data.map((d: { sold_price: number }) => d.sold_price));
      })
      .catch(() => {});
  }, [step, draft.productName, draft.productBrand]);

  const autoSave = useCallback(async (currentDraft: Draft, afterStep: number) => {
    if (afterStep < 1 || afterStep > 3) return;
    setAutoSaveStatus('saving');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    try {
      const payload: Record<string, unknown> = {
        productTypeId: currentDraft.productTypeId,
        productBrand:  currentDraft.productBrand,
        productName:   currentDraft.productName,
        ...(afterStep >= 2 && { grade: currentDraft.grade, conditionChecks: currentDraft.conditionChecks }),
        ...(afterStep >= 3 && { inclusions: currentDraft.inclusions }),
      };
      if (!savedDraftIdRef.current) {
        const res  = await fetch('/api/listings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, saveAsDraft: true }),
        });
        const json = await res.json();
        if (!json.error) savedDraftIdRef.current = json.data.id;
      } else {
        await fetch(`/api/listings/${savedDraftIdRef.current}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, saveDraft: true }),
        });
      }
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 4000);
    } catch {
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    }
  }, []);

  function handleContinue() {
    autoSave(draft, step);
    setStep(s => s + 1);
  }

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
      const previewUrl = URL.createObjectURL(file);
      const img        = new window.Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (Math.max(w, h) < 1200 || Math.min(w, h) < 900) {
          setPhotoError(`"${file.name}" is ${w}×${h} px — minimum is 1200×900 px.`);
          URL.revokeObjectURL(previewUrl);
        } else {
          setDraft(prev => ({ ...prev, photos: [...prev.photos, { file, previewUrl }] }));
        }
      };
      img.src = previewUrl;
    });
  }

  function removePhoto(index: number) {
    setDraft(prev => {
      const photo = prev.photos[index];
      if (!photo.storageUrl) URL.revokeObjectURL(photo.previewUrl);
      return { ...prev, photos: prev.photos.filter((_, i) => i !== index) };
    });
  }

  function handlePriceChange(raw: string) {
    const paise = parseRupees(raw);
    update('askingPricePaise', paise);
    if (paise && priceHistory.length > 0) {
      const avg = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
      setPriceWarning(
        paise > avg * 1.3
          ? `Your price is more than 30% above the recent average of ${formatPrice(Math.round(avg))}.`
          : null,
      );
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const photoUrls: string[] = [];
      for (const photo of draft.photos) {
        if (photo.storageUrl) {
          photoUrls.push(photo.storageUrl);
        } else if (photo.file) {
          const fd  = new FormData();
          fd.append('file', photo.file);
          const res  = await fetch('/api/upload', { method: 'POST', body: fd });
          const json = await res.json();
          if (json.error) throw new Error(json.error.message);
          photoUrls.push(json.data.url);
        }
      }
      const payload = {
        productTypeId: draft.productTypeId, productBrand: draft.productBrand,
        productName: draft.productName, grade: draft.grade,
        conditionChecks: draft.conditionChecks, inclusions: draft.inclusions,
        photoUrls, askingPricePaise: draft.askingPricePaise,
        negotiationEnabled: draft.negotiationEnabled,
        floorPricePaise: draft.floorPricePaise, autoAcceptPaise: draft.autoAcceptPaise,
      };
      const effectiveDraftId = savedDraftIdRef.current;
      if (effectiveDraftId) {
        const res  = await fetch(`/api/listings/${effectiveDraftId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, resubmit: true }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
      } else {
        const res  = await fetch('/api/listings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
      }
      router.push('/dashboard?submitted=1');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const checks     = CONDITION_CHECKS[draft.productTypeId] ?? CONDITION_CHECKS.other;
  const inclusions = INCLUSIONS[draft.productTypeId]       ?? INCLUSIONS.other;
  const payout     = draft.askingPricePaise ? Math.floor(draft.askingPricePaise * 0.9) : null;
  const priceAvg   = priceHistory.length > 0
    ? Math.round(priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length) : null;
  const productLabel = PRODUCT_TYPES.find(p => p.id === draft.productTypeId)?.label ?? '';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: '#fff', fontFamily: font, color: BLACK }}>

      {/* ── Listing header bar ── */}
      <div style={{
        position: 'sticky', top: 60, zIndex: 40,
        height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', borderBottom: `1px solid ${B}`, background: '#fff',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {draftId ? 'Edit listing' : 'New listing'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {autoSaveStatus === 'saving' && <span style={{ fontSize: 11, color: MUTED }}>Saving…</span>}
          {autoSaveStatus === 'saved'  && <span style={{ fontSize: 11, color: '#15803D' }}>Draft saved</span>}
          {autoSaveStatus === 'error'  && <span style={{ fontSize: 11, color: '#B91C1C' }}>Save failed</span>}
          <Link
            href={draftId ? '/dashboard/listings?tab=draft' : '/sell'}
            style={{ fontSize: 12, fontWeight: 500, color: MUTED, textDecoration: 'none' }}
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* ── Steps bar ── */}
      <div style={{
        position: 'sticky', top: 112, zIndex: 39,
        height: 52, display: 'flex', alignItems: 'center',
        padding: '0 40px', borderBottom: `1px solid ${B}`, background: '#fff',
        gap: 0, overflowX: 'auto',
      }}>
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8, flexShrink: 0 }}>
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i >= step}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', padding: 0,
                cursor: i < step ? 'pointer' : 'default', fontFamily: font,
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                background: i < step ? ACCENT : i === step ? BLACK : OFF,
                color:      i < step ? BLACK  : i === step ? '#fff' : MUTED,
                border:     i > step ? `1px solid ${B}` : 'none',
              }}>
                {i < step ? '✓' : i + 1}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap',
                color: i === step ? BLACK : MUTED,
              }}>
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span style={{ color: B, fontSize: 12, marginLeft: 4 }}>›</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Body: main + sidebar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', minHeight: 'calc(100vh - 228px)' }}>

        {/* Main content */}
        <div style={{ padding: '56px 64px 80px 40px', borderRight: `1px solid ${B}` }}>

          {/* ── Step 0 — Product type ── */}
          {step === 0 && (
            <div>
              <h2 style={{ fontSize: 'clamp(28px,3vw,40px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>
                What are you selling?
              </h2>
              <p style={{ fontSize: 14, color: MID, marginBottom: 36, lineHeight: 1.6 }}>
                Select the category that best fits your item.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: B, border: `1px solid ${B}` }}>
                {PRODUCT_TYPES.map(pt => {
                  const selected = draft.productTypeId === pt.id;
                  return (
                    <button
                      key={pt.id}
                      onClick={() => { update('productTypeId', pt.id); update('conditionChecks', {}); update('inclusions', {}); }}
                      style={{
                        background:   selected ? BLACK : '#fff',
                        padding:      '24px 20px',
                        cursor:       'pointer',
                        border:       'none',
                        textAlign:    'left',
                        display:      'flex',
                        flexDirection: 'column',
                        gap:          12,
                        position:     'relative',
                        fontFamily:   font,
                        transition:   'background 0.12s',
                      }}
                    >
                      {selected && (
                        <div style={{
                          position: 'absolute', top: 12, right: 12,
                          width: 18, height: 18, borderRadius: '50%',
                          background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: BLACK,
                        }}>✓</div>
                      )}
                      <CatIcon id={pt.id} selected={selected} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', color: selected ? '#fff' : BLACK, marginBottom: 2 }}>
                          {pt.label}
                        </div>
                        <div style={{ fontSize: 11, color: selected ? '#666' : MUTED, lineHeight: 1.4 }}>
                          {pt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 1 — Product details ── */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 'clamp(28px,3vw,40px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>
                Which product is it?
              </h2>
              <p style={{ fontSize: 14, color: MID, marginBottom: 36, lineHeight: 1.6 }}>
                Search our catalogue or enter brand and model manually.
              </p>

              <div style={{ position: 'relative', marginBottom: 24 }}>
                <label style={labelSt}>Search catalogue <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: MUTED }}>(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Moondrop Aria, HD 660S, Topping D90"
                  value={productQuery}
                  onChange={e => { setProductQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={e => { setShowSuggestions(true); e.currentTarget.style.borderColor = BLACK; }}
                  onBlur={e => { setTimeout(() => setShowSuggestions(false), 150); e.currentTarget.style.borderColor = B; }}
                  style={inputSt}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                    border: `1px solid ${B}`, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                  }}>
                    {suggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={() => {
                          update('productBrand', s.brand);
                          update('productName', s.name);
                          if (s.category !== draft.productTypeId) update('productTypeId', s.category);
                          setProductQuery(`${s.brand} ${s.name}`);
                          setShowSuggestions(false);
                        }}
                        style={{
                          display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 14px', background: 'none', border: 'none',
                          cursor: 'pointer', fontFamily: font, textAlign: 'left',
                          borderBottom: `1px solid ${B}`,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600, color: BLACK }}>{s.brand} {s.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginLeft: 16 }}>{s.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelSt}>Brand</label>
                  <input type="text" placeholder="e.g. Moondrop, Sennheiser, Topping"
                    value={draft.productBrand} onChange={e => update('productBrand', e.target.value)}
                    style={inputSt}
                    onFocus={e => (e.currentTarget.style.borderColor = BLACK)}
                    onBlur={e => (e.currentTarget.style.borderColor = B)}
                  />
                </div>
                <div>
                  <label style={labelSt}>Model name</label>
                  <input type="text" placeholder="e.g. Aria 2, HD 660S, D90 SE"
                    value={draft.productName} onChange={e => update('productName', e.target.value)}
                    style={inputSt}
                    onFocus={e => (e.currentTarget.style.borderColor = BLACK)}
                    onBlur={e => (e.currentTarget.style.borderColor = B)}
                  />
                </div>
                {draft.productBrand && draft.productName && (
                  <div style={{ padding: '16px 18px', border: `1px solid ${B}`, background: OFF }}>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>Listing as</p>
                    <p style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: BLACK }}>
                      {draft.productBrand} {draft.productName}
                    </p>
                    <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{productLabel}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2 — Condition ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 'clamp(28px,3vw,40px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>
                What condition is it in?
              </h2>
              <p style={{ fontSize: 14, color: MID, marginBottom: 36, lineHeight: 1.6 }}>
                Be honest — buyers rely on this grade to make decisions.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 36 }}>
                {GRADES.map(g => {
                  const selected = draft.grade === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => update('grade', g.id)}
                      style={{
                        minWidth: 140, padding: '20px 18px',
                        border: `2px solid ${selected ? g.color : B}`,
                        background: selected ? `${g.color}12` : '#fff',
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: font, transition: 'border-color 0.15s, background 0.15s',
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', color: g.color, lineHeight: 1 }}>{g.id}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: selected ? g.color : BLACK, marginTop: 4 }}>{g.label}</span>
                      <span style={{ fontSize: 11, color: MID, lineHeight: 1.4 }}>{g.desc}</span>
                    </button>
                  );
                })}
              </div>
              {draft.grade && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MID, marginBottom: 16 }}>Confirm the following apply</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {checks.map(item => (
                      <label key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!draft.conditionChecks[item]}
                          onChange={e => update('conditionChecks', { ...draft.conditionChecks, [item]: e.target.checked })}
                          style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0, accentColor: ACCENT, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 14, color: MID, lineHeight: 1.5 }}>{item}</span>
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
              <h2 style={{ fontSize: 'clamp(28px,3vw,40px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>
                What&apos;s included?
              </h2>
              <p style={{ fontSize: 14, color: MID, marginBottom: 36, lineHeight: 1.6 }}>
                Tick everything you&apos;re putting in the box.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: B, border: `1px solid ${B}` }}>
                {inclusions.map(item => (
                  <label
                    key={item}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', background: '#fff', cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = OFF)}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <input
                      type="checkbox"
                      checked={!!draft.inclusions[item]}
                      onChange={e => update('inclusions', { ...draft.inclusions, [item]: e.target.checked })}
                      style={{ width: 15, height: 15, flexShrink: 0, accentColor: ACCENT, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 14, color: BLACK }}>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 4 — Photos ── */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 'clamp(28px,3vw,40px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>
                Add photos
              </h2>
              <p style={{ fontSize: 14, color: MID, marginBottom: 36, lineHeight: 1.6 }}>
                Minimum 1200×900 px per photo. At least one is required.
                {draftId && draft.photos.some(p => p.storageUrl) && (
                  <span style={{ marginLeft: 6, color: '#1D4ED8' }}>Previously uploaded photos are shown below.</span>
                )}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {PHOTO_SLOTS.map((slot, i) => {
                  const photo = draft.photos[i];
                  return (
                    <div key={slot.key}>
                      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>{slot.label}</p>
                      {photo ? (
                        <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', border: `1px solid ${B}` }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.previewUrl} alt={slot.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          {photo.storageUrl && (
                            <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(255,255,255,0.9)', padding: '2px 6px', fontSize: 9, fontWeight: 600, color: MID }}>saved</span>
                          )}
                          <button
                            onClick={() => removePhoto(i)}
                            style={{
                              position: 'absolute', top: 6, right: 6,
                              width: 22, height: 22, background: 'rgba(255,255,255,0.9)',
                              border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: BLACK,
                            }}
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          style={{
                            width: '100%', aspectRatio: '4/3', display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: 6,
                            border: `1.5px dashed ${B}`, background: '#fff', cursor: 'pointer',
                            transition: 'border-color 0.15s, background 0.15s', fontFamily: font,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#aaa'; e.currentTarget.style.background = OFF; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = B; e.currentTarget.style.background = '#fff'; }}
                        >
                          <span style={{ fontSize: 22, color: '#ccc', lineHeight: 1 }}>+</span>
                          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ccc' }}>Add photo</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => handlePhotoAdd(e.target.files)} />
              {photoError && (
                <div style={{ marginTop: 16, padding: '12px 14px', border: '1px solid #ffc5c5', background: '#fff5f5', fontSize: 13, color: '#B91C1C' }}>
                  {photoError}
                </div>
              )}
              <p style={{ marginTop: 12, fontSize: 11, color: MUTED }}>Accepted: JPG, PNG, WEBP.</p>
            </div>
          )}

          {/* ── Step 5 — Price & terms ── */}
          {step === 5 && (
            <div>
              <h2 style={{ fontSize: 'clamp(28px,3vw,40px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8 }}>
                Set your price
              </h2>
              <p style={{ fontSize: 14, color: MID, marginBottom: 36, lineHeight: 1.6 }}>
                Buyers see your asking price. You keep 90% when it sells.
              </p>

              <div style={{ padding: '20px', border: `1px solid ${B}`, background: OFF, marginBottom: 24 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTED, marginBottom: 12 }}>
                  Recent sold prices — {draft.productBrand} {draft.productName}
                </p>
                {priceHistory.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                      {priceHistory.map((p, i) => (
                        <span key={i} style={{ padding: '4px 12px', border: `1px solid ${B}`, background: '#fff', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: BLACK }}>
                          {formatPrice(p)}
                        </span>
                      ))}
                    </div>
                    {priceAvg !== null && (
                      <p style={{ fontSize: 12, color: MID }}>
                        Market average: <strong style={{ color: BLACK }}>{formatPrice(priceAvg)}</strong>
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 14, color: MUTED }}>No sold listings for this model yet — set a price based on your own research.</p>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelSt}>Asking price (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: '"JetBrains Mono", monospace', color: MUTED, fontSize: 14 }}>₹</span>
                  <input
                    type="number" min={0} placeholder="0"
                    defaultValue={draft.askingPricePaise ? draft.askingPricePaise / 100 : ''}
                    onChange={e => handlePriceChange(e.target.value)}
                    style={{ ...inputSt, paddingLeft: 32, fontFamily: '"JetBrains Mono", monospace' }}
                    onFocus={e => (e.currentTarget.style.borderColor = BLACK)}
                    onBlur={e => (e.currentTarget.style.borderColor = B)}
                  />
                </div>
                {priceWarning && <p style={{ marginTop: 6, fontSize: 12, color: '#92400E' }}>{priceWarning}</p>}
              </div>

              {payout !== null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: `1px solid ${B}`, background: OFF, marginBottom: 32 }}>
                  <span style={{ fontSize: 13, color: MID }}>Your payout after 10% fee</span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: 15, color: BLACK }}>{formatPrice(payout)}</span>
                </div>
              )}

              {/* Negotiation toggle */}
              <div style={{ borderTop: `1px solid ${B}`, paddingTop: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: draft.negotiationEnabled ? 24 : 0 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: BLACK, marginBottom: 4 }}>Accept offers?</p>
                    <p style={{ fontSize: 12, color: MID }}>Buyers can negotiate below your asking price.</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={draft.negotiationEnabled}
                    onClick={() => update('negotiationEnabled', !draft.negotiationEnabled)}
                    style={{
                      position: 'relative', width: 44, height: 24, flexShrink: 0,
                      background: draft.negotiationEnabled ? ACCENT : '#E8E8E4',
                      border: 'none', cursor: 'pointer', borderRadius: 12,
                      transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      left: draft.negotiationEnabled ? 22 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: draft.negotiationEnabled ? BLACK : '#fff',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>

                {draft.negotiationEnabled && (
                  <div style={{ padding: 20, border: `1px solid ${B}`, background: OFF, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ fontSize: 11, color: MUTED }}>These values are private — buyers never see them.</p>
                    {[
                      { key: 'floorPricePaise'  as const, label: "Floor price (₹) — lowest offer you'll consider" },
                      { key: 'autoAcceptPaise'  as const, label: 'Auto-accept threshold (₹) — offers at or above this auto-accept' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label style={labelSt}>{label}</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: '"JetBrains Mono", monospace', color: MUTED }}>₹</span>
                          <input
                            type="number" min={0} placeholder="0"
                            onChange={e => update(key, parseRupees(e.target.value))}
                            style={{ ...inputSt, paddingLeft: 32, fontFamily: '"JetBrains Mono", monospace' }}
                            onFocus={e => (e.currentTarget.style.borderColor = BLACK)}
                            onBlur={e => (e.currentTarget.style.borderColor = B)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 32, padding: 20, border: `1px solid ${B}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: BLACK, marginBottom: 6 }}>After you submit</p>
                <p style={{ fontSize: 13, color: MID, lineHeight: 1.6 }}>
                  Your listing goes into the review queue. We typically approve within 2–4 hours
                  between 9 am and 9 pm IST. You&apos;ll get a Telegram message when it goes live.
                </p>
              </div>
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div style={{ marginTop: 20, padding: '12px 14px', border: '1px solid #ffc5c5', background: '#fff5f5', fontSize: 13, color: '#B91C1C' }}>
              {submitError}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{
          padding: '40px 28px', background: OFF,
          position: 'sticky', top: 164, alignSelf: 'start',
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 20 }}>
            Your progress
          </p>

          {/* Step list */}
          <div style={{ marginBottom: 32 }}>
            {STEPS.map((label, i) => {
              const state = i < step ? 'done' : i === step ? 'active' : 'pending';
              return (
                <div key={label} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '13px 0',
                  borderBottom: i < STEPS.length - 1 ? `1px solid ${B}` : 'none',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, marginTop: 1,
                    background: state === 'done' ? ACCENT : state === 'active' ? BLACK : B,
                    color:      state === 'done' ? BLACK  : state === 'active' ? '#fff' : MUTED,
                  }}>
                    {state === 'done' ? '✓' : i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: state === 'pending' ? MUTED : BLACK, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{STEP_SIDEBAR_DESCS[i]}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tips */}
          <div style={{ border: `1px solid ${B}`, background: '#fff', padding: 18 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED, marginBottom: 14 }}>
              Tips for this step
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {STEP_TIPS[step].map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: ACCENT, flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 12, color: MID, lineHeight: 1.5 }}>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── Footer bar ── */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 40,
        borderTop: `1px solid ${B}`, padding: '18px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#fff',
      }}>
        <span style={{ fontSize: 12, color: MUTED }}>
          Step {step + 1} of {STEPS.length} — <strong style={{ color: BLACK }}>{STEPS[step]}</strong>
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            style={{
              padding: '11px 24px', background: 'none',
              border: `1.5px solid ${B}`, color: step === 0 ? '#ccc' : MID,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: step === 0 ? 'not-allowed' : 'pointer', fontFamily: font,
              opacity: step === 0 ? 0.4 : 1, transition: 'border-color 0.15s',
            }}
          >
            ← Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={handleContinue}
              disabled={!canAdvance()}
              style={{
                padding: '11px 32px', background: ACCENT, color: BLACK, border: 'none',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: !canAdvance() ? 'not-allowed' : 'pointer', fontFamily: font,
                opacity: !canAdvance() ? 0.4 : 1, transition: 'opacity 0.15s',
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance() || submitting}
              style={{
                padding: '11px 32px', background: ACCENT, color: BLACK, border: 'none',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: !canAdvance() || submitting ? 'not-allowed' : 'pointer', fontFamily: font,
                opacity: !canAdvance() || submitting ? 0.5 : 1, transition: 'opacity 0.15s',
              }}
            >
              {submitting ? 'Submitting…' : draftId ? 'Resubmit for Review →' : 'Submit for Review →'}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
