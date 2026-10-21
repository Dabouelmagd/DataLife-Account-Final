/*
 * «ثبّت التطبيق على موبايلك» — one tap on Android/Chrome (beforeinstallprompt),
 * step-by-step hint on iPhone Safari (Apple gives no install button).
 * Hidden when already installed or dismissed.
 */
import React, { useEffect, useState } from 'react';
import { Smartphone, X, Share } from 'lucide-react';

const KEY = 'dl_install_hint_dismissed';
const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } };
const save = () => { try { localStorage.setItem(KEY, '1'); } catch (_) { /* ignore */ } };

export default function InstallAppHint({ className = '' }) {
  const [deferred, setDeferred] = useState(null);
  const [hidden, setHidden] = useState(read());
  const standalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = isIOS || /Android/i.test(ua);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden || standalone || !isMobile || (!isIOS && !deferred)) return null;

  const close = () => { save(); setHidden(true); };
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (_) { /* ignore */ }
    setDeferred(null); close();
  };

  return (
    <div className={`flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-teal-900 ${className}`} dir="rtl" role="note">
      <Smartphone className="w-5 h-5 mt-0.5 shrink-0" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-bold">ثبّت البرنامج على موبايلك</p>
        {isIOS ? (
          <p className="mt-0.5 text-teal-800">
            من Safari اضغط زر المشاركة <Share className="inline w-4 h-4 -mt-0.5" aria-label="مشاركة" /> ثم «إضافة إلى الشاشة الرئيسية» — هتلاقي أيقونة تفتح بوابتك على طول.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-teal-800">أيقونة على الشاشة الرئيسية تفتح بوابتك مباشرة — الحضور والإجازات وقسائم الراتب.</p>
            <button type="button" onClick={install}
              className="mt-2 px-4 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-bold hover:bg-teal-700">تثبيت</button>
          </>
        )}
      </div>
      <button type="button" onClick={close} aria-label="إغلاق" className="p-1 rounded hover:bg-teal-100"><X className="w-4 h-4" /></button>
    </div>
  );
}
