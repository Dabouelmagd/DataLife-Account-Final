"""
اختبار شامل للنظام على «شركة اختبار داتا لايف (QA)» — end-to-end QA sweep.

USAGE (on the server)
    docker exec datalife_backend python scripts/qa_e2e.py            # read-only sweep (GET only)
    docker exec datalife_backend python scripts/qa_e2e.py --write    # + sales / payroll / ESS / pack write flows

    options:  --rps 4        requests per second (default 4, max 8; the API allows 600/min per user)
              --only sweep,sales,payroll,ess,plan,packs,ledger      run some sections only
              --verbose      print every request

What it does
  * Acts ONLY as the «رئيس مجلس الإدارة» of the company named exactly
    «شركة اختبار داتا لايف (QA)» (scripts/seed_test_company.py). It refuses to
    run if that company (or its admin) is missing, or if the name is ambiguous.
  * Mints the admin's access token in-process (services.auth_service) and talks
    to the running app over HTTP (http://127.0.0.1:8000, QA_E2E_BASE to change)
    so middleware — permissions, plan tiers, rate limit — is exercised for real.
  * Never calls platform / super-admin routes, never sends e-mail / SMS /
    WhatsApp, never submits to ETA or a payment gateway, never deletes.
  * Everything --write creates is labelled «QA-E2E» (names, notes, references).
    Payroll runs cannot carry a label; the run's number is printed instead.

Sections
  sweep    every GET under /api/ (from the app's /openapi.json); path ids filled
           from list responses already fetched. 5xx and 404-on-an-existing-route
           are failures.
  sales    customer → item → sales invoice → approve → balanced, posted entry
           with AR (131), revenue (4xx) and output VAT (260).            [--write]
  payroll  «رواتب الشهر» for a past month with no run yet → calculate →
           approve → balanced, posted entry.                             [--write]
  ess      employee-portal preview token → profile / payslips / leave reads;
           a write and a non-portal read with that token are refused.    [--write]
  plan     the plan as services.plan_limits.company_plan sees it; if tier-limited,
           a higher-tier route must answer 403 with plan_limit: true.
  packs    industry-pack flows, only for packs whose accounts the QA company has
           (never subscribes it to a pack).                       [writes: --write]
  ledger   trial balance balanced; recent journal entries balanced.

Exit code: 0 when nothing FAILED, 1 otherwise, 2 when it refused to run.
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

COMPANY_NAME = "شركة اختبار داتا لايف (QA)"
ADMIN_ROLE = "رئيس مجلس الإدارة"
LABEL = "QA-E2E"
BASE = os.environ.get("QA_E2E_BASE", "http://127.0.0.1:8000")

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


class Refuse(Exception):
    """The script must not run (no QA company, ambiguous, …)."""


# ─────────────────────────────── HTTP layer ───────────────────────────────

class Resp:
    def __init__(self, status, text, headers=None):
        self.status = status
        self.text = text or ""
        self.headers = headers or {}
        try:
            self.data = json.loads(self.text) if self.text else None
        except Exception:
            self.data = None

    def snippet(self, n=200):
        return re.sub(r"\s+", " ", self.text)[:n]

    def detail(self):
        if isinstance(self.data, dict) and self.data.get("detail") is not None:
            return str(self.data["detail"])[:200]
        return self.snippet()


class _UrllibClient:
    """Fallback when httpx is not importable (same .request() shape)."""

    def __init__(self, base, timeout):
        self.base, self.timeout = base, timeout

    def request(self, method, url, params=None, json=None, headers=None):
        import urllib.request
        import urllib.error
        from urllib.parse import urlencode
        import json as _json
        full = self.base + url + (("?" + urlencode(params)) if params else "")
        body = None
        headers = dict(headers or {})
        if json is not None:
            body = _json.dumps(json).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(full, data=body, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return _Raw(r.status, r.read().decode("utf-8", "replace"), dict(r.headers))
        except urllib.error.HTTPError as e:
            return _Raw(e.code, e.read().decode("utf-8", "replace"), dict(e.headers or {}))


class _Raw:
    def __init__(self, status_code, text, headers):
        self.status_code, self.text, self.headers = status_code, text, headers


class Http:
    """Throttled client. `client` is anything with .request(method, url,
    params=, json=, headers=) returning .status_code/.text/.headers — an
    httpx.Client(base_url=…), urllib fallback, or Starlette's TestClient."""

    def __init__(self, token, client=None, base=BASE, rps=4.0, timeout=90, verbose=False):
        self.token = token
        self.verbose = verbose
        self.min_interval = 1.0 / max(0.5, min(float(rps), 8.0)) if rps else 0.0
        self._last = 0.0
        self.count = 0
        if client is None:
            try:
                import httpx
                client = httpx.Client(base_url=base.rstrip("/"), timeout=timeout)
            except Exception:
                client = _UrllibClient(base.rstrip("/"), timeout)
        self.client = client

    def call(self, method, path, params=None, body=None, token="default", retries=3):
        headers = {}
        tok = self.token if token == "default" else token
        if tok:
            headers["Authorization"] = f"Bearer {tok}"
        resp = None
        for attempt in range(retries + 1):
            if self.min_interval:
                wait = self._last + self.min_interval - time.time()
                if wait > 0:
                    time.sleep(wait)
            self._last = time.time()
            self.count += 1
            try:
                kw = {"params": params, "headers": headers}
                if body is not None:
                    kw["json"] = body
                r = self.client.request(method, path, **kw)
                resp = Resp(r.status_code, r.text, dict(r.headers or {}))
            except Exception as e:
                resp = Resp(0, f"{type(e).__name__}: {e}")
            if self.verbose:
                print(f"    {method:6s} {resp.status}  {path}")
            if resp.status != 429 or attempt == retries:
                break
            try:
                pause = min(65, int(resp.headers.get("retry-after") or resp.headers.get("Retry-After") or 20))
            except ValueError:
                pause = 20
            print(f"    429 on {path} — waiting {pause}s")
            time.sleep(pause)
        return resp

    def get(self, path, params=None, token="default"):
        return self.call("GET", path, params=params, token=token)

    def post(self, path, body=None, token="default"):
        return self.call("POST", path, body=body if body is not None else {}, token=token)


# ─────────────────────────────── report ───────────────────────────────

class Report:
    def __init__(self):
        self.rows = []

    def add(self, section, status, detail):
        self.rows.append((section, status, detail))
        mark = {"PASS": "✓", "FAIL": "✗", "SKIP": "·", "WARN": "!"}.get(status, "?")
        print(f"  {mark} [{status}] {section}: {detail}")

    def failed(self):
        return any(s == "FAIL" for _, s, _ in self.rows)

    def print_summary(self, ctx, http, started):
        print("\n" + "=" * 100)
        print("ملخص الاختبار  /  QA E2E SUMMARY")
        print(f"company: {ctx.get('company_name')}  ({ctx.get('company_id')})   as: {ctx.get('email')}")
        print(f"mode: {'WRITE' if ctx.get('write') else 'READ-ONLY'}   requests: {http.count}   "
              f"time: {time.time() - started:.0f}s")
        print("=" * 100)
        w = max([len(s) for s, _, _ in self.rows] + [10])
        print(f"{'section'.ljust(w)}  status  detail")
        print(f"{'-' * w}  ------  {'-' * 60}")
        for s, st, d in self.rows:
            print(f"{s.ljust(w)}  {st.ljust(6)}  {d}")
        counts = {k: sum(1 for _, s, _ in self.rows if s == k) for k in ("PASS", "FAIL", "WARN", "SKIP")}
        print("-" * 100)
        print(f"PASS {counts['PASS']}   FAIL {counts['FAIL']}   WARN {counts['WARN']}   SKIP {counts['SKIP']}")
        print("النتيجة: " + ("فيه أخطاء ✗ — راجعي سطور FAIL" if counts["FAIL"] else "كله تمام ✓")
              + "   /   RESULT: " + ("FAILURES" if counts["FAIL"] else "ALL PASSED"))


# ─────────────────────────────── context ───────────────────────────────

async def load_context(db):
    """The QA company, its admin, and the plan — straight from the DB."""
    companies = await db.companies.find({"name": COMPANY_NAME},
                                        {"_id": 0, "id": 1, "name": 1, "is_test": 1}).to_list(5)
    if not companies:
        raise Refuse(f"مفيش شركة اسمها «{COMPANY_NAME}» — اعمليها بـ scripts/seed_test_company.py "
                     f"(no QA company found — refusing to run)")
    if len(companies) > 1:
        raise Refuse(f"{len(companies)} companies are named «{COMPANY_NAME}» — ambiguous, refusing to run")
    company = companies[0]
    users = await db.users.find({"company_id": company["id"], "role": ADMIN_ROLE},
                                {"_id": 0, "id": 1, "email": 1, "role": 1, "company_id": 1,
                                 "is_active": 1, "is_platform_admin": 1}).to_list(10)
    users = [u for u in users if u.get("is_active", True) is not False and not u.get("is_platform_admin")]
    if not users:
        raise Refuse(f"«{COMPANY_NAME}» has no active «{ADMIN_ROLE}» user — refusing to run")
    user = users[0]
    if user.get("company_id") != company["id"]:
        raise Refuse("admin user is not in the QA company — refusing to run")
    from services.plan_limits import company_plan
    plan = await company_plan(db, company["id"])
    return {"company_id": company["id"], "company_name": company["name"], "is_test": company.get("is_test"),
            "user_id": user["id"], "email": user.get("email"), "role": user["role"], "plan": plan}


def mint_token(ctx):
    from services.auth_service import create_access_token
    return create_access_token(data={"user_id": ctx["user_id"], "email": ctx.get("email") or "",
                                     "company_id": ctx["company_id"], "role": ctx["role"]},
                               expires_delta=timedelta(hours=3))


# ─────────────────────────────── helpers ───────────────────────────────

def today():
    return date.today().isoformat()


def prev_month(d=None, back=1):
    d = d or date.today()
    y, m = d.year, d.month - back
    while m <= 0:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


def records_of(data):
    """The first list of objects in a list response."""
    cand = None
    if isinstance(data, list):
        cand = data
    elif isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                cand = v
                break
        if cand is None:
            for v in data.values():
                if isinstance(v, dict):
                    for vv in v.values():
                        if isinstance(vv, list) and vv and isinstance(vv[0], dict):
                            cand = vv
                            break
                if cand is not None:
                    break
    return [x for x in (cand or []) if isinstance(x, dict)][:5]


def entry_check(entry):
    """(ok, detail, {code: net}) for a journal entry document."""
    lines = (entry or {}).get("lines") or []
    d = round(sum(float(l.get("debit") or 0) for l in lines), 2)
    c = round(sum(float(l.get("credit") or 0) for l in lines), 2)
    net = {}
    for l in lines:
        code = str(l.get("account_code") or "")
        net[code] = round(net.get(code, 0) + float(l.get("debit") or 0) - float(l.get("credit") or 0), 2)
    status = str((entry or {}).get("status") or "").lower()
    ok = bool(lines) and abs(d - c) < 0.01 and d > 0 and status == "posted"
    num = (entry or {}).get("entry_number") or (entry or {}).get("id")
    return ok, f"entry {num}: Dr {d:,.2f} / Cr {c:,.2f}, status {status or '?'}", net


def fetch_entry(http, entry_id):
    r = http.get(f"/api/accounting/journal-entries/{quote(str(entry_id))}")
    return r, (r.data if r.status == 200 and isinstance(r.data, dict) else None)


# ─────────────────────────────── 1. GET sweep ───────────────────────────────

SKIP_PREFIXES = (
    "/api/admin", "/api/super-admin", "/api/platform", "/api/subscriptions/admin", "/api/trials",
    "/api/coupons/referral/admin", "/api/monitor", "/api/db-performance", "/api/health",
    "/api/uploads", "/api/ess/admin", "/api/eta", "/api/eta-signing", "/api/tax/eta-status",
    "/api/gov", "/api/whatsapp", "/api/newsletter", "/api/payments", "/api/webhook", "/api/webhooks",
    "/api/pos/eta-", "/api/customer-portal", "/api/data-export/download", "/api/chatbot",
    # platform-operator screens (coupons, contact inbox, release notes, assistants)
    "/api/coupons", "/api/contact", "/api/updates", "/api/auth/assistants", "/api/auth/check-super-admin",
    "/api/reports/history",
)
SKIP_WORDS = ("export", "download", "pdf", "excel", "csv", "xlsx", "bank-file", "print", "stream",
              "/ws", "/sse", "logout", "send", "email", "notify", "whatsapp", "sms", "etax", "/admin/",
              "backup", "test-routes")
# param name → list routes whose items carry that id
NAME_POOLS = {
    "employee_id": ["/api/hr/employees", "/api/employees"],
    "run_id": ["/api/payroll/runs"],
    "invoice_id": ["/api/invoice/"],
    "customer_id": ["/api/sales/customers"],
    "party_id": ["/api/invoice/parties"],
    "project_id": ["/api/tasks/projects", "/api/projects"],
    "product_id": ["/api/inventory/products", "/api/invoice/products"],
    "asset_id": ["/api/fixed-assets/"],
    "entry_id": ["/api/accounting/journal-entries"],
    "warehouse_id": ["/api/inventory/warehouses"],
    "invoice_number": ["/api/invoices/"],
}
QUERY_DEFAULTS = {
    "start_date": lambda s: f"{date.today().year}-01-01", "from_date": lambda s: f"{date.today().year}-01-01",
    "date_from": lambda s: f"{date.today().year}-01-01", "end_date": lambda s: today(),
    "to_date": lambda s: today(), "date_to": lambda s: today(), "date": lambda s: today(),
    "as_of_date": lambda s: today(), "as_of": lambda s: today(),
    "year": lambda s: date.today().year if s.get("type") == "integer" else str(date.today().year),
    "month": lambda s: date.today().month if s.get("type") == "integer" else prev_month(),
    "fiscal_year": lambda s: date.today().year if s.get("type") == "integer" else str(date.today().year),
    "period": lambda s: prev_month(), "quarter": lambda s: 1 if s.get("type") == "integer" else "1",
}


def skip_reason(path):
    if not path.startswith("/api/"):
        return "not /api"
    for p in SKIP_PREFIXES:
        if path == p or path.startswith(p + "/") or (p.endswith("-") and path.startswith(p)):
            return f"platform/external/side-effect ({p})"
    low = path.lower()
    for w in SKIP_WORDS:
        if w in low:
            return f"heavy or sends ({w.strip('/')})"
    return None


def discover_routes(http):
    """[(path, [path params], [(required query name, schema)])] for every GET."""
    r = http.call("GET", "/openapi.json", token=None)
    out = []
    if r.status == 200 and isinstance(r.data, dict) and r.data.get("paths"):
        for path, ops in r.data["paths"].items():
            op = ops.get("get")
            if not op:
                continue
            params = op.get("parameters") or []
            pp = re.findall(r"{([^}:]+)", path)
            rq = [(p["name"], p.get("schema") or {}) for p in params
                  if p.get("in") == "query" and p.get("required")]
            out.append((path, pp, rq))
        return out, "openapi.json"
    # fallback: the app object itself
    import server
    for route in server.app.routes:
        if "GET" not in (getattr(route, "methods", None) or set()):
            continue
        rq = []
        dep = getattr(route, "dependant", None)
        for f in (getattr(dep, "query_params", None) or []):
            if getattr(f, "required", False):
                rq.append((f.alias or f.name, {}))
        out.append((route.path, re.findall(r"{([^}:]+)", route.path), rq))
    return out, "server.app (openapi.json unavailable: HTTP %s)" % r.status


def fill_path(path, names, pools):
    if len(names) != 1:
        return None, f"needs {len(names)} ids"
    name = names[0]
    prefix = path.split("/{", 1)[0]
    for src in [prefix, prefix + "/"] + NAME_POOLS.get(name, []):
        for rec in pools.get(src, []):
            v = rec.get("id") if (name == "id" or name.endswith("_id")) else rec.get(name)
            if v in (None, ""):
                v = rec.get(name)
            if isinstance(v, (str, int)) and str(v):
                return path.replace("{" + name + "}", quote(str(v), safe=""), 1), src
    return None, "no id available"


def section_sweep(http, rep, ctx):
    print("\n== 1. GET sweep / فحص كل صفحات القراءة")
    routes, source = discover_routes(http)
    print(f"  routes from {source}: {len(routes)} GET")
    skipped, todo_plain, todo_param = {}, [], []
    for path, pp, rq in sorted(routes):
        why = skip_reason(path)
        if why:
            skipped.setdefault(why, []).append(path)
        elif pp:
            todo_param.append((path, pp, rq))
        else:
            todo_plain.append((path, pp, rq))

    pools, results = {}, []          # results: (kind, path, status, snippet, filled_from)

    def params_for(rq):
        q = {}
        for name, schema in rq:
            if name in QUERY_DEFAULTS:
                q[name] = QUERY_DEFAULTS[name](schema)
        return q or None

    for path, _, rq in todo_plain:
        r = http.get(path, params=params_for(rq))
        results.append(("plain", path, r, None))
        if r.status == 200:
            recs = records_of(r.data)
            if recs:
                pools[path] = recs
    unfilled = []
    for path, pp, rq in todo_param:
        url, src = fill_path(path, pp, pools)
        if not url:
            unfilled.append((path, src))
            continue
        r = http.get(url, params=params_for(rq))
        results.append(("param", url, r, f"{path} (id from {src})"))

    ok = [x for x in results if 200 <= x[2].status < 400]
    crashed = [x for x in results if x[2].status >= 500 or x[2].status == 0]
    # the admin has no employee file of their own: «my …» portal reads answer 404 by design
    own = lambda u: u.startswith("/api/ess/") or "/my-" in u or u.endswith("/me")
    nf_plain = [x for x in results if x[2].status == 404 and x[0] == "plain" and not own(x[1])]
    nf_own = [x for x in results if x[2].status == 404 and x[0] == "plain" and own(x[1])]
    nf_param = [x for x in results if x[2].status == 404 and x[0] == "param"]
    plan403 = [x for x in results if x[2].status == 403 and isinstance(x[2].data, dict) and x[2].data.get("plan_limit")]
    auth = [x for x in results if x[2].status in (401, 403) and x not in plan403 and not own(x[1])]
    nf_own += [x for x in results if x[2].status in (401, 403) and own(x[1])]
    params = [x for x in results if x[2].status in (400, 405, 409, 422)]
    limited = [x for x in results if x[2].status == 429]

    ctx["sweep_routes"] = [p for p, pp, _ in todo_plain]
    print(f"  tested {len(results)} (no-id {len(todo_plain)}, with-id {len(results) - len(todo_plain)}), "
          f"skipped {sum(len(v) for v in skipped.values())}, ids unavailable {len(unfilled)}")
    print(f"  ✓ ok {len(ok)}   ✗ 5xx/error {len(crashed)}   ✗ 404 {len(nf_plain)}   ! 404 with filled id {len(nf_param)}"
          f"   · auth {len(auth)}   · own-portal {len(nf_own)}   · plan-limit {len(plan403)}   · needs params {len(params)}   · 429 {len(limited)}")
    for why, paths in sorted(skipped.items()):
        print(f"  skipped — {why}: {len(paths)}")

    def show(title, rows):
        if rows:
            print(f"\n  {title}:")
            for kind, url, r, src in rows:
                print(f"    {r.status}  {url}" + (f"   [{src}]" if src else ""))
                print(f"         {r.snippet()}")

    show("CRASHED (5xx / no answer)", crashed)
    show("404 ON AN EXISTING ROUTE", nf_plain)
    show("404 WITH AN ID TAKEN FROM A LIST (check the id source)", nf_param)
    show("«MY …» PORTAL ROUTES REFUSED (the admin has no employee file — expected; covered by the ess section)", nf_own)
    show("AUTH / PERMISSION (401/403) as the QA admin", auth)
    show("NEEDS PARAMETERS (400/422 — informational)", params[:40])

    rep.add("GET sweep: crashes (5xx)", "FAIL" if crashed else "PASS",
            f"{len(crashed)} of {len(results)} crashed" + (": " + ", ".join(f"{x[2].status} {x[1]}" for x in crashed[:6])
                                                           + (" …" if len(crashed) > 6 else "") if crashed else ""))
    rep.add("GET sweep: 404 on existing routes", "FAIL" if nf_plain else "PASS",
            f"{len(nf_plain)}" + (": " + ", ".join(x[1] for x in nf_plain[:6]) if nf_plain else ""))
    if nf_param:
        rep.add("GET sweep: 404 with filled id", "WARN",
                f"{len(nf_param)} (id source may not match the route): " + ", ".join(x[1] for x in nf_param[:4]))
    if limited:
        rep.add("GET sweep: rate-limited", "WARN", f"{len(limited)} routes still 429 after retries (untested)")
    if auth:
        rep.add("GET sweep: refused to the top admin", "WARN",
                f"{len(auth)} answered 401/403 to «{ADMIN_ROLE}»: " + ", ".join(x[1] for x in auth[:5]))
    rep.add("GET sweep: coverage", "PASS", f"{len(ok)} ok, {len(params)} need parameters, "
                                           f"{len(unfilled)} with-id routes had no id to try")


# ─────────────────────────────── 2. sales → journal ───────────────────────────────

def section_sales(http, rep, ctx, stamp):
    print("\n== 2. Sales invoice → journal entry / فاتورة بيع ← قيد")
    sec = "sales: customer → invoice → entry"
    # customer — CustomersPage.saveCustomer
    body = {"name": f"{LABEL} عميل اختبار {stamp}", "phone": "", "email": "", "tax_number": "", "address": "",
            "city": "", "credit_limit": 0, "payment_terms": "", "notes": f"{LABEL} — created by scripts/qa_e2e.py"}
    r = http.post("/api/sales/customers", body)
    cust = (r.data or {}).get("customer") if isinstance(r.data, dict) else None
    if r.status != 200 or not cust or not cust.get("id"):
        rep.add(sec, "FAIL", f"create customer POST /api/sales/customers → {r.status} {r.detail()}")
        return
    if cust.get("company_id") not in (None, ctx["company_id"]):
        rep.add(sec, "FAIL", "customer was created in ANOTHER company — stopping")
        return
    print(f"  customer {cust.get('code')} {cust['id']}")
    # the invoice screen picks customers from /api/invoice/parties
    r = http.get("/api/invoice/parties", params={"party_type": "customer"})
    listed = r.status == 200 and any(p.get("id") == cust["id"] for p in (r.data or {}).get("parties", []))
    rep.add("sales: new customer on the invoice screen", "PASS" if listed else "FAIL",
            "listed by GET /api/invoice/parties?party_type=customer" if listed else f"not listed ({r.status})")

    # item — ProductsPage.handleSubmit
    pbody = {"code": f"{LABEL}-{stamp}", "name": f"{LABEL} صنف اختبار {stamp}", "name_en": f"{LABEL} item",
             "description": f"{LABEL} — created by scripts/qa_e2e.py", "unit": "EA", "unit_price": 100,
             "cost_price": 0, "tax_type": "vat", "tax_rate": 14, "eta_code": "", "is_service": True}
    r = http.post("/api/invoice/products", pbody)
    prod = (r.data or {}).get("product") if isinstance(r.data, dict) else None
    if r.status != 200 or not prod:
        rep.add("sales: create item", "FAIL", f"POST /api/invoice/products → {r.status} {r.detail()}")
        prod = {"name": pbody["name"], "unit_price": 100.0, "tax_rate": 14.0, "unit": "EA"}
    else:
        rep.add("sales: create item", "PASS", f"{prod.get('code')} at {prod.get('unit_price')} + VAT {prod.get('tax_rate')}%")

    # invoice — InvoicesPage.handleCreateInvoice (its lines carry no product_id)
    price = float(prod.get("unit_price") or 100)
    ibody = {"document_type": "sales_invoice", "document_date": today(), "due_date": "", "party_id": cust["id"],
             "currency": "EGP", "exchange_rate": None, "payment_terms": "cash",
             "lines": [{"description": prod["name"], "quantity": 1, "unit_price": price,
                        "tax_rate": float(prod.get("tax_rate") or 14), "discount_percent": 0,
                        "tax_type": "vat", "vat_category": None, "other_taxes": []}],
             "adjustments": [], "notes": f"{LABEL} — test invoice, scripts/qa_e2e.py", "reference": f"{LABEL}-{stamp}"}
    r = http.post("/api/invoice/", ibody)
    inv = (r.data or {}).get("invoice") if isinstance(r.data, dict) else None
    if r.status != 200 or not inv or not inv.get("id"):
        rep.add(sec, "FAIL", f"create invoice POST /api/invoice/ → {r.status} {r.detail()}")
        return
    print(f"  invoice {inv.get('document_number')} total {inv.get('grand_total')} status {inv.get('status')}")
    r = http.post(f"/api/invoice/{inv['id']}/approve")
    appr = (r.data or {}).get("invoice") if isinstance(r.data, dict) else None
    if r.status != 200 or not appr:
        rep.add(sec, "FAIL", f"approve POST /api/invoice/{{id}}/approve → {r.status} {r.detail()}")
        return
    je_id = appr.get("journal_entry_id")
    if not je_id:
        rep.add(sec, "FAIL", f"invoice {inv.get('document_number')} approved but has no journal_entry_id")
        return
    r, entry = fetch_entry(http, je_id)
    if not entry:
        rep.add(sec, "FAIL", f"GET journal entry {je_id} → {r.status} {r.detail()}")
        return
    ok, detail, net = entry_check(entry)
    total = round(float(appr.get("grand_total") or 0), 2)
    tax = round(float(appr.get("total_tax") or 0), 2)
    net_rev = round(float(appr.get("total_after_discount") or 0), 2)
    ar_ok = abs(net.get("131", 0) - total) < 0.01
    vat_ok = abs(-net.get("260", 0) - tax) < 0.01
    rev = round(-sum(v for k, v in net.items() if k.startswith("4")), 2)
    rev_ok = abs(rev - net_rev) < 0.01
    # the line asked for 14% on a domestic customer: the invoice itself must charge it
    line = (appr.get("lines") or [{}])[0]
    want_tax = round(price * float(prod.get("tax_rate") or 14) / 100, 2)
    rate_ok = abs(tax - want_tax) < 0.01
    problems = [m for good, m in ((ok, "not balanced/posted"), (ar_ok, f"AR 131 {net.get('131', 0)} ≠ {total}"),
                                  (vat_ok, f"VAT 260 {-net.get('260', 0)} ≠ {tax}"),
                                  (rev_ok, f"revenue 4xx {rev} ≠ {net_rev}"),
                                  (rate_ok, f"invoice VAT {tax} ≠ {want_tax} expected on a 14% line — line "
                                            f"vat_category «{line.get('vat_category')}», customer country "
                                            f"«{cust.get('country')}» (a domestic customer was treated as abroad?)"))
                if not good]
    rep.add(sec, "FAIL" if problems else "PASS",
            f"invoice {appr.get('document_number')} {total:,.2f}; {detail}; AR {net.get('131', 0)}, revenue {rev}, "
            f"VAT {-net.get('260', 0)}" + ("; " + "; ".join(problems) if problems else ""))
    ctx["created"].append(f"customer {cust.get('code')}, item {pbody['code']}, invoice {appr.get('document_number')}")


# ─────────────────────────────── 3. payroll ───────────────────────────────

def list_employees(http):
    r = http.get("/api/hr/employees", params={"limit": 100})
    data = r.data
    emps = data if isinstance(data, list) else ((data or {}).get("data") or (data or {}).get("employees") or [])
    return r, [e for e in emps if isinstance(e, dict)]


def section_payroll(http, rep, ctx):
    print("\n== 3. Payroll run / رواتب الشهر")
    sec = "payroll: run → calculate → approve → entry"
    r, emps = list_employees(http)
    if r.status != 200:
        rep.add(sec, "FAIL", f"GET /api/hr/employees → {r.status} {r.detail()}")
        return
    active = [e for e in emps if e.get("is_active", True) is not False]
    if not active:
        rep.add(sec, "SKIP", "QA company has no active employees (import them with seed_test_company.py --import)")
        return
    used, page = set(), 1
    while True:
        r = http.get("/api/payroll/runs", params={"limit": 200, "page": page})
        if r.status != 200:
            rep.add(sec, "FAIL", f"GET /api/payroll/runs → {r.status} {r.detail()}")
            return
        used |= {x.get("month") for x in (r.data or {}).get("payroll_runs", [])}
        if page >= int((r.data or {}).get("pages") or 1):
            break
        page += 1
    month = next((m for m in (prev_month(back=i) for i in range(1, 37)) if m not in used), None)
    if not month:
        rep.add(sec, "SKIP", "every month of the last 3 years already has a payroll run")
        return
    r = http.post("/api/payroll/runs", {"month": month})
    run = (r.data or {}).get("payroll_run") if isinstance(r.data, dict) else None
    if r.status != 200 or not run:
        rep.add(sec, "FAIL", f"create run for {month} → {r.status} {r.detail()}")
        return
    rid, num = run["id"], run.get("payroll_number")
    print(f"  run {num} for {month} ({len(active)} active employees)")
    ctx["created"].append(f"payroll run {num} ({month})")
    r = http.post(f"/api/payroll/runs/{rid}/calculate")
    if r.status != 200:
        rep.add(sec, "FAIL", f"calculate run {num} → {r.status} {r.detail()}  (run left as draft)")
        return
    if isinstance(r.data, dict) and r.data.get("background"):
        deadline = time.time() + 600
        while time.time() < deadline:
            time.sleep(3)
            j = http.get(f"/api/payroll/runs/{rid}/job")
            st = (j.data or {}).get("status") if isinstance(j.data, dict) else None
            if st and st != "running":
                if st != "done":
                    rep.add(sec, "FAIL", f"background calculation {st}: {(j.data or {}).get('error')}")
                    return
                break
        else:
            rep.add(sec, "FAIL", f"background calculation of {num} still running after 10 min")
            return
    r = http.get(f"/api/payroll/runs/{rid}")
    run = r.data if r.status == 200 and isinstance(r.data, dict) else {}
    n_emp = len(run.get("employees") or [])
    if run.get("status") != "calculated" or not n_emp:
        rep.add(sec, "FAIL", f"after calculate: status {run.get('status')}, {n_emp} employees in the run")
        return
    r = http.post(f"/api/payroll/runs/{rid}/approve")
    if r.status != 200:
        rep.add(sec, "FAIL", f"approve run {num} → {r.status} {r.detail()}  (run left as calculated)")
        return
    r = http.get(f"/api/payroll/runs/{rid}")
    run = r.data if r.status == 200 and isinstance(r.data, dict) else {}
    ctx["payroll_run"] = run
    je = run.get("journal_entry_id")
    if run.get("status") != "approved" or not je:
        rep.add(sec, "FAIL", f"after approve: status {run.get('status')}, journal_entry_id {je}")
        return
    r, entry = fetch_entry(http, je)
    if not entry:
        rep.add(sec, "FAIL", f"GET payroll journal entry → {r.status} {r.detail()}")
        return
    ok, detail, _ = entry_check(entry)
    rep.add(sec, "PASS" if ok else "FAIL", f"run {num} ({month}, {n_emp} employees, net "
                                          f"{float(run.get('total_net') or run.get('total_net_salary') or 0):,.2f}); {detail}")


# ─────────────────────────────── 4. employee portal preview ───────────────────────────────

def section_ess(http, rep, ctx):
    print("\n== 4. Employee portal preview / معاينة بوابة الموظف")
    sec = "ess: preview token"
    r, emps = list_employees(http)
    active = [e for e in emps if e.get("is_active", True) is not False and e.get("id")]
    if not active:
        rep.add(sec, "SKIP", "QA company has no active employees")
        return
    run = ctx.get("payroll_run") or {}
    in_run = {e.get("employee_id") for e in run.get("employees") or []}
    emp = next((e for e in active if e["id"] in in_run), active[0])
    r = http.post("/api/ess/preview-token", {"employee_id": emp["id"]})
    tok = (r.data or {}).get("token") if isinstance(r.data, dict) else None
    if r.status != 200 or not tok:
        rep.add(sec, "FAIL", f"POST /api/ess/preview-token → {r.status} {r.detail()}")
        return
    rep.add(sec, "PASS", f"token for {emp.get('name') or emp['id']} (expires in {(r.data or {}).get('expires_in')}s)")

    r = http.get("/api/ess/profile", token=tok)
    pe = ((r.data or {}).get("employee") or {}) if isinstance(r.data, dict) else {}
    rep.add("ess: profile read", "PASS" if r.status == 200 and pe.get("id") == emp["id"] else "FAIL",
            f"GET /api/ess/profile → {r.status}" + ("" if pe.get("id") == emp["id"] else f" (employee {pe.get('id')} ≠ {emp['id']}) {r.detail()}"))
    bad = []
    for path in ("/api/ess/payslip/list", "/api/ess/leave/balances", "/api/ess/requests/my-requests",
                 "/api/ess/my-appraisals"):
        x = http.get(path, token=tok)
        if x.status != 200:
            bad.append(f"{path} → {x.status} {x.detail()}")
    rep.add("ess: payslips / leave / requests reads", "FAIL" if bad else "PASS", "; ".join(bad) or "all 200")
    if emp["id"] in in_run and run.get("id"):
        x = http.get(f"/api/ess/payslip/{run['id']}", params={"format": "json"}, token=tok)
        mine = next((e for e in run.get("employees") or [] if e.get("employee_id") == emp["id"]), {})
        want = round(float(mine.get("net_salary") or 0), 2)
        got = round(float((x.data or {}).get("net_salary") or 0), 2) if isinstance(x.data, dict) else None
        if x.status == 403:
            rep.add("ess: payslip of the new run", "SKIP",
                    f"payslip refused to the portal (salary hidden? ess_show_salary): {x.detail()}")
        else:
            rep.add("ess: payslip of the new run", "PASS" if x.status == 200 and got == want else "FAIL",
                    f"GET /api/ess/payslip/{{run}}?format=json → {x.status}, net {got} vs run {want}")

    # writes and non-portal reads with the preview token must be refused
    lb = {"leave_type": "annual", "start_date": today(), "end_date": today(),
          "reason": f"{LABEL} preview write — must be refused"}
    x = http.post("/api/ess/requests/leave", lb, token=tok)
    refused = x.status == 403 and isinstance(x.data, dict) and x.data.get("preview") is True
    rep.add("ess: write with preview token refused", "PASS" if refused else "FAIL",
            f"POST /api/ess/requests/leave → {x.status} {x.detail()}")
    x = http.get("/api/payroll/runs", token=tok)
    rep.add("ess: non-portal read with preview token refused", "PASS" if x.status == 403 else "FAIL",
            f"GET /api/payroll/runs → {x.status} {x.detail()}")


# ─────────────────────────────── 5. plan tiers ───────────────────────────────

def section_plan(http, rep, ctx):
    print("\n== 5. Plan tiers / حدود الباقة")
    from services.plan_limits import path_tier, PACK_UNLOCKS, _match, TIER_NAME
    info = ctx["plan"]
    mode = os.environ.get("PLAN_ENFORCEMENT", "log")
    desc = (f"plan «{info.get('plan') or '—'}», rank {info.get('rank')}, grandfathered {info.get('grandfathered')}, "
            f"packs {info.get('packs') or []}, PLAN_ENFORCEMENT={mode}")
    print("  " + desc)
    sec = "plan: higher-tier route refused"
    if info.get("rank") is None:
        rep.add(sec, "SKIP", f"not tier-limited — no active Starter/Professional/Enterprise subscription "
                             f"(trial or none → full access). {desc}")
        return
    if info.get("grandfathered"):
        rep.add(sec, "SKIP", f"not tier-limited — subscription started before the tier date (grandfathered). {desc}")
        return
    if mode != "enforce":
        rep.add(sec, "SKIP", f"tiers are only logged, not enforced (PLAN_ENFORCEMENT={mode}). {desc}")
        return
    if info["rank"] >= 3:
        rep.add(sec, "SKIP", f"top tier ({TIER_NAME.get(3)}) — nothing above it. {desc}")
        return
    unlocked = lambda p: any(_match(p, u) for k in info.get("packs") or [] for u in PACK_UNLOCKS.get(k, ()))
    cands = [p for p in ctx.get("sweep_routes") or [] if (path_tier(p) or (0,))[0] > info["rank"] and not unlocked(p)]
    if not cands:
        cands = [p for p in ("/api/lc", "/api/consolidation", "/api/fraud/duplicate-payments", "/api/fixed-assets/")
                 if (path_tier(p) or (0,))[0] > info["rank"] and not unlocked(p)]
    if not cands:
        rep.add(sec, "SKIP", f"no higher-tier GET route outside the company's packs. {desc}")
        return
    path = cands[0]
    r = http.get(path)
    ok = r.status == 403 and isinstance(r.data, dict) and r.data.get("plan_limit") is True
    rep.add(sec, "PASS" if ok else "FAIL", f"GET {path} (needs {TIER_NAME[path_tier(path)[0]]}) → {r.status} {r.detail()}")
    # and something inside the plan still works
    r = http.get("/api/accounting/accounts")
    rep.add("plan: in-plan route allowed", "PASS" if r.status == 200 else "FAIL",
            f"GET /api/accounting/accounts → {r.status}")


# ─────────────────────────────── 6. industry packs ───────────────────────────────

PACK_FLOWS = [
    # (name, account codes (any), pack names, check function name)
    ("packs: delivery platforms (147)", ("147",), "باقة المطاعم", "delivery"),
    ("packs: unbilled work (143/150/149)", ("143", "150", "149"), "المقاولات / المكاتب المهنية / الإعلان", "unbilled"),
    ("packs: manufacturing scrap (140)", ("140",), "باقة التصنيع", "scrap"),
    ("packs: finished units / maintenance deposits (129/246)", ("129", "246"), "باقة التطوير العقاري", "real_estate"),
    ("packs: physician fees (345)", ("345",), "الباقة الطبية", "medical"),
]


def section_packs(http, rep, ctx, write, stamp):
    print("\n== 6. Industry packs / الباقات القطاعية")
    r = http.get("/api/accounting/accounts")
    if r.status != 200:
        rep.add("packs", "FAIL", f"GET /api/accounting/accounts → {r.status} {r.detail()}")
        return
    codes = {str(a.get("account_code")) for a in (r.data or {}).get("accounts", [])}
    for name, need, packs, kind in PACK_FLOWS:
        have = [c for c in need if c in codes]
        if not have:
            rep.add(name, "SKIP", f"QA company has none of {', '.join(need)} ({packs} not added) — not subscribing it")
            continue
        try:
            globals()["_pack_" + kind](http, rep, ctx, name, have, write, stamp)
        except Exception as e:                       # one pack's surprise must not stop the rest
            rep.add(name, "FAIL", f"script error: {type(e).__name__}: {e}")


def _expect_available(rep, name, r, path, key="available"):
    ok = r.status == 200 and isinstance(r.data, dict) and r.data.get(key) is True
    rep.add(name, "PASS" if ok else "FAIL", f"GET {path} → {r.status}, {key}={(r.data or {}).get(key) if isinstance(r.data, dict) else '?'}"
            + ("" if ok else f" {r.detail()}"))


def _pack_delivery(http, rep, ctx, name, have, write, stamp):
    _expect_available(rep, name, http.get("/api/pos/delivery-platforms"), "/api/pos/delivery-platforms")


def _pack_scrap(http, rep, ctx, name, have, write, stamp):
    _expect_available(rep, name, http.get("/api/manufacturing/scrap"), "/api/manufacturing/scrap")


def _pack_medical(http, rep, ctx, name, have, write, stamp):
    _expect_available(rep, name, http.get("/api/enterprise/medical-settings"), "/api/enterprise/medical-settings",
                      key="expense_available")


def _pack_real_estate(http, rep, ctx, name, have, write, stamp):
    r = http.get("/api/real-estate/projects")
    if r.status != 200:
        rep.add(name, "FAIL", f"GET /api/real-estate/projects → {r.status} {r.detail()}")
        return
    projs = records_of(r.data)
    if not projs:
        rep.add(name, "PASS", "GET /api/real-estate/projects → 200 (no projects, transfer preview not tried; "
                              "write flow needs units — not exercised)")
        return
    p = f"/api/real-estate/projects/{quote(str(projs[0].get('id')))}/transfer-finished"
    x = http.get(p)
    rep.add(name, "PASS" if x.status == 200 else "FAIL", f"GET {p} → {x.status}" + ("" if x.status == 200 else f" {x.detail()}")
            + " (read only — write flow needs units, not exercised)")


def _pack_unbilled(http, rep, ctx, name, have, write, stamp):
    if write:
        body = {"name": f"{LABEL} مشروع اختبار {stamp}", "client_name": LABEL, "start_date": today(),
                "budget": 0, "end_date": None, "notes": f"{LABEL} — scripts/qa_e2e.py", "status": "in_progress"}
        r = http.post("/api/tasks/projects", body)
        proj = r.data if r.status == 200 and isinstance(r.data, dict) else None
        if not proj or not proj.get("id"):
            rep.add(name, "FAIL", f"create project POST /api/tasks/projects → {r.status} {r.detail()}")
            return
        ctx["created"].append(f"project «{body['name']}»")
    else:
        r = http.get("/api/tasks/projects")
        projs = records_of(r.data) if r.status == 200 else []
        if not projs:
            rep.add(name, "SKIP", "no project to read (read-only run) — run with --write")
            return
        proj = projs[0]
    pid = quote(str(proj["id"]))
    r = http.get(f"/api/projects/{pid}/unbilled")
    if not (r.status == 200 and isinstance(r.data, dict) and r.data.get("available") is True):
        rep.add(name, "FAIL", f"GET /api/projects/{{id}}/unbilled → {r.status}, available="
                              f"{(r.data or {}).get('available') if isinstance(r.data, dict) else '?'} {r.detail()}")
        return
    wips = r.data.get("wip_accounts") or []
    if not write:
        rep.add(name, "PASS", f"available, accounts {[w.get('account_code') for w in wips]} (read only)")
        return
    w = wips[0]
    # UnbilledWorkPanel.save → accrual, then closeIt → reversal: nets to zero
    r = http.post(f"/api/projects/{pid}/unbilled", {"amount": 1000, "date": today(),
                                                    "description": f"{LABEL} أعمال منجزة اختبار",
                                                    "wip_account": w.get("account_code"),
                                                    "revenue_account": w.get("default_revenue")})
    item = (r.data or {}).get("item") if isinstance(r.data, dict) else None
    if r.status != 200 or not item:
        rep.add(name, "FAIL", f"accrual POST /api/projects/{{id}}/unbilled → {r.status} {r.detail()}")
        return
    x, e1 = fetch_entry(http, item.get("journal_entry_id"))
    ok1, d1, net1 = entry_check(e1) if e1 else (False, f"entry not readable ({x.status})", {})
    ok1 = ok1 and abs(net1.get(str(w.get("account_code")), 0) - 1000) < 0.01
    r = http.post(f"/api/projects/{pid}/unbilled/{quote(str(item['id']))}/reverse",
                  {"reason": f"{LABEL} إقفال اختبار", "date": today()})
    if r.status != 200:
        rep.add(name, "FAIL", f"accrual {d1}; reverse → {r.status} {r.detail()}")
        return
    x, e2 = fetch_entry(http, (r.data or {}).get("journal_entry_id"))
    ok2, d2, _ = entry_check(e2) if e2 else (False, f"reversal entry not readable ({x.status})", {})
    rep.add(name, "PASS" if ok1 and ok2 else "FAIL", f"accrual Dr {w.get('account_code')} 1,000 — {d1}; reversal — {d2}")


# ─────────────────────────────── 7. ledger ───────────────────────────────

def section_ledger(http, rep, ctx):
    print("\n== 7. Ledger / ميزان المراجعة")
    r = http.get("/api/accounting/reports/trial-balance")
    if r.status != 200 or not isinstance(r.data, dict):
        rep.add("ledger: trial balance", "FAIL", f"GET /api/accounting/reports/trial-balance → {r.status} {r.detail()}")
    else:
        d, c = float(r.data.get("total_debit") or 0), float(r.data.get("total_credit") or 0)
        ok = bool(r.data.get("is_balanced")) and abs(d - c) < 0.01
        rep.add("ledger: trial balance", "PASS" if ok else "FAIL", f"Dr {d:,.2f} / Cr {c:,.2f} (diff {d - c:,.2f})")
    r = http.get("/api/accounting/journal-entries", params={"limit": 500})
    if r.status != 200:
        rep.add("ledger: entries balanced", "FAIL", f"GET /api/accounting/journal-entries → {r.status} {r.detail()}")
        return
    entries = (r.data or {}).get("entries") or []
    bad = []
    for e in entries:
        lines = e.get("lines") or []
        d = round(sum(float(l.get("debit") or 0) for l in lines), 2)
        c = round(sum(float(l.get("credit") or 0) for l in lines), 2)
        if abs(d - c) >= 0.01:
            bad.append(f"{e.get('entry_number') or e.get('id')} ({d:,.2f}/{c:,.2f}, {e.get('status')})")
    rep.add("ledger: entries balanced", "FAIL" if bad else "PASS",
            f"{len(bad)} unbalanced of the latest {len(entries)}" + (": " + ", ".join(bad[:8]) if bad else ""))


# ─────────────────────────────── main ───────────────────────────────

SECTIONS = ("sweep", "sales", "payroll", "ess", "plan", "packs", "ledger")


def run(argv=None, client=None, db=None, base=None):
    ap = argparse.ArgumentParser(description="QA end-to-end sweep on the QA company only")
    ap.add_argument("--write", action="store_true", help="also run the write flows (creates QA-E2E records)")
    ap.add_argument("--rps", type=float, default=4.0, help="requests per second (max 8)")
    ap.add_argument("--only", default="", help="comma list of sections: " + ",".join(SECTIONS))
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args(argv)
    only = {s.strip() for s in args.only.split(",") if s.strip()} or set(SECTIONS)
    unknown = only - set(SECTIONS)
    if unknown:
        ap.error(f"unknown section(s): {', '.join(sorted(unknown))}")

    started = time.time()
    if db is None:
        from database import db as _db
        db = _db
    print("=" * 100)
    print(f"QA E2E — {datetime.now():%Y-%m-%d %H:%M}   mode: {'WRITE' if args.write else 'READ-ONLY (add --write for the write flows)'}")
    try:
        ctx = asyncio.run(load_context(db))
    except Refuse as e:
        print(f"\nREFUSED: {e}")
        return 2
    ctx["write"], ctx["created"] = args.write, []
    if not ctx.get("is_test"):
        print("  ! warning: the QA company is not flagged is_test (continuing — the exact name matched)")
    token = mint_token(ctx)
    http = Http(token, client=client, base=base or BASE, rps=args.rps, verbose=args.verbose)
    rep = Report()
    print(f"company : {ctx['company_name']}  ({ctx['company_id']})")
    print(f"as      : {ctx['email']}  ({ctx['role']})   API: {base or BASE}")

    # make sure the API sees the same company before doing anything
    r = http.get("/api/companies/current")
    seen = (r.data or {}).get("id") if isinstance(r.data, dict) else None
    if r.status == 0:
        print(f"\nREFUSED: the API at {base or BASE} is not answering: {r.text[:200]}")
        return 2
    if seen and seen != ctx["company_id"]:
        print(f"\nREFUSED: the API reports company {seen}, not the QA company — stopping")
        return 2
    rep.add("context", "PASS", f"token accepted, GET /api/companies/current → {r.status}"
                               + (f" ({seen})" if seen else ""))

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    steps = [
        ("sweep", lambda: section_sweep(http, rep, ctx)),
        ("sales", lambda: section_sales(http, rep, ctx, stamp) if args.write else
         rep.add("sales: customer → invoice → entry", "SKIP", "write flow — run with --write")),
        ("payroll", lambda: section_payroll(http, rep, ctx) if args.write else
         rep.add("payroll: run → calculate → approve → entry", "SKIP", "write flow — run with --write")),
        ("ess", lambda: section_ess(http, rep, ctx) if args.write else
         rep.add("ess: preview token", "SKIP", "issues a token + audit record — run with --write")),
        ("plan", lambda: section_plan(http, rep, ctx)),
        ("packs", lambda: section_packs(http, rep, ctx, args.write, stamp)),
        ("ledger", lambda: section_ledger(http, rep, ctx)),
    ]
    for name, fn in steps:
        if name not in only:
            continue
        try:
            fn()
        except Exception as e:
            import traceback
            traceback.print_exc()
            rep.add(name, "FAIL", f"script error: {type(e).__name__}: {e}")

    if ctx["created"]:
        print("\nCreated in the QA company (all labelled «QA-E2E»):")
        for c in ctx["created"]:
            print(f"  - {c}")
    rep.print_summary(ctx, http, started)
    return 1 if rep.failed() else 0


if __name__ == "__main__":
    sys.exit(run())
