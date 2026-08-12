import { useState } from "react";

const AD_SPACES = [
  {
    id: "hero_banner",
    name_ar: "البانر الرئيسي",
    name_en: "Hero Banner",
    location_ar: "أعلى الصفحة الرئيسية",
    size: "1200×200",
    daily: 500, weekly: 2500, monthly: 8000,
    slots: 1, available: 1,
    desc_ar: "أعلى مستوى رؤية — يظهر فوق كل شيء",
    emoji: "🖥️", color: "from-violet-600 to-purple-700",
    preview_h: "h-10",
  },
  {
    id: "sidebar_right",
    name_ar: "الشريط الجانبي",
    name_en: "Right Sidebar",
    location_ar: "صفحة الميزات — جانب أيمن",
    size: "300×600",
    daily: 200, weekly: 1000, monthly: 3000,
    slots: 2, available: 2,
    desc_ar: "ظهور بجانب محتوى الميزات",
    emoji: "📱", color: "from-blue-600 to-cyan-600",
    preview_h: "h-20",
  },
  {
    id: "pricing_banner",
    name_ar: "بانر الأسعار",
    name_en: "Pricing Banner",
    location_ar: "فوق جدول الأسعار",
    size: "970×90",
    daily: 300, weekly: 1500, monthly: 5000,
    slots: 1, available: 1,
    desc_ar: "يراه العملاء عند مقارنة الأسعار",
    emoji: "💰", color: "from-amber-500 to-orange-600",
    preview_h: "h-8",
  },
  {
    id: "blog_inline",
    name_ar: "داخل المحتوى",
    name_en: "In-Content Ad",
    location_ar: "صفحات الدليل والمدونة",
    size: "728×90",
    daily: 150, weekly: 800, monthly: 2500,
    slots: 3, available: 3,
    desc_ar: "بين فقرات المحتوى — نسبة نقر عالية",
    emoji: "📝", color: "from-teal-600 to-emerald-600",
    preview_h: "h-8",
  },
  {
    id: "footer_banner",
    name_ar: "بانر التذييل",
    name_en: "Footer Banner",
    location_ar: "أسفل كل صفحة",
    size: "1200×100",
    daily: 100, weekly: 500, monthly: 1500,
    slots: 2, available: 2,
    desc_ar: "يظهر في نهاية كل صفحة",
    emoji: "📌", color: "from-slate-600 to-gray-700",
    preview_h: "h-8",
  },
  {
    id: "popup_ad",
    name_ar: "إعلان منبثق",
    name_en: "Popup Ad",
    location_ar: "نافذة عند الدخول أو الخروج",
    size: "600×400",
    daily: 400, weekly: 2000, monthly: 6000,
    slots: 1, available: 0,
    desc_ar: "أعلى معدل تحويل — مرة واحدة لكل زيارة",
    emoji: "⚡", color: "from-rose-600 to-pink-600",
    preview_h: "h-16",
  },
];

const PAYMENT_METHODS = [
  { id: "instapay", label: "📱 InstaPay", detail: "00201006008552" },
  { id: "vodafone_cash", label: "📲 فودافون كاش", detail: "00201012625529" },
  { id: "bank_transfer", label: "🏦 تحويل بنكي", detail: "" },
];

export default function AdsPage() {
  const [tab, setTab] = useState("spaces");
  const [dur, setDur] = useState("monthly");
  const [booking, setBooking] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", title: "", url: "", method: "instapay", ref: "" });
  const [submitted, setSubmitted] = useState(false);
  const [adsense, setAdsense] = useState({ enabled: false, clientId: "" });

  const price = (sp) => ({ daily: sp.daily, weekly: sp.weekly, monthly: sp.monthly }[dur]);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white" dir="rtl">

      {/* ─── HERO ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-purple-900/20 to-transparent" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-2xl translate-x-1/2 translate-y-1/2" />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-3 py-1 rounded-full">
              📢 إعلن معنا
            </span>
          </div>
          <h1 className="text-5xl font-black leading-tight mb-4">
            أعلن على{" "}
            <span className="bg-gradient-to-l from-violet-400 to-purple-300 bg-clip-text text-transparent">
              DataLife Account
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl leading-relaxed">
            اوصل لآلاف أصحاب الشركات والمحاسبين والمديرين الماليين يومياً — عبر مساحات إعلانية مستهدفة بدقة
          </p>

          {/* Stats */}
          <div className="flex gap-8 mt-8">
            {[
              { n: "+5,000", l: "زيارة يومية" },
              { n: "98%", l: "من قطاع الأعمال" },
              { n: "6", l: "مساحة إعلانية" },
            ].map((s, i) => (
              <div key={i}>
                <p className="text-3xl font-black text-white">{s.n}</p>
                <p className="text-gray-500 text-sm">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── TABS ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#0a0d14]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 flex gap-6">
          {[
            { id: "spaces", l: "المساحات الإعلانية" },
            { id: "preview", l: "معاينة على الموقع" },
            { id: "book", l: "احجز الآن" },
            { id: "adsense", l: "⚙️ AdSense" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-4 text-sm font-medium border-b-2 transition-all ${
                tab === t.id
                  ? "border-violet-500 text-violet-300"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ─── AD SPACES TAB ─────────────────────────────── */}
        {tab === "spaces" && (
          <div>
            {/* Duration selector */}
            <div className="flex items-center gap-3 mb-8">
              <span className="text-gray-400 text-sm">عرض الأسعار:</span>
              {["daily", "weekly", "monthly"].map(d => (
                <button
                  key={d}
                  onClick={() => setDur(d)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    dur === d
                      ? "bg-violet-600 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {d === "daily" ? "يومي" : d === "weekly" ? "أسبوعي" : "شهري"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {AD_SPACES.map(sp => (
                <div
                  key={sp.id}
                  className={`relative rounded-2xl border overflow-hidden transition-all hover:scale-[1.02] ${
                    sp.available === 0
                      ? "border-white/5 opacity-60"
                      : "border-white/10 hover:border-violet-500/50"
                  }`}
                  style={{ background: "linear-gradient(145deg, #12151f, #0d1018)" }}
                >
                  {/* Top gradient bar */}
                  <div className={`h-1 w-full bg-gradient-to-l ${sp.color}`} />

                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-2xl">{sp.emoji}</span>
                        <h3 className="font-bold text-white mt-1">{sp.name_ar}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{sp.location_ar}</p>
                      </div>
                      {sp.available === 0 ? (
                        <span className="text-xs bg-red-900/40 text-red-400 border border-red-800/50 px-2 py-1 rounded-full">ممتلئ</span>
                      ) : (
                        <span className="text-xs bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-1 rounded-full">
                          {sp.available} متاح
                        </span>
                      )}
                    </div>

                    {/* Visual size preview */}
                    <div className={`w-full ${sp.preview_h} rounded-lg bg-gradient-to-l ${sp.color} opacity-20 mb-3 flex items-center justify-center`}>
                      <span className="text-xs text-white/60">{sp.size}</span>
                    </div>

                    <p className="text-xs text-gray-400 mb-4">{sp.desc_ar}</p>

                    {/* Price */}
                    <div className="flex items-end gap-1 mb-4">
                      <span className={`text-3xl font-black bg-gradient-to-l ${sp.color} bg-clip-text text-transparent`}>
                        {price(sp).toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-sm mb-1">ج.م / {dur === "daily" ? "يوم" : dur === "weekly" ? "أسبوع" : "شهر"}</span>
                    </div>

                    <button
                      onClick={() => { setBooking(sp); setTab("book"); }}
                      disabled={sp.available === 0}
                      className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                        sp.available === 0
                          ? "bg-white/5 text-gray-600 cursor-not-allowed"
                          : `bg-gradient-to-l ${sp.color} text-white hover:opacity-90`
                      }`}
                    >
                      {sp.available === 0 ? "غير متاح حالياً" : "احجز الآن"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── PREVIEW TAB ───────────────────────────────── */}
        {tab === "preview" && (
          <div className="space-y-6">
            <p className="text-gray-400 text-sm">معاينة توضيحية لمواضع الإعلانات على صفحة الموقع</p>

            {/* Simulated landing page */}
            <div className="border border-white/10 rounded-2xl overflow-hidden">
              {/* Hero banner zone */}
              <div className="bg-gradient-to-l from-violet-600/30 to-purple-700/30 border-b border-violet-500/30 p-3 flex items-center justify-center h-16 relative">
                <div className="absolute top-1 right-2 text-xs text-violet-400 bg-violet-900/40 px-2 py-0.5 rounded">🖥️ البانر الرئيسي — 1200×200</div>
                <span className="text-violet-300 font-bold text-sm">مساحة إعلانك هنا — أعلى مستوى رؤية</span>
              </div>

              {/* Simulated nav */}
              <div className="bg-[#0a0d14] border-b border-white/5 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-yellow-400 rounded-lg" />
                  <span className="text-sm font-bold">DataLife Account</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>الميزات</span><span>الأسعار</span><span>الدليل</span>
                </div>
              </div>

              {/* Content with sidebar */}
              <div className="grid grid-cols-4 min-h-48">
                <div className="col-span-3 p-6 border-l border-white/5">
                  {/* Inline ad */}
                  <div className="h-8 bg-gradient-to-l from-teal-600/20 to-emerald-600/20 border border-teal-500/30 rounded-lg mb-4 flex items-center justify-center">
                    <span className="text-xs text-teal-400">📝 إعلان داخل المحتوى — 728×90</span>
                  </div>
                  <div className="space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-2 bg-white/5 rounded w-full" />)}
                    <div className="h-2 bg-white/5 rounded w-3/4" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="h-full bg-gradient-to-b from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl mb-1">📱</div>
                      <span className="text-xs text-blue-400 text-center">الشريط الجانبي<br/>300×600</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing banner */}
              <div className="h-10 bg-gradient-to-l from-amber-500/20 to-orange-600/20 border-y border-amber-500/20 flex items-center justify-center">
                <span className="text-xs text-amber-400">💰 بانر الأسعار — 970×90 — يظهر فوق جدول الاشتراكات</span>
              </div>

              {/* Footer */}
              <div className="h-10 bg-gradient-to-l from-slate-600/20 to-gray-700/20 border-t border-white/5 flex items-center justify-center">
                <span className="text-xs text-gray-500">📌 بانر التذييل — 1200×100 — أسفل كل صفحة</span>
              </div>
            </div>

            {/* Popup illustration */}
            <div className="border border-rose-500/30 rounded-2xl p-6 bg-rose-900/10">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <h4 className="font-bold text-rose-300">الإعلان المنبثق</h4>
                  <p className="text-xs text-gray-500">يظهر مرة واحدة عند دخول الزائر أو محاولة المغادرة</p>
                </div>
                <span className="mr-auto text-xs bg-red-900/40 text-red-400 px-2 py-1 rounded-full border border-red-800/50">ممتلئ حالياً</span>
              </div>
              <div className="w-48 h-32 bg-gradient-to-br from-rose-600/30 to-pink-600/30 border border-rose-500/30 rounded-xl flex items-center justify-center mx-auto">
                <span className="text-xs text-rose-400 text-center">600×400<br/>أعلى معدل تحويل</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── BOOK TAB ──────────────────────────────────── */}
        {tab === "book" && (
          <div className="max-w-2xl mx-auto">
            {submitted ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">✅</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-2">تم إرسال طلب الحجز!</h2>
                <p className="text-gray-400">سيتم التواصل معك خلال 24 ساعة لتأكيد الدفع وتفعيل الإعلان</p>
                <button onClick={() => { setSubmitted(false); setBooking(null); setTab("spaces"); }}
                  className="mt-8 px-6 py-3 bg-violet-600 rounded-xl font-bold hover:bg-violet-700 transition-colors">
                  عرض المساحات الأخرى
                </button>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-black mb-6">
                  {booking ? `احجز: ${booking.name_ar}` : "احجز مساحة إعلانية"}
                </h2>

                {/* Space selector */}
                {!booking && (
                  <div className="mb-6">
                    <label className="text-xs text-gray-400 block mb-2">اختر المساحة</label>
                    <div className="grid grid-cols-2 gap-2">
                      {AD_SPACES.filter(s => s.available > 0).map(sp => (
                        <button key={sp.id} onClick={() => setBooking(sp)}
                          className={`p-3 rounded-xl border text-right transition-all ${
                            booking?.id === sp.id
                              ? "border-violet-500 bg-violet-900/20"
                              : "border-white/10 hover:border-white/20"
                          }`}>
                          <div className="flex items-center gap-2">
                            <span>{sp.emoji}</span>
                            <div>
                              <p className="text-sm font-medium">{sp.name_ar}</p>
                              <p className="text-xs text-gray-500">{sp.monthly.toLocaleString()} ج.م/شهر</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {booking && (
                  <div className="space-y-4">
                    {/* Selected space summary */}
                    <div className={`p-4 rounded-xl bg-gradient-to-l ${booking.color} bg-opacity-20 border border-white/10`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold">{booking.emoji} {booking.name_ar}</span>
                          <p className="text-xs text-white/60">{booking.size} — {booking.location_ar}</p>
                        </div>
                        <button onClick={() => setBooking(null)} className="text-white/40 hover:text-white/70">✕</button>
                      </div>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">مدة الحجز</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "daily", label: "يومي", p: booking.daily },
                          { id: "weekly", label: "أسبوعي", p: booking.weekly },
                          { id: "monthly", label: "شهري", p: booking.monthly },
                        ].map(d => (
                          <button key={d.id} onClick={() => setDur(d.id)}
                            className={`p-3 rounded-xl border text-center transition-all ${dur === d.id ? "border-violet-500 bg-violet-900/20" : "border-white/10"}`}>
                            <p className="text-xs text-gray-400">{d.label}</p>
                            <p className="font-black text-white">{d.p.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">ج.م</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Form fields */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "name", label: "الاسم *", type: "text" },
                        { key: "email", label: "البريد الإلكتروني *", type: "email" },
                        { key: "phone", label: "رقم الهاتف", type: "tel" },
                        { key: "title", label: "عنوان الإعلان", type: "text" },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-xs text-gray-400 block mb-1">{f.label}</label>
                          <input type={f.type} value={form[f.key]}
                            onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">رابط الإعلان (URL)</label>
                      <input type="url" placeholder="https://..." value={form.url}
                        onChange={e => setForm(v => ({ ...v, url: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
                    </div>

                    {/* Payment method */}
                    <div>
                      <label className="text-xs text-gray-400 block mb-2">طريقة الدفع</label>
                      <div className="space-y-2">
                        {PAYMENT_METHODS.map(m => (
                          <button key={m.id} onClick={() => setForm(v => ({ ...v, method: m.id }))}
                            className={`w-full p-3 rounded-xl border text-right flex items-center justify-between transition-all ${
                              form.method === m.id ? "border-violet-500 bg-violet-900/20" : "border-white/10"
                            }`}>
                            <span className="text-sm font-medium">{m.label}</span>
                            {m.detail && <span className="text-xs text-gray-500 font-mono">{m.detail}</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-400 block mb-1">رقم الإيصال / المرجع</label>
                      <input type="text" value={form.ref}
                        onChange={e => setForm(v => ({ ...v, ref: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
                    </div>

                    {/* Total + Submit */}
                    <div className="bg-violet-900/20 border border-violet-500/30 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">الإجمالي</p>
                        <p className="text-3xl font-black text-violet-300">{price(booking).toLocaleString()} ج.م</p>
                      </div>
                      <button
                        onClick={() => { if (form.name && form.email) setSubmitted(true); }}
                        className="px-8 py-3 bg-gradient-to-l from-violet-600 to-purple-600 rounded-xl font-black hover:opacity-90 transition-opacity"
                      >
                        إرسال الطلب
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── ADSENSE TAB ───────────────────────────────── */}
        {tab === "adsense" && (
          <div className="max-w-xl mx-auto space-y-5">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">G</span>
              </div>
              <h2 className="text-xl font-black">إعدادات Google AdSense</h2>
              <p className="text-gray-500 text-sm mt-1">يظهر في المساحات الخالية من الحجوزات اليدوية</p>
            </div>

            <div className="rounded-2xl border border-white/10 p-5 space-y-4" style={{ background: "#12151f" }}>
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تفعيل AdSense</p>
                  <p className="text-xs text-gray-500">عرض إعلانات Google في المساحات الفارغة</p>
                </div>
                <button
                  onClick={() => setAdsense(a => ({ ...a, enabled: !a.enabled }))}
                  className={`w-14 h-7 rounded-full transition-colors relative ${adsense.enabled ? "bg-blue-600" : "bg-white/10"}`}
                >
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${adsense.enabled ? "right-1" : "right-8"}`} />
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">AdSense Publisher ID</label>
                <input
                  placeholder="ca-pub-0000000000000000"
                  value={adsense.clientId}
                  onChange={e => setAdsense(a => ({ ...a, clientId: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-mono text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              {["hero_banner","sidebar_right","pricing_banner","blog_inline","footer_banner"].map(slot => {
                const sp = AD_SPACES.find(s => s.id === slot);
                return (
                  <div key={slot} className="flex items-center gap-3">
                    <span className="text-sm">{sp?.emoji}</span>
                    <span className="text-xs text-gray-400 w-32">{sp?.name_ar}</span>
                    <input placeholder="Ad Unit Slot ID"
                      className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none" />
                  </div>
                );
              })}

              <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-3 text-xs text-amber-400">
                ⚡ عند وجود حجز يدوي نشط — يتم عرض الإعلان اليدوي ويتوقف AdSense لتلك المساحة تلقائياً
              </div>

              <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-colors">
                حفظ إعدادات AdSense
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
