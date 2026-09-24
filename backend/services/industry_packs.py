"""
حزم حسابات القطاعات — Industry account packs.

These are NOT part of the default chart. A restaurant has no use for
subcontractor retention accounts, and a contractor has no use for kitchen
waste. Each pack is injected into a company's chart only when that company
subscribes to the pack, and removed from nobody — accounts that have been
posted to are never deleted.

Numbering follows THIS system's chart, not any external scheme: the codes in
the original sector proposal (151-155 for inventory, 161x for customers)
already mean something else here — marketable securities and cash — so
adopting them would have broken every existing posting. Each pack reuses what
the default chart already has (121-126 inventories, 141 retention, 315-317
construction costs, 415-419 medical revenue) and only adds what is missing.
"""

from models.accounting import AccountType, AccountCategory

# each entry: code, name, name_en, type, category, parent
A, L, E, R, EQ = (AccountType.ASSET, AccountType.LIABILITY, AccountType.EXPENSE,
                  AccountType.REVENUE, AccountType.EQUITY)
CA, CL, COGS, OPEX, REV = (AccountCategory.CURRENT_ASSET, AccountCategory.CURRENT_LIABILITY,
                           AccountCategory.COGS, AccountCategory.OPERATING_EXPENSE,
                           AccountCategory.OPERATING_REVENUE)

PACKS = {
    # ── 1) المقاولات والتشييد ────────────────────────────────────
    "construction": {
        "name_ar": "باقة المقاولات والتشييد",
        "name_en": "Construction & Contracting",
        "note_ar": "تضيف حسابات التشغيل تحت التنفيذ ومقاولي الباطن والمستخلصات",
        "accounts": [
            ("127", "تشغيل تحت التنفيذ — عقود مقاولات", "Contracts WIP", A, CA, "12"),
            ("128", "خامات ومواد تشوين بمواقع العمل", "Site Materials Stock", A, CA, "12"),
            ("143", "إيرادات مستحقة غير مفوترة — أعمال منجزة", "Unbilled Contract Revenue", A, CA, "14"),
            ("243", "مقاولو الباطن — دائنون", "Subcontractors Payable", L, CL, "24"),
            ("318", "إيجار وتشغيل معدات وأوناش وسقالات", "Equipment & Scaffolding Hire", E, COGS, "31"),
            ("319", "اختبارات جودة ومختبرات خرسانة وتربة", "Quality Testing & Labs", E, COGS, "31"),
            ("322", "تراخيص وتأمينات مواقع العمل", "Site Permits & Insurance", E, OPEX, "32"),
        ],
    },

    # ── 2) التطوير العقاري ───────────────────────────────────────
    "real_estate": {
        "name_ar": "باقة التطوير العقاري",
        "name_en": "Real Estate Development",
        "note_ar": "تضيف مخزون الوحدات والتزامات عقود العملاء وتكاليف التطوير",
        "accounts": [
            ("129", "مخزون وحدات تامة معدة للبيع", "Finished Units for Sale", A, CA, "12"),
            ("144", "شيكات مبيعات عقارية تحت التحصيل", "Property Cheques Under Collection", A, CA, "14"),
            ("245", "التزامات عقود عملاء — دفعات حجز وتعاقد", "Customer Contract Liabilities", L, CL, "24"),
            ("246", "ودائع صيانة محصلة من الحاجزين", "Maintenance Deposits Held", L, CL, "24"),
            ("323", "استشارات هندسية وتصميم وتراخيص", "Design & Engineering Consultancy", E, COGS, "32"),
            ("324", "عمولات ومصاريف تسويق المشاريع العقارية", "Property Sales Commissions", E, OPEX, "32"),
        ],
    },

    # ── 3) التصنيع ───────────────────────────────────────────────
    "manufacturing": {
        "name_ar": "باقة التصنيع والإنتاج",
        "name_en": "Manufacturing",
        "note_ar": "تضيف خامات التعبئة والهوالك وتفصيل التكاليف الصناعية",
        "accounts": [
            ("130", "مخزون خامات التعبئة والتغليف", "Packaging Materials Stock", A, CA, "12"),
            ("140", "مخزون الهوالك والعوادم والإنتاج المعيب", "Scrap & Defective Output", A, CA, "14"),
            ("325", "قوى محركة — كهرباء وغاز ووقود المصنع", "Factory Utilities & Power", E, COGS, "32"),
            ("326", "صيانة خطوط الإنتاج", "Production Line Maintenance", E, COGS, "32"),
            ("327", "أمن وسلامة وجودة صناعية ومختبرات", "Industrial Safety & QC", E, COGS, "32"),
        ],
    },

    # ── 4) الاستيراد ─────────────────────────────────────────────
    "import": {
        "name_ar": "باقة الاستيراد والتجارة الخارجية",
        "name_en": "Import & Foreign Trade",
        "note_ar": "تكمل مصاريف الاعتمادات: أرضيات وفحص ونقل داخلي",
        "accounts": [
            ("3376", "أرضيات وتفريغ ومصاريف موانئ", "Demurrage & Port Handling", E, COGS, "337"),
            ("3377", "فحص ورقابة على الواردات ومطابقة", "Import Inspection & Conformity", E, COGS, "337"),
            ("3378", "نولون نقل داخلي من الميناء للمخازن", "Inland Haulage", E, COGS, "337"),
        ],
    },

    # ── 5) التصدير ───────────────────────────────────────────────
    "export": {
        "name_ar": "باقة التصدير",
        "name_en": "Export",
        "note_ar": "تضيف عملاء العملات الأجنبية ومساندة الصادرات وتكاليف الشحن للصادر",
        "accounts": [
            ("145", "عملاء خارجيون — بالعملات الأجنبية", "Foreign Customers (FX)", A, CA, "14"),
            ("146", "صندوق تنمية الصادرات — مستحقات مساندة", "Export Development Fund Receivable", A, CA, "14"),
            ("424", "إيرادات نشاط التصدير (نسبة صفر)", "Export Revenue (Zero-rated)", R, REV, "42"),
            ("328", "شحن دولي وتخليص جمركي للصادر", "Export Freight & Clearance", E, COGS, "32"),
            ("329", "شهادات منشأ وفحص دولي ومعايرة", "Certificates of Origin & Inspection", E, COGS, "32"),
        ],
    },

    # ── 6) المطاعم والكافيهات ────────────────────────────────────
    "restaurants": {
        "name_ar": "باقة المطاعم والكافيهات",
        "name_en": "Restaurants & Cafés",
        "note_ar": "تضيف مخزون الأغذية والمشروبات ومنصات التوصيل وفاقد المطبخ",
        "accounts": [
            ("1251", "مخزون أغذية خام", "Food Stock", A, CA, "125"),
            ("1252", "مخزون مشروبات ومكونات البار", "Beverage Stock", A, CA, "125"),
            ("1253", "مخزون علب ومستهلكات التغليف", "Takeaway Packaging Stock", A, CA, "125"),
            ("147", "مستحقات منصات التوصيل", "Delivery Platforms Receivable", A, CA, "14"),
            ("166", "تسويات نقاط البيع والبطاقات المعلقة", "POS Settlements In Transit", A, CA, "16"),
            ("347", "تكلفة الأغذية والمشروبات المستهلكة", "Food & Beverage Cost", E, COGS, "34"),
            ("33612", "هالك وفاقد المطبخ", "Kitchen Waste & Spoilage", E, OPEX, "336"),
            ("33613", "عمولات منصات توصيل الطعام", "Delivery Platform Commissions", E, OPEX, "336"),
        ],
    },

    # ── 7) القطاع الطبي ──────────────────────────────────────────
    "medical": {
        "name_ar": "الباقة الطبية",
        "name_en": "Medical & Healthcare",
        "note_ar": "تضيف مخزون الصيدلية والمستلزمات وشركات التأمين وأتعاب الأطباء",
        "accounts": [
            ("1254", "مخزون أدوية ومحاليل الصيدلية", "Pharmacy Stock", A, CA, "125"),
            ("1255", "مخزون مستلزمات غرف العمليات والطوارئ", "Surgical & ER Supplies", A, CA, "125"),
            ("1256", "مخزون كيماويات وكواشف المعامل", "Lab Reagents Stock", A, CA, "125"),
            ("148", "شركات التأمين الطبي والجهات المتعاقدة", "Insurers & Contracted Payers", A, CA, "14"),
            ("345", "أتعاب ونسب الأطباء المعالجين والجراحين", "Physician Fees & Shares", E, COGS, "34"),
        ],
    },

    # ── 8) الإعلان والميديا ──────────────────────────────────────
    "ads": {   # الموقع يعرضها باسم ads

        "name_ar": "باقة الإعلان والميديا",
        "name_en": "Media & Advertising",
        "note_ar": "تضيف الحملات تحت التنفيذ وشراء المساحات وأتعاب صناع المحتوى",
        "accounts": [
            ("149", "حملات وإنتاجات إعلانية تحت التنفيذ", "Campaigns WIP", A, CA, "14"),
            ("3413", "شراء مساحات إعلانية رقمية", "Digital Media Buying", E, OPEX, "341"),
            ("3414", "إعلانات خارجية وطرق", "Out-of-Home Advertising", E, OPEX, "341"),
            ("3415", "إنتاج وتصوير — استوديوهات وممثلون", "Production & Shooting", E, OPEX, "341"),
            ("3416", "أتعاب صناع المحتوى والمستقلين", "Creators & Freelancers", E, OPEX, "341"),
        ],
    },

    # ── 9) المكاتب المهنية ───────────────────────────────────────
    "professional": {
        "name_ar": "باقة المكاتب المهنية والاستشارية",
        "name_en": "Professional Services",
        "note_ar": "تضيف الخدمات تحت التنفيذ وتفصيل الأتعاب",
        "accounts": [
            ("150", "خدمات واستشارات تحت التنفيذ — ساعات غير مفوترة", "Unbilled Services WIP", A, CA, "15"),
            ("425", "أتعاب مراجعة وتدقيق حسابات", "Audit & Assurance Fees", R, REV, "42"),
            ("426", "أتعاب استشارات ضريبية وقانونية", "Tax & Legal Advisory Fees", R, REV, "42"),
            ("427", "أتعاب تأسيس شركات وتعديل عقود", "Incorporation & Filing Fees", R, REV, "42"),
            ("346", "أجور استشاريين محملة على المشاريع", "Consultant Costs on Engagements", E, COGS, "34"),
        ],
    },

    # ── 10) التجزئة والسوبرماركت ─────────────────────────────────
    "retail": {
        "name_ar": "باقة التجزئة والسوبرماركت",
        "name_en": "Retail & Supermarket",
        "note_ar": "تضيف مخزون الفروع والعجز والزيادة وعمولات نقاط البيع",
        "accounts": [
            ("1257", "مخزون بضاعة الفروع", "Branch Stock", A, CA, "125"),
            ("167", "تسويات شبكات الدفع والبطاقات", "Card Network Settlements", A, CA, "16"),
            ("3471", "عجز وزيادة جرد الفروع", "Branch Stock Variance", E, OPEX, "347"),
            ("3472", "عمولات شبكات الدفع", "Payment Network Fees", E, OPEX, "347"),
        ],
    },

    # ── 11) النقل واللوجستيات ────────────────────────────────────
    "logistics": {
        "name_ar": "باقة النقل واللوجستيات",
        "name_en": "Transport & Logistics",
        "note_ar": "تضيف تكاليف الأسطول والوقود والرحلات ومستحقات الشحن",
        "accounts": [
            ("168", "مستحقات عملاء الشحن والتحصيل نيابة", "Freight & COD Receivable", A, CA, "16"),
            ("428", "إيرادات النقل والشحن", "Transport & Freight Revenue", R, REV, "42"),
            ("3481", "وقود وزيوت الأسطول", "Fleet Fuel & Oils", E, COGS, "348"),
            ("3482", "صيانة وإطارات وقطع غيار المركبات", "Fleet Maintenance & Tyres", E, COGS, "348"),
            ("3483", "رخص وتأمين وفحص المركبات", "Vehicle Licences & Insurance", E, COGS, "348"),
        ],
    },

    # ── 12) التعليم ──────────────────────────────────────────────
    "education": {
        "name_ar": "باقة التعليم والتدريب",
        "name_en": "Education & Training",
        "note_ar": "تضيف الرسوم الدراسية المحصلة مقدماً ومستحقات الطلاب وتكاليف البرامج",
        "accounts": [
            ("169", "مستحقات طلاب ومتدربين", "Students & Trainees Receivable", A, CA, "16"),
            ("247", "رسوم دراسية محصلة مقدماً", "Deferred Tuition Income", L, CL, "24"),
            ("429", "إيرادات رسوم دراسية وتدريب", "Tuition & Training Revenue", R, REV, "42"),
            ("3491", "أتعاب مدربين ومحاضرين", "Instructor Fees", E, COGS, "349"),
            ("3492", "مواد ومستلزمات تعليمية", "Educational Materials", E, COGS, "349"),
        ],
    },
}


def pack_accounts(pack_key: str, company_id: str) -> list:
    """The pack's accounts as chart documents, ready to insert."""
    import uuid
    from datetime import datetime, timezone

    pack = PACKS.get(pack_key)
    if not pack:
        return []
    now = datetime.now(timezone.utc).isoformat()
    out = []
    for code, name, name_en, acc_type, category, parent in pack["accounts"]:
        out.append({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "account_code": code,
            "account_name": name,
            "account_name_en": name_en,
            "account_type": acc_type.value if hasattr(acc_type, "value") else str(acc_type),
            "account_category": category.value if hasattr(category, "value") else str(category),
            "parent_code": parent,
            "is_active": True,
            "current_balance": 0.0,
            "industry_pack": pack_key,       # so it is clear where it came from
            "created_at": now,
        })
    return out


def list_packs() -> list:
    """What a company can subscribe to, with how many accounts each adds."""
    return [{"key": k, "name_ar": v["name_ar"], "name_en": v["name_en"],
             "note_ar": v["note_ar"], "accounts_count": len(v["accounts"])}
            for k, v in PACKS.items()]
