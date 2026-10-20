/**
 * idleLogout — تسجيل خروج تلقائي بعد فترة بدون نشاط (حماية البيانات المالية)
 *
 * Replaces the two per-tab idle timers (contexts/AuthContext.jsx and
 * hooks/useIdleTimeout.js), which had these problems:
 *  - each tab timed out on its own: a background tab left open for 30 minutes
 *    removed the shared token and signed the user out of the tab they were
 *    actively working in;
 *  - the token was only deleted from the browser, never revoked on the server,
 *    so a copy of it kept working for the rest of its 8 hours;
 *  - the login page shows nothing for ?reason=idle, so the user didn't know
 *    why they were signed out;
 *  - useIdleTimeout re-armed on every render (inline callbacks), and its
 *    2-minute warning never cleared when the user became active again.
 *
 * Here the last activity is shared through localStorage, so activity in any
 * tab keeps every tab alive and a sign-out in one tab signs out the others.
 * Timing is checked against the clock (not one long setTimeout), so a laptop
 * waking from sleep after an hour logs out at once.
 */
import { useEffect, useRef } from 'react';

export const IDLE_LOGOUT_MINUTES = 30;      // change here to tune the policy
export const IDLE_WARNING_SECONDS = 120;    // warn this long before signing out

export const IDLE_MESSAGE_AR = `تم تسجيل خروجك تلقائياً بعد ${IDLE_LOGOUT_MINUTES} دقيقة بدون أي نشاط، لحماية بيانات شركتك. سجّل الدخول مرة أخرى للمتابعة.`;
export const IDLE_MESSAGE_EN = `You were signed out automatically after ${IDLE_LOGOUT_MINUTES} minutes without activity, to protect your company's data. Please sign in again.`;
export const EXPIRED_MESSAGE_AR = 'انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى.';
export const EXPIRED_MESSAGE_EN = 'Your session has expired. Please sign in again.';

const ACTIVITY_KEY = 'dl_last_activity';
const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
const CHECK_EVERY_MS = 5000;
const WRITE_EVERY_MS = 5000;               // don't hammer localStorage on mousemove

const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
const remove = (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

/** Revoke the token on the server, clear it here, and go to the login page. */
export function idleSignOut(reason = 'idle') {
  const token = read('token');
  if (token) {
    const api = (process.env.REACT_APP_BACKEND_URL || '');
    try {
      // keepalive lets the request finish while the page navigates away
      fetch(`${api}/api/auth/logout`, {
        method: 'POST', keepalive: true, headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    } catch (e) { /* ignore */ }
  }
  remove('token');
  remove('user');
  remove(ACTIVITY_KEY);
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = `/login?reason=${reason}`;
  }
}

/**
 * Start watching. Returns a stop() function.
 *   onWarning(secondsLeft) — called each check during the warning window
 *   onActive()             — called once when activity resumes after a warning
 */
export function startIdleLogout({
  minutes = IDLE_LOGOUT_MINUTES, warningSeconds = IDLE_WARNING_SECONDS,
  onWarning, onActive, onLogout,
} = {}) {
  const timeoutMs = minutes * 60 * 1000;
  const warnMs = warningSeconds * 1000;
  let lastLocal = Date.now();
  let lastWrite = 0;
  let warned = false;
  let done = false;

  const lastActivity = () => Math.max(lastLocal, Number(read(ACTIVITY_KEY)) || 0);

  const check = () => {
    if (done) return;
    if (!read('token')) {                  // signed out (here or in another tab)
      done = true;
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
      return;
    }
    const idle = Date.now() - lastActivity();
    if (idle >= timeoutMs) {
      done = true;
      if (onLogout) onLogout(); else idleSignOut('idle');
    } else if (idle >= timeoutMs - warnMs) {
      warned = true;
      if (onWarning) onWarning(Math.ceil((timeoutMs - idle) / 1000));
    } else if (warned) {
      warned = false;
      if (onActive) onActive();
    }
  };

  const activity = () => {
    const now = Date.now();
    lastLocal = now;
    if (now - lastWrite > WRITE_EVERY_MS) { lastWrite = now; write(ACTIVITY_KEY, String(now)); }
    if (warned) check();
  };

  const onStorage = (e) => {
    if (e.key === ACTIVITY_KEY || e.key === 'token') check();
  };
  const onVisible = () => { if (!document.hidden) check(); };

  // A fresh start counts as activity. Keep a newer value another tab wrote,
  // but drop one older than the timeout: it's from a previous session, and
  // reading it would sign the user out again the moment they log in.
  const stored = Number(read(ACTIVITY_KEY)) || 0;
  if (!stored || Date.now() - stored >= timeoutMs) write(ACTIVITY_KEY, String(Date.now()));
  EVENTS.forEach((ev) => window.addEventListener(ev, activity, { passive: true }));
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  const timer = setInterval(check, CHECK_EVERY_MS);

  return () => {
    done = true;
    clearInterval(timer);
    EVENTS.forEach((ev) => window.removeEventListener(ev, activity));
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  };
}

/**
 * React hook. Callbacks are kept in refs, so inline functions don't restart
 * the timer on every render.
 *   useIdleLogout({ enabled: !!user, onWarning: setIdleWarning, onActive: () => setIdleWarning(false) })
 */
export function useIdleLogout({ enabled = true, minutes, warningSeconds, onWarning, onActive, onLogout } = {}) {
  const cb = useRef({});
  cb.current = { onWarning, onActive, onLogout };
  useEffect(() => {
    if (!enabled) return undefined;
    return startIdleLogout({
      minutes, warningSeconds,
      onWarning: (s) => cb.current.onWarning && cb.current.onWarning(s),
      onActive: () => cb.current.onActive && cb.current.onActive(),
      onLogout: () => (cb.current.onLogout ? cb.current.onLogout() : idleSignOut('idle')),
    });
  }, [enabled, minutes, warningSeconds]);
}

/** Message for the login page: idleLogoutMessage(window.location.search, isArabic) → string | null */
export function idleLogoutMessage(search, isArabic = true) {
  let reason = null;
  try { reason = new URLSearchParams(search || '').get('reason'); } catch (e) { reason = null; }
  if (reason === 'idle') return isArabic ? IDLE_MESSAGE_AR : IDLE_MESSAGE_EN;
  if (reason === 'expired') return isArabic ? EXPIRED_MESSAGE_AR : EXPIRED_MESSAGE_EN;
  return null;
}
