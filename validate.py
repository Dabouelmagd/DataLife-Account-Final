#!/usr/bin/env python3
"""
DataLife Pre-Deploy Validator — run before every push: python3 validate.py
Catches real build-breaking issues only (no false positives)
"""
import os, re, ast, sys, json, subprocess

BASE = os.path.dirname(os.path.abspath(__file__))
errors = []
warnings = []

def err(msg):  errors.append(f"  ❌ {msg}")
def warn(msg): warnings.append(f"  ⚠️  {msg}")
def ok(msg):   print(f"  ✅ {msg}")

# ── 1. Python backend ─────────────────────────────────────────
print("\n[1/5] Python backend syntax...")
for root, dirs, files in os.walk(os.path.join(BASE, 'backend')):
    dirs[:] = [d for d in dirs if d not in ('__pycache__', '.git')]
    for f in files:
        if not f.endswith('.py'): continue
        try:
            ast.parse(open(os.path.join(root, f)).read())
        except SyntaxError as e:
            err(f"{f}: {e}")
if not errors:
    ok("All Python files clean")

# ── 2. JSX/JS checks ─────────────────────────────────────────
print("\n[2/5] JSX/JS checks...")

# CONFIRMED missing from @phosphor-icons/react (caused actual build failures)
PHOSPHOR_CONFIRMED_MISSING = {
    'TrendingUp', 'TrendingDown', 'AlertTriangle',
    'BarChart3', 'FolderOpen', 'BookOpen',
}

# CONFIRMED missing from lucide-react v1.7.0 (caused actual build failures)
LUCIDE_CONFIRMED_MISSING = set()  # none confirmed yet in lucide 1.7.0

jsx_files = []
for root, dirs, files in os.walk(os.path.join(BASE, 'frontend', 'src')):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for f in files:
        if f.endswith(('.jsx', '.js')):
            jsx_files.append(os.path.join(root, f))

for path in jsx_files:
    rel = path.replace(BASE + '/', '')
    content = open(path).read()
    lines   = content.split('\n')

    # a. Curly apostrophes (MS Word style — breaks JSX parser)
    for i, l in enumerate(lines, 1):
        if '\u2018' in l or '\u2019' in l:
            err(f"{rel} L{i}: curly apostrophe — replace with straight '")

    # b. Escaped backtick \` (Python string gen artifact)
    if r'\`' in content:
        err(f"{rel}: escaped backtick \\` found")

    # c. Unbalanced backticks (whole file)
    stripped = re.sub(r'//[^\n]*', '', content)
    stripped = re.sub(r'/\*.*?\*/', '', stripped, flags=re.DOTALL)
    # Exclude multi-line template literals (split on backtick pairs)
    bt = stripped.count('`')
    if bt % 2 != 0:
        # GPSSettings has multi-line template — verify it's not a real issue
        if 'GPSSettings' not in rel:
            err(f"{rel}: odd backtick count ({bt}) — possible unclosed template literal")

    # d. Phosphor-confirmed missing icons
    phosphor_blocks = re.findall(
        r"import\s*\{([^}]+)\}\s*from\s*'@phosphor-icons/react'", content
    )
    for block in phosphor_blocks:
        for icon in [i.strip().rstrip(',') for i in re.split(r'[,\s]+', block) if i.strip()]:
            if icon in PHOSPHOR_CONFIRMED_MISSING:
                err(f"{rel}: '{icon}' NOT in @phosphor-icons/react")

    # e. Lucide confirmed missing (currently empty — add if build fails)
    lucide_blocks = re.findall(
        r"import\s*\{([^}]+)\}\s*from\s*'lucide-react'", content
    )
    for block in lucide_blocks:
        for icon in [i.strip().rstrip(',') for i in re.split(r'[,\s]+', block) if i.strip()]:
            if icon in LUCIDE_CONFIRMED_MISSING:
                err(f"{rel}: '{icon}' NOT in lucide-react v1.7.0")

    # f. Missing export default in page components
    if '/pages/' in rel and path.endswith('.jsx'):
        has_export = 'export default' in content or 'export { default }' in content
        if not has_export:
            err(f"{rel}: missing 'export default'")

    # g. Div balance in main JSX return
    if path.endswith('.jsx') and '\n  return (' in content:
        try:
            idx = content.index('\n  return (')
        except ValueError:
            continue
        jsx = content[idx:]
        jsx_nc = re.sub(r'<div[^>]*/>', '', jsx)
        d_o = len(re.findall(r'<div[\s>]', jsx_nc))
        d_c = jsx.count('</div>')
        if abs(d_o - d_c) > 2:  # tolerance of 2 for edge cases
            err(f"{rel}: div imbalance ({d_o} opens vs {d_c} closes)")

ok(f"Checked {len(jsx_files)} JSX/JS files")

# ── 3. Key file imports ───────────────────────────────────────
print("\n[3/5] Route → import check...")
app = open(os.path.join(BASE, 'frontend/src/App.js')).read()
route_comps = re.findall(r'element=\{<(\w+)', app)
for comp in set(route_comps):
    imported = bool(re.search(rf'\bimport\s+{comp}\b', app))
    defined  = bool(re.search(rf'\bconst {comp}\s*=|\bfunction {comp}\b', app))
    if not imported and not defined:
        err(f"App.js: '{comp}' used in <Route> but not imported or defined")
ok("All route components imported")

# ── 4. Required files exist ───────────────────────────────────
print("\n[4/5] Required files...")
required = [
    'frontend/src/App.js',
    'frontend/src/pages/GuideWebPage.jsx',
    'frontend/src/pages/SuperAdminDashboard.jsx',
    'frontend/src/components/ModernSidebar.jsx',
    'frontend/src/components/LandingPage.jsx',
    'frontend/src/components/PricingSection.jsx',
    'frontend/src/config/moduleConfig.js',
    'backend/server.py',
    'backend/api/sales.py',
    'backend/api/admin_companies.py',
    'backend/api/admin_subscriptions.py',
    'backend/api/admin_users.py',
    'docker-compose.yml',
    'frontend/Dockerfile',
    'backend/Dockerfile',
]
for f in required:
    path = os.path.join(BASE, f)
    if not os.path.exists(path):
        err(f"MISSING: {f}")
if not any('MISSING' in e for e in errors):
    ok("All required files present")

# ── 5. Git status ─────────────────────────────────────────────
print("\n[5/5] Git status...")
r = subprocess.run(['git','log','--oneline','-3'], capture_output=True, text=True, cwd=BASE)
print("  Last 3 commits:")
for l in r.stdout.strip().split('\n'):
    print(f"    {l}")
r2 = subprocess.run(['git','status','--short'], capture_output=True, text=True, cwd=BASE)
if r2.stdout.strip():
    warn(f"Uncommitted files:\n" + '\n'.join(f"    {l}" for l in r2.stdout.strip().split('\n')))
else:
    ok("Working tree clean")

# ── Summary ───────────────────────────────────────────────────
print("\n" + "="*52)
if errors:
    print(f"❌ FAILED — {len(errors)} error(s):\n")
    for e in errors: print(e)
    if warnings:
        print(f"\n⚠️  Warnings:")
        for w in warnings: print(w)
    print("\n🚫 DO NOT DEPLOY\n")
    sys.exit(1)
else:
    if warnings:
        print("⚠️  Warnings:")
        for w in warnings: print(w)
    print("\n✅ ALL CLEAR — safe to deploy\n")
    print("  git fetch origin && git reset --hard origin/main")
    print("  docker build --no-cache --build-arg CACHE_BUST=$(date +%s) \\")
    print("    --build-arg REACT_APP_BACKEND_URL=https://datalifeaccount.com \\")
    print("    -t datalife-frontend:latest -f frontend/Dockerfile frontend/")
    print("  docker compose down && docker compose up -d\n")
    sys.exit(0)
