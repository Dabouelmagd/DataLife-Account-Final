/**
 * طابور نقاط البيع بدون إنترنت — POS offline queue.
 *
 * Pending POS operations live in IndexedDB (in memory when IndexedDB is not
 * available, e.g. private windows):
 *   { client_uuid, kind: 'sale' | 'return', shift_id, payload, created_at,
 *     attempts, last_error, failed }
 * The server de-duplicates on client_uuid, so an operation may be sent any
 * number of times — a retry after a lost response returns the first result.
 *
 * flush(send) uploads oldest first. A network error (no response, 5xx, 408,
 * 409 in-flight, 429) stops the flush and keeps the order; a validation error
 * (other 4xx) marks that operation failed so the cashier sees it, and the
 * flush moves on.
 *
 * A small key/value cache in the same database keeps the product list and the
 * open shift for offline use.
 */

const DB_NAME = 'dl-pos';
const DB_VERSION = 1;
const QUEUE = 'queue';
const CACHE = 'cache';

const mem = { [QUEUE]: new Map(), [CACHE]: new Map() };
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(QUEUE)) d.createObjectStore(QUEUE, { keyPath: 'client_uuid' });
        if (!d.objectStoreNames.contains(CACHE)) d.createObjectStore(CACHE, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
  return dbPromise;
}

// fn returns either a plain value or { result } (an IDBRequest, or the
// in-memory stand-in for one); both come back unwrapped
const unwrap = (out) => (out && typeof out === 'object' && 'result' in out ? out.result : out);

async function tx(store, mode, fn) {
  const d = await openDb();
  if (!d) return unwrap(fn(null));
  return new Promise((resolve) => {
    try {
      const t = d.transaction(store, mode);
      const out = fn(t.objectStore(store));
      t.oncomplete = () => resolve(unwrap(out));
      t.onerror = () => resolve(undefined);
      t.onabort = () => resolve(undefined);
    } catch (e) {
      resolve(unwrap(fn(null)));        // IndexedDB refused: use memory
    }
  });
}

const put = (store, value) => tx(store, 'readwrite', (s) => {
  if (!s) { mem[store].set(value.client_uuid || value.key, value); return value; }
  s.put(value); return value;
});
const del = (store, key) => tx(store, 'readwrite', (s) => {
  if (!s) { mem[store].delete(key); return true; }
  s.delete(key); return true;
});
const getOne = (store, key) => tx(store, 'readonly', (s) => (s ? s.get(key) : { result: mem[store].get(key) }));
const getAll = (store) => tx(store, 'readonly', (s) => (s ? s.getAll() : { result: [...mem[store].values()] }));

// ── listeners ───────────────────────────────────────────────
const listeners = new Set();
async function notify() {
  const ops = await pendingOps();
  listeners.forEach((fn) => { try { fn(ops); } catch (e) { /* listener errors are not ours */ } });
}
export function subscribe(fn) {
  listeners.add(fn);
  pendingOps().then(fn);
  return () => listeners.delete(fn);
}

// ── queue ───────────────────────────────────────────────────
export function newClientUuid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* fall through */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function pendingOps() {
  const all = (await getAll(QUEUE)) || [];
  return all.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

export async function enqueue({ client_uuid, kind, shift_id, payload }) {
  const existing = await getOne(QUEUE, client_uuid);
  const op = existing || {
    client_uuid, kind, shift_id, payload: { ...payload, client_uuid },
    created_at: new Date().toISOString(), attempts: 0, last_error: '', failed: false,
  };
  await put(QUEUE, op);
  await notify();
  return op;
}

export async function discard(client_uuid) {
  await del(QUEUE, client_uuid);
  await notify();
}

/** true when the request should be retried later (not a validation error). */
export function isRetryable(e) {
  if (!e || !e.response) return true;                 // offline / DNS / CORS / timeout
  const st = e.response.status;
  return st >= 500 || st === 408 || st === 409 || st === 429;
}

let flushing = null;
/** send(op) → Promise; resolves once the server stored it. Returns counts. */
export function flush(send) {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    let failed = 0;
    try {
      const ops = (await pendingOps()).filter((o) => !o.failed);
      for (const op of ops) {
        try {
          await send(op);
          await del(QUEUE, op.client_uuid);
          sent += 1;
        } catch (e) {
          const detail = e?.response?.data?.detail;
          const msg = typeof detail === 'string' ? detail : (e?.message || 'خطأ');
          if (isRetryable(e)) {
            await put(QUEUE, { ...op, attempts: (op.attempts || 0) + 1, last_error: msg });
            break;                                      // keep FIFO: try again later from here
          }
          await put(QUEUE, { ...op, attempts: (op.attempts || 0) + 1, last_error: msg, failed: true });
          failed += 1;
        }
      }
    } finally {
      flushing = null;
      await notify();
    }
    return { sent, failed };
  })();
  return flushing;
}

/** Flush now, on 'online', and every 30 s while anything is pending. */
export function startAutoFlush(send, onFlushed) {
  let stopped = false;
  const run = async () => {
    if (stopped) return;
    const ops = await pendingOps();
    if (!ops.some((o) => !o.failed)) return;
    const r = await flush(send);
    if (onFlushed && r.sent) onFlushed(r);
  };
  const onOnline = () => { run(); };
  window.addEventListener('online', onOnline);
  const timer = setInterval(run, 30000);
  run();
  return () => {
    stopped = true;
    window.removeEventListener('online', onOnline);
    clearInterval(timer);
  };
}

// ── offline cache (products, open shift) ────────────────────
export async function cacheSet(key, value) {
  await put(CACHE, { key, value, saved_at: new Date().toISOString() });
}
export async function cacheGet(key) {
  const row = await getOne(CACHE, key);
  return row ? row.value : null;
}

export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}
