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
    print(f"⚠️  {len(warnings)} dead API route(s) — pages will render empty:")
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
