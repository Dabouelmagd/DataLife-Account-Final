#!/usr/bin/env python3
"""
Pre-deploy validator — catches build-blocking errors before docker build.
Mode 1: Python structural checks (fast, runs anywhere)
Mode 2: Babel JSX parse (accurate, runs on server with node_modules)
Mode 3: Backend Python import checks
Mode 4: Dead API route detection (warning only)
"""
import re, sys, os, subprocess
from pathlib import Path

SRC = Path("frontend/src")
BACKEND = Path("backend/api")
errors = []
warnings = []

ROOT = Path(__file__).parent

# paths that are legitimately absent from the backend
API_IGNORE = (
    "/api/placeholder",   # demo and mock imagery
    # Stripe and PayPal checkout deliberately return 503 ("coming soon").
    # Do NOT add capture/status routes for them: a status route that ever
    # reported "paid" would activate subscriptions with no money received.
    "/api/payments/paypal/capture",
    "/api/payments/status",
)

def norm_path(p):
    """Normalise so path params and JS template vars compare equal."""
    import re as _re
    p = p.split("?")[0].rstrip("/")
    p = _re.sub(r"\$\{[^}]*\}", "{}", p)
    p = _re.sub(r"\{[^}]*\}", "{}", p)
    return p or "/"

# ── Mode 1: Frontend structural checks ───────────────────────
def check_frontend(path):
    try:
        code = path.read_text(encoding="utf-8")
    except:
        return
    lines = code.split("\n")
    name = str(path.relative_to(SRC))

    # 1. Duplicate 'import React from' = duplicated file body
    if len(re.findall(r"^import React from", code, re.MULTILINE)) > 1:
        errors.append(f"❌ {name}: duplicate 'import React from' → duplicated file body")

    # 2. Corrupted merged line (two .filter().length on one line >300 chars)
    skip = {'PrivacyPage','TermsPage','ui/','AdminLogin','FinancialSub','HRSub'}
    for i, line in enumerate(lines):
        if len(line) > 300 and not any(x in name for x in skip):
            if len(re.findall(r'\.filter\(', line)) >= 2 and len(re.findall(r'\.length', line)) >= 2:
                errors.append(f"❌ {name}:L{i+1}: merged line ({len(line)}c) → Unterminated string")

    # 3. Bare </div></div> as entire line
    for i, line in enumerate(lines):
        if line.strip() == '</div></div>':
            errors.append(f"❌ {name}:L{i+1}: bare '</div></div>' → Adjacent JSX elements")

    # 4. Multiple export default
    if path.suffix == '.jsx' and '/ui/' not in name:
        if len(re.findall(r'^export default\b', code, re.MULTILINE)) > 1:
            errors.append(f"❌ {name}: multiple 'export default' → duplicated body")

    # 5. eslint-disable referencing uninstalled rule
    for i, line in enumerate(lines):
        if 'eslint-disable' in line and 'react-hooks/exhaustive-deps' in line:
            errors.append(f"❌ {name}:L{i+1}: eslint-disable for uninstalled rule 'react-hooks/exhaustive-deps'")

# ── Mode 2: Babel JSX parse ───────────────────────────────────
def babel_parse():
    babel = Path("frontend/node_modules/@babel/parser/lib/index.js")
    if not babel.exists():
        return None  # not on server

    script = """
const fs=require('fs'),path=require('path');
const parser=require('./frontend/node_modules/@babel/parser');
function walk(d){
  return fs.readdirSync(d).flatMap(f=>{
    const full=path.join(d,f);
    return fs.statSync(full).isDirectory()&&f!=='node_modules'&&f!=='ui'
      ?walk(full)
      :(f.endsWith('.jsx')||f.endsWith('.js'))&&!f.includes('.test.')
        ?[full]:[];
  });
}
let errs=0;
const files=walk('frontend/src');
for(const f of files){
  try{
    parser.parse(fs.readFileSync(f,'utf8'),
      {sourceType:'module',plugins:['jsx','typescript','classProperties']});
  }catch(e){
    console.log('ERR:'+f.replace('frontend/src/','')+'|'+e.loc?.line+'|'+e.message?.slice(0,100));
    errs++;
  }
}
console.log('DONE:'+files.length+':'+errs);
"""
    r = subprocess.run(['node','-e',script], capture_output=True, text=True)
    for line in r.stdout.strip().split('\n'):
        if line.startswith('ERR:'):
            parts = line.split('|')
            errors.append(f"❌ {parts[0][4:]}:L{parts[1]}: {parts[2]}")
        elif line.startswith('DONE:'):
            total, errs = line.split(':')[1], line.split(':')[2]
            print(f"  Babel parsed {total} files, {errs} errors")
    return True

# ── Mode 3: Backend import checks ────────────────────────────
def check_backend():
    if not BACKEND.exists():
        return
    for path in sorted(BACKEND.glob("*.py")):
        try:
            code = path.read_text(encoding="utf-8")
        except:
            continue
        name = f"backend/api/{path.name}"
        # Check Depends used but not imported
        if "Depends(" in code and not re.search(r"from fastapi import.*\bDepends\b", code):
            errors.append(f"❌ {name}: uses Depends() but not in fastapi import")
        # Check common FastAPI items
        for item in ["HTTPException", "APIRouter"]:
            if f"{item}(" in code and item not in code.split("from fastapi import",1)[-1].split("\n")[0]:
                pass  # too many false positives for now

# ── Mode 4: Dead API route detection ─────────────────────────
# A page that calls a path the backend does not serve renders as an
# empty screen with a 404 in the console — it never fails the build.
# Reported as a warning, not an error: base URLs that get concatenated
# produce unavoidable false positives, and a noisy gate gets ignored.
def check_api_routes():
    import re

    backend = ROOT / "backend"
    if not backend.exists():
        return None

    served = set()
    for f in backend.rglob("*.py"):
        if "__pycache__" in str(f):
            continue
        t = f.read_text(encoding="utf-8", errors="ignore")
        pref = re.findall(r'APIRouter\([^)]*prefix\s*=\s*["\']([^"\']+)["\']', t)
        prefix = pref[0] if pref else ""
        for _, path in re.findall(
                r'@(?:router|app)\.(get|post|put|patch|delete|websocket)\(\s*["\']([^"\']*)["\']', t):
            served.add(norm_path(prefix + path) if path else norm_path(prefix))

    called = {}
    bases = set()
    for f in list(SRC.rglob("*.jsx")) + list(SRC.rglob("*.js")):
        if "node_modules" in str(f) or "__tests__" in str(f) or ".test." in str(f):
            continue
        t = f.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r'[`"\']((?:\$\{[^}]*\})?/api/[^`"\'\s]*)[`"\']', t):
            raw = "/api/" + m.group(1).split("/api/", 1)[1]
            key = norm_path(raw)
            called.setdefault(key, set()).add(str(f).split("frontend/src/", 1)[-1])
            before = t[max(0, m.start() - 60):m.start()]
            # `const API = ${X}/api/payroll` is a base the code appends to;
            # a full call such as fetch(`/api/x/trial-balance`) is not.
            if re.search(r'(?:const|let|var)\s+[A-Z][A-Z0-9_]*\s*=\s*[^;\n]*$', before):
                bases.add(key)

    def seg_match(a, b):
        x, y = a.split("/"), b.split("/")
        return len(x) == len(y) and all(
            p == q or p == "{}" or q == "{}" for p, q in zip(x, y))

    for path, sources in sorted(called.items()):
        if path in served:
            continue
        if any(seg_match(path, r) for r in served):
            continue
        # a base URL the code appends to: backend serves deeper paths
        if path in bases and any(r.startswith(path + "/") for r in served):
            continue
        if any(path.startswith(ok) for ok in API_IGNORE):
            continue
        warnings.append(
            f"⚠️  {path} — no backend route  ← " + ", ".join(sorted(sources)[:2]))
    print(f"  checked {len(called)} frontend API paths against {len(served)} backend routes")
    return True

# ── Mode 5: Shadowed backend routes ──────────────────────────
# FastAPI matches routes in declaration order. A dynamic route such as
# /{request_id} declared before a static sibling such as /workflows
# swallows it: the static handler is unreachable and the request 404s.
def check_shadowed_routes():
    import re
    api = ROOT / "backend" / "api"
    if not api.exists():
        return
    for f in sorted(api.glob("*.py")):
        s = f.read_text(encoding="utf-8", errors="ignore")
        routes = [(m.group(1), m.group(2)) for m in
                  re.finditer(r'@router\.(get|post|put|patch|delete)\("([^"]*)"', s)]
        for i, (m1, r1) in enumerate(routes):
            a = r1.strip("/").split("/")
            if not any(x.startswith("{") for x in a):
                continue
            for m2, r2 in routes[i + 1:]:
                b = r2.strip("/").split("/")
                if m1 == m2 and len(a) == len(b) and a != b and \
                   all(x == y or x.startswith("{") for x, y in zip(a, b)):
                    errors.append(f"❌ backend/api/{f.name}: {m2.upper()} {r2} is unreachable "
                                  f"— declared after {r1}; move it above")

# ── Mode 6: Undefined names in the backend ───────────────────
# A name used but never defined compiles fine and only explodes when that
# line runs. This class broke invoice approval, code redemption and the
# payroll runs page. pyflakes finds it statically.
def check_undefined_names():
    try:
        import pyflakes  # noqa: F401
    except ImportError:
        print("  (skipped — pip install pyflakes to enable)")
        return
    backend = ROOT / "backend"
    targets = [str(backend / d) for d in ("api", "services", "models") if (backend / d).exists()]
    targets += [str(f) for f in backend.glob("*.py")]
    out = subprocess.run([sys.executable, "-m", "pyflakes", *targets],
                         capture_output=True, text=True).stdout
    for line in out.splitlines():
        if "undefined name" in line and "__pycache__" not in line:
            errors.append("❌ " + line.replace(str(ROOT) + "/", ""))

# ── Mode 7: Reading keys the JWT does not carry ──────────────
# get_current_user returns the token payload: user_id, email, company_id,
# role. current_user["id"] raised KeyError and broke payroll disbursement.
def check_token_keys():
    import re
    api = ROOT / "backend" / "api"
    if not api.exists():
        return
    allowed = {"user_id", "email", "company_id", "role", "exp"}
    for f in sorted(api.glob("*.py")):
        s = f.read_text(encoding="utf-8", errors="ignore")
        if "Depends(get_current_user)" not in s:
            continue
        for m in re.finditer(r'current_user\[["\'](\w+)["\']\]', s):
            if m.group(1) not in allowed:
                line = s[:m.start()].count("\n") + 1
                errors.append(f"❌ backend/api/{f.name}:{line}: current_user[\"{m.group(1)}\"] — "
                              f"the token has no such key (use user_id / .get())")

# ── Mode 8: Account role vs account name ─────────────────────
# Modules were written against another chart: "bank": "112" posted every
# bank movement to 112 مباني وإنشاءات. A code that exists is not enough —
# its NAME must fit the role the code gives it.
ROLE_NAMES = [
    (r'bank\w*', r'بنك|بنوك'),
    (r'(?:main_)?cash(?:_drawer)?|treasury_cash', r'خزين|صندوق|نقدي|كاشير'),
    (r'customers?|receivables?|accounts_receivable', r'عملاء|مدين|قبض'),
    (r'suppliers?|payables?|accounts_payable|vendors?', r'موردون|دائن|الدفع'),
    (r'vat_out\w*|output_vat|sales_vat', r'مخرجات|القيمة المضافة|الضرائب المستحقة'),
    (r'vat_in\w*|input_vat|purchase_vat', r'مدخلات'),
    (r'salar\w*_payable|wages_payable|payroll_payable', r'أجور|مرتبات|مستحق'),
    (r'inventory|stock', r'مخزون'),
    (r'depreciation_exp\w*|dep_exp\w*', r'إهلاك'),
    (r'accum\w*_dep\w*', r'مجمع'),
    (r'social_insurance\w*|si_payable', r'تأمين'),
    (r'petty\w*', r'نثري'),
    (r'\w*social_insurance_payable\w*', r'تأمين'),
    (r'\w*income_tax_payable\w*|\w*payroll_tax\w*', r'ضريب'),
    (r'\w*loans_receivable\w*', r'سلف|قروض'),
    (r'\w*salaries_payable\w*', r'أجور|مرتبات|مستحق'),
    (r'\w*bank_account\w*', r'بنك|بنوك'),
]
def check_account_roles():
    import re
    chart = ROOT / "backend" / "models" / "accounting.py"
    if not chart.exists():
        return
    names = dict(re.findall(r'"code":\s*"(\d+)",\s*"name":\s*"([^"]+)"', chart.read_text(encoding="utf-8")))
    alt = "|".join(f"(?:{r})" for r, _ in ROLE_NAMES)
    pat = re.compile(r'["\']?\b(' + alt + r')\b["\']?\s*(?::\s*(?:str\s*=\s*)?|=\s*)\(?\s*["\'](\d{2,5})["\']', re.I)
    # also the call form: get_acc(settings.get("bank_account"), "111") / acct("x_id", "260")
    call = re.compile(r'\b(?:get_acc|acct|get_account_info)\(\s*(?:settings\.get\()?\s*["\'](' + alt + r')["\']\)?\s*,\s*["\'](\d{2,5})["\']', re.I)
    for folder in ("api", "services"):
        for f in sorted((ROOT / "backend" / folder).glob("*.py")):
            for n, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
                for m in list(pat.finditer(line)) + list(call.finditer(line)):
                    role, code = m.group(1), m.group(2)
                    if code not in names:
                        continue
                    allow = next(a for r, a in ROLE_NAMES if re.fullmatch(r, role, re.I))
                    if not re.search(allow, names[code]):
                        errors.append(f"❌ backend/{folder}/{f.name}:{n}: {role}={code} "
                                      f"but {code} is «{names[code]}»")

# ── Mode 9: Account maps point at accounts that exist ────────
# Modules keep maps like  "under_collection": "233". 46 entries pointed at
# codes the default chart did not have, so every posting in those modules
# (cheques, real estate, leasing, LCs, POS, dividends...) failed.
def check_account_maps():
    import re
    chart = ROOT / "backend" / "models" / "accounting.py"
    if not chart.exists():
        return
    codes = set(re.findall(r'"code":\s*"(\d+)"', chart.read_text(encoding="utf-8")))
    entry = re.compile(r'^\s*["\'](\w+)["\']\s*:\s*\(?\s*["\']([1-4]\d{1,4})["\']')
    for folder in ("api", "services"):
        for f in sorted((ROOT / "backend" / folder).glob("*.py")):
            if f.name == "cash_flow.py":      # report-only: a missing account reads as 0
                continue
            for n, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
                m = entry.match(line)
                if m and m.group(2) not in codes:
                    errors.append(f"❌ backend/{folder}/{f.name}:{n}: {m.group(1)} → {m.group(2)} "
                                  f"is not in the default chart of accounts")

# ── Mode 10: Money written without a journal entry (warning) ─
# The blind spot behind the sales-module gap: a route that stores a money
# amount and creates NO entry is invisible to checks that look for entries
# created-but-not-posted. Reviewed routes live in
# backend/scripts/reviewed_unposted_writes.txt; anything new is reported.
def check_unposted_money_writes():
    import ast, re
    api = ROOT / "backend" / "api"
    listed = ROOT / "backend" / "scripts" / "reviewed_unposted_writes.txt"
    if not api.exists():
        return
    reviewed = {l.split("#")[0].strip() for l in listed.read_text(encoding="utf-8").splitlines()
                if l.strip() and not l.startswith("#")} if listed.exists() else set()
    money = re.compile(r'"(amount|total|grand_total|paid_amount|net_salary|total_amount|price|cost|value|balance)"\s*:')
    posts = re.compile(r'post_journal_entry\(|post_simple_journal_entry\(|post_je\(|_post_entry\(|post_sales_invoice\(|'
                       r'post_customer_payment\(|record_payment\(|create_journal_entry\(|general_ledger\.insert|approve_invoice\(')
    write = re.compile(r'db\.(\w+)\.(insert_one|insert_many|update_one|update_many)\(')
    skip = re.compile(r'log|audit|notification|setting|session|counter|cache|token|otp|template|draft|quot|'
                      r'subscription_plan|plans|coupon|stats|report|config|pref', re.I)
    for f in sorted(api.glob("*.py")):
        src = f.read_text(encoding="utf-8", errors="ignore")
        try:
            tree = ast.parse(src)
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.AsyncFunctionDef):
                continue
            deco = next((ast.get_source_segment(src, d) for d in node.decorator_list
                         if "router." in (ast.get_source_segment(src, d) or "")), None)
            if not deco or ".get(" in deco:
                continue
            body = ast.get_source_segment(src, node) or ""
            if posts.search(body) or not money.search(body):
                continue
            if not any(not skip.search(m.group(1)) for m in write.finditer(body)):
                continue
            route = re.search(r'\("([^"]*)"', deco)
            key = f"{f.name}:{route.group(1) if route else node.name}"
            if key not in reviewed:
                warnings.append(f"⚠️  {key} writes a money amount but creates no journal entry — "
                                f"post it, or review and add to reviewed_unposted_writes.txt")

# ── Mode 11: By-id routes must be scoped to the caller's company (blocking) ─
# Ten cross-company gaps were found one by one before this check existed
# (accounts, users, parties, journal entries, invoices, consolidation...).
# A route taking an id in its path must query with company_id, verify the
# record's company first, or be a platform-admin tool. Reviewed exceptions:
# backend/scripts/reviewed_unscoped_routes.txt
def check_tenant_scoping():
    import ast, re, pathlib
    listed = ROOT / "backend" / "scripts" / "reviewed_unscoped_routes.txt"
    reviewed = {l.split("#")[0].strip() for l in listed.read_text(encoding="utf-8").splitlines()
                if l.strip() and not l.startswith("#")} if listed.exists() else set()
    QUERY = re.compile(r'db\.(\w+)\.(find_one|find|update_one|update_many|delete_one|delete_many|replace_one|count_documents|find_one_and_update|find_one_and_delete)\(')
    PLATFORM = re.compile(r'admin|super_admin|platform|subscription|trial|coupon|payments?_admin|monitor|health|update|public|auth|chatbot|newsletter|landing|eta_signing|webhook', re.I)
    def filter_text(src, start):
        # the first argument: a balanced {...} or a variable name
        i = src.index("(", start) + 1
        while src[i] in " \n": i += 1
        if src[i] != "{":
            return src[i:i+40].split(",")[0].split(")")[0]
        depth = 0
        for j in range(i, len(src)):
            if src[j] == "{": depth += 1
            elif src[j] == "}":
                depth -= 1
                if depth == 0: return src[i:j+1]
        return ""
    findings = []
    for f in sorted((ROOT / "backend" / "api").glob("*.py")):
        src = f.read_text(encoding="utf-8", errors="ignore")
        try: tree = ast.parse(src)
        except SyntaxError: continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.AsyncFunctionDef): continue
            deco = next((ast.get_source_segment(src, d) for d in node.decorator_list if "router." in (ast.get_source_segment(src, d) or "")), None)
            if not deco: continue
            params = re.findall(r'\{(\w+)\}', deco)
            if not params: continue
            body = ast.get_source_segment(src, node) or ""
            if re.search(r'verify_admin\(|_platform_admin\(|is_platform_admin|_verify_admin\(|role["\']\)\s*[!=]=\s*["\']Super Admin["\']|\[["\']Super Admin["\']\]', body):
                continue          # platform-admin tools: cross-company by design, gated by role
            # (collection, param) pairs checked for ownership somewhere in the function
            owned = set()
            for m in QUERY.finditer(body):
                ft = filter_text(body, m.start())
                if "company_id" in ft:
                    for p_ in params:
                        if re.search(rf'\b{p_}\b', ft): owned.add((m.group(1), p_))
            # also: ownership proven through a scoped helper, e.g. _find_supplier(company_id, supplier_id)
            helper_ok = {p_ for p_ in params if re.search(rf'\w+\(\s*(?:company_id|current_user\[.company_id.\]|cid)\s*,\s*{p_}\b', body)}
            for m in QUERY.finditer(body):
                ft = filter_text(body, m.start())
                used = [p for p in params if re.search(rf'\b{p}\b', ft)]
                if not used or "company_id" in ft:
                    continue
                owned_params = {p_ for _, p_ in owned}
                if all(p_ in owned_params or p_ in helper_ok for p_ in used):
                    continue          # ownership already verified for this record
                # a variable filter: accept if that variable was built with company_id
                if not ft.startswith("{") and re.search(rf'{re.escape(ft)}\s*=\s*\{{[^}}]*company_id', body):
                    continue
                line = src[:src.index(body)].count("\n") + body[:m.start()].count("\n") + 1
                findings.append((f.name, line, deco.replace("@router.", "")[:48], m.group(1), m.group(2)))
    seen = set()
    for fn, ln, route, coll, op in findings:
        m = re.search(r'\("([^"]*)"', route)
        key = f"{fn}:{m.group(1) if m else route}"
        if key in reviewed or key in seen:
            continue
        seen.add(key)
        errors.append(f"backend/api/{fn}:{ln}: {coll}.{op} by id without company_id ({key}) — "
                      f"scope it, verify ownership first, or review and add to reviewed_unscoped_routes.txt")

# ── Mode 12: Unauthenticated routes must be reviewed (blocking) ───────────
# Before this check: anyone on the internet could reset any user's password
# (force-reset-password), edit coupons, read DataLife's revenue reports and
# the contact inbox, and list every company's notification log. Every route
# that touches the database without authentication must be listed, with a
# reason, in backend/scripts/reviewed_public_routes.txt.
def check_public_routes():
    import ast, re
    listed = ROOT / "backend" / "scripts" / "reviewed_public_routes.txt"
    reviewed = {l.split("#")[0].strip() for l in listed.read_text(encoding="utf-8").splitlines()
                if l.strip() and not l.startswith("#")} if listed.exists() else set()
    auth = re.compile(r'Depends\(|authorization|Authorization|x_admin_key|secret_key|admin_key|api_key|verify_|'
                      r'signature|hmac|customer_token|x_api', re.I)
    dbuse = re.compile(r'db\.\w+\.')
    for f in sorted((ROOT / "backend" / "api").glob("*.py")):
        src = f.read_text(encoding="utf-8", errors="ignore")
        try:
            tree = ast.parse(src)
        except SyntaxError:
            continue
        if re.search(r'APIRouter\([^)]*dependencies=', src):
            continue
        for n in tree.body:
            if not isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef)):
                continue
            deco = next((ast.get_source_segment(src, d) for d in n.decorator_list
                         if "router." in (ast.get_source_segment(src, d) or "")), None)
            if not deco:
                continue
            body = ast.get_source_segment(src, n) or ""
            head = body[:body.index(":") + 400] if ":" in body else body
            if auth.search(head) or not dbuse.search(body):
                continue
            m = re.search(r'router\.\w+\("([^"]*)"', deco)
            key = f"{f.name}:{m.group(1) if m else n.name}"
            if key not in reviewed:
                errors.append(f"backend/api/{f.name}:{n.lineno}: {key} reads or writes the database with no "
                              f"authentication — require login, or review and add to reviewed_public_routes.txt")

# ── Mode 13: Uploads must be written inside the persistent volume (blocking) ─
# Only /app/uploads is a Docker volume. Employee documents and photos were
# written to /app/backend/uploads and user photos to /app/frontend/public/uploads:
# both inside the container, wiped on every deploy (and never served).
def check_upload_paths():
    import re
    bad = re.compile(r'["\'](/app/(?!uploads\b)[^"\']*uploads[^"\']*)["\']')
    for f in list((ROOT / "backend" / "api").glob("*.py")) + list((ROOT / "backend" / "services").glob("*.py")) + [ROOT / "backend" / "server.py"]:
        if not f.exists():
            continue
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if line.lstrip().startswith("#"):
                continue
            m = bad.search(line)
            if m:
                errors.append(f"{f.relative_to(ROOT)}:{n}: writes uploads to {m.group(1)} — outside the /app/uploads "
                              f"volume, so files are lost on every deploy")

# ── Mode 14: Uploaded files must not be served by a public mount (blocking) ──
# Uploads were a plain StaticFiles mount: anyone with a link could open an ID
# card or a contract, with no login, for ever. They are served through an
# authenticated route now (services/upload_access).
def check_public_uploads():
    server = ROOT / "backend" / "server.py"
    if not server.exists():
        return
    for n, line in enumerate(server.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        if "StaticFiles(" in stripped and "uploads" in stripped:
            errors.append(f"backend/server.py:{n}: uploads served by a public static mount — "
                          f"anyone with the link could read personal documents")

# ── Run all modes ─────────────────────────────────────────────
files = [f for f in SRC.rglob("*") if f.suffix in ('.jsx','.js')
         and 'node_modules' not in str(f) and '.test.' not in str(f)]

print(f"Mode 1: Frontend structural check ({len(files)} files)...")
for f in sorted(files):
    check_frontend(f)

print(f"Mode 2: Babel JSX parse...")
result = babel_parse()
if result is None:
    print("  (skipped — node_modules not available)")

print(f"Mode 3: Backend import check...")
check_backend()

print(f"Mode 14: Public upload mount check...")
check_public_uploads()

print(f"Mode 13: Upload path check...")
check_upload_paths()

print(f"Mode 12: Public route check...")
check_public_routes()

print(f"Mode 11: Tenant scoping check...")
check_tenant_scoping()

print(f"Mode 10: Unposted money-write check...")
check_unposted_money_writes()

print(f"Mode 9: Account map check...")
check_account_maps()

print(f"Mode 8: Account role check...")
check_account_roles()

print(f"Mode 7: Token key check...")
check_token_keys()

print(f"Mode 6: Undefined name check...")
check_undefined_names()

print(f"Mode 5: Shadowed route check...")
check_shadowed_routes()

print(f"Mode 4: API route check...")
if check_api_routes() is None:
    print("  (skipped — backend/ not available)")

print(f"\nScanned {len(files)} frontend files\n")

if warnings:
    print("-" * 60)
    print(f"⚠️  {len(warnings)} warning(s) — not blocking, but review each:")
    print("-" * 60)
    for w in sorted(warnings):
        print(f"  {w}")
    print()

if errors:
    print("=" * 60)
    print(f"❌ {len(errors)} BUILD-BLOCKING ERRORS:")
    print("=" * 60)
    for e in sorted(errors):
        print(f"  {e}")
    sys.exit(1)
else:
    print("✅ ALL CLEAR — no build-blocking errors found")
    print("✅ Safe to push and deploy")
    sys.exit(0)
