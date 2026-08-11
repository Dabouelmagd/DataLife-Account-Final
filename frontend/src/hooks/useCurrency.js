/**
 * useCurrency — Auto-detect currency based on user country
 * Egypt → EGP (prices as-is)
 * Outside Egypt → USD (EGP ÷ 30, rounded)
 */

import { useState, useEffect } from 'react';

const EGP_TO_USD_RATE = 30; // 1 USD = 30 EGP

export function useCurrency() {
  const [currency, setCurrency] = useState('EGP');
  const [country, setCountry]   = useState('EG');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    detectCountry();
  }, []);

  const detectCountry = async () => {
    // 1. Check localStorage cache (valid 24h)
    const cached = localStorage.getItem('dl_country_cache');
    if (cached) {
      try {
        const { countryCode, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          applyCountry(countryCode);
          setLoading(false);
          return;
        }
      } catch {}
    }

    // 2. Detect via IP
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      const code = data.country_code || 'EG';
      localStorage.setItem('dl_country_cache', JSON.stringify({ countryCode: code, timestamp: Date.now() }));
      applyCountry(code);
    } catch {
      // Fallback: check browser language
      const lang = navigator.language || 'ar';
      const isArabic = lang.startsWith('ar');
      applyCountry(isArabic ? 'EG' : 'US');
    }
    setLoading(false);
  };

  const applyCountry = (code) => {
    setCountry(code);
    setCurrency(code === 'EG' ? 'EGP' : 'USD');
  };

  const convertPrice = (priceEGP) => {
    if (currency === 'EGP') return { amount: priceEGP, display: `${priceEGP.toLocaleString()} ج.م` };
    const usd = Math.ceil(priceEGP / EGP_TO_USD_RATE);
    return { amount: usd, display: `$${usd}` };
  };

  const formatPrice = (priceEGP, lang = 'ar') => {
    const { display } = convertPrice(priceEGP);
    return display;
  };

  const isEgypt = country === 'EG';

  return { currency, country, isEgypt, loading, convertPrice, formatPrice, rate: EGP_TO_USD_RATE };
}
