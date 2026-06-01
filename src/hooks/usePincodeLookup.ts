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
      const res  = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      const office = data?.[0]?.PostOffice?.[0];
      if (!office) return null;
      return {
        city:  office.District ?? office.Division ?? '',
        state: office.State ?? '',
      };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookup, loading };
}
