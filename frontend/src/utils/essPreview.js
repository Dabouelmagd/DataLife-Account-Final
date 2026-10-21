/**
 * «معاينة بوابة الموظف» — HR / top management open /my-portal exactly as one
 * employee sees it, in a new tab, with a 30-minute READ-ONLY token
 * (POST /api/ess/preview-token). The admin's own login (localStorage token)
 * is never touched: the portal tab keeps the preview token in sessionStorage.
 */
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;
export const PREVIEW_KEY = 'ess_preview_token';

export async function openEmployeePortalPreview(employeeId) {
  // open the tab now, inside the click, so the popup blocker lets it through
  const win = window.open('', '_blank');
  try {
    const { data } = await axios.post(`${API}/api/ess/preview-token`, { employee_id: employeeId },
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const url = `/my-portal?preview=${encodeURIComponent(data.token)}`;
    if (win) { win.opener = null; win.location.href = url; } else { window.open(url, '_blank', 'noopener'); }
    return { ok: true };
  } catch (e) {
    if (win) win.close();
    return { ok: false, error: e.response?.data?.detail || 'تعذّر فتح المعاينة' };
  }
}

/** The preview token for this tab, or null. Reads ?preview=<token> once, keeps
 * it in sessionStorage (this tab only) and takes it out of the address bar. */
export function readPreviewToken() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('preview');
    if (fromUrl && fromUrl.length > 20) {
      sessionStorage.setItem(PREVIEW_KEY, fromUrl);
      params.set('preview', '1');
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    }
    if (!params.has('preview')) return null;
    return sessionStorage.getItem(PREVIEW_KEY) || null;
  } catch {
    return null;
  }
}

export function isPreviewUrl() {
  try { return new URLSearchParams(window.location.search).has('preview'); } catch { return false; }
}
