/**
 * useIdleTimeout — Auto logout after inactivity
 * حماية البيانات المالية: تسجيل خروج تلقائي بعد فترة خمول
 */

import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle
const WARNING_BEFORE_MS = 2 * 60 * 1000; // warn 2 min before

export function useIdleTimeout({ onLogout, onWarning }) {
  const timerRef   = useRef(null);
  const warningRef = useRef(null);

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(warningRef.current);

    // Warning 2 minutes before logout
    warningRef.current = setTimeout(() => {
      if (onWarning) onWarning(WARNING_BEFORE_MS / 1000);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Auto logout after idle
    timerRef.current = setTimeout(() => {
      if (onLogout) onLogout();
    }, IDLE_TIMEOUT_MS);
  }, [onLogout, onWarning]);

  useEffect(() => {
    const events = ['mousedown','mousemove','keypress','scroll','touchstart','click'];
    const reset  = () => resetTimer();

    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    resetTimer(); // start on mount

    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      clearTimeout(timerRef.current);
      clearTimeout(warningRef.current);
    };
  }, [resetTimer]);
}
