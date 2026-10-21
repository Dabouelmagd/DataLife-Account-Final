/*
 * getPosition — one place for every «attendance by location» screen.
 *
 * Why it exists: a phone indoors often cannot get a high-accuracy GPS fix
 * within 10–15 s, and a laptop has no GPS at all, so a single
 * enableHighAccuracy request timed out and the employee only saw
 * "تعذّر تحديد الموقع". Here we try the precise fix first and, if it
 * times out or is unavailable, fall back to the network (Wi-Fi/cell)
 * position. The error carries a clear Arabic/English reason:
 *   blocked   — the site itself forbids location (Permissions-Policy header)
 *   denied    — the user (or the browser settings) refused permission
 *   insecure  — page not on HTTPS
 *   unavailable / timeout
 */

const MSG = {
  unsupported: ['المتصفح لا يدعم تحديد الموقع', 'This browser does not support location'],
  insecure: ['تحديد الموقع يحتاج فتح الموقع بـ https', 'Location needs the site to be opened over https'],
  blocked: ['تحديد الموقع مقفول من إعدادات السيرفر — تواصل مع الدعم الفني', 'Location is blocked by the server settings — contact support'],
  denied: ['تم رفض إذن الموقع. اضغط على علامة القفل بجوار عنوان الموقع ← الموقع (Location) ← سماح، ثم أعد المحاولة',
    'Location permission was denied. Click the lock icon next to the address → Location → Allow, then try again'],
  unavailable: ['تعذّر تحديد موقعك — شغّل الـ GPS / خدمات الموقع في الجهاز وأعد المحاولة', 'Could not get your location — turn on GPS / location services and retry'],
  timeout: ['تحديد الموقع أخذ وقتاً طويلاً — اقترب من نافذة أو شغّل الواي فاي وأعد المحاولة', 'Getting your location took too long — move near a window or turn on Wi-Fi and retry'],
};

function geoError(kind, ar = true) {
  const e = new Error(MSG[kind][ar ? 0 : 1]);
  e.kind = kind;
  return e;
}

function policyAllows() {
  try {
    const fp = document.featurePolicy || document.permissionsPolicy;
    if (fp && typeof fp.allowsFeature === 'function') return fp.allowsFeature('geolocation');
  } catch (_) { /* older browsers */ }
  return true;
}

function once(opts) {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));
}

export async function getPosition({ ar = true } = {}) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) throw geoError('insecure', ar);
  if (!navigator.geolocation) throw geoError('unsupported', ar);
  if (!policyAllows()) throw geoError('blocked', ar);
  try {
    return await once({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  } catch (err) {
    if (err && err.code === 1) throw geoError(policyAllows() ? 'denied' : 'blocked', ar);
    // 2 = unavailable, 3 = timeout → try the coarse (Wi-Fi / cell) position
    try {
      return await once({ enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 });
    } catch (err2) {
      if (err2 && err2.code === 1) throw geoError('denied', ar);
      throw geoError(err2 && err2.code === 3 ? 'timeout' : 'unavailable', ar);
    }
  }
}

export default getPosition;
