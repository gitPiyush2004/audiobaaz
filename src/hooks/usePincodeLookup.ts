'use client';

import { useState, useCallback } from 'react';

interface PincodeResult {
  city:  string;
  state: string;
}

interface UsePincodeLookup {
  lookup:   (pincode: string) => Promise<PincodeResult | null>;
  loading:  boolean;
}

export function usePincodeLookup(): UsePincodeLookup {
  const [loading, setLoading] = useState(false);

  const lookup = useCallback(async (pincode: string): Promise<PincodeResult | null> => {
    if (pincode.length !== 6) return null;
    setLoading(true);
    try {
      const res  = await fetch(`/api/pincode/${pincode}`);
      const data = await res.json();
      if (!data.city) return null;
      return { city: data.city, state: data.state };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookup, loading };
}
