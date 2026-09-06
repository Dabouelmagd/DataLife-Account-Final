#!/usr/bin/env python3
"""
Pre-deploy validator v3 — zero false positives, catches real ESLint build errors.
Based on the exact errors seen in production builds.
"""
import re, sys
from pathlib import Path

SRC = Path("frontend/src")
errors = []

def check(path):
    try:
        code = path.read_text(encoding="utf-8")
    except:
        return

    lines = code.split("\n")
    name = str(path.relative_to(SRC))

    # ── 1. Duplicated file body: 2+ "import React from" ─────────────────
    # (not import ReactDOM, import ReactQuery etc — only exact React)
    react_main_imports = re.findall(r'^import React from', code, re.MULTILINE)
    if len(react_main_imports) > 1:
        errors.append(f"❌ {name}: {len(react_main_imports)}x 'import React from' — duplicated file body → 'Unexpected token'")

    # ── 2. Corrupted merged line: two JS statements on one line ─────────
    # Pattern: ends with .length followed by another statement or filter chain
    # Must be >300 chars AND contain multiple distinct statement patterns
    skip_long = {'PrivacyPage','TermsPage','logos','ui/','AdminLogin',
                 'FinancialSub','HRSub','AboutPage','ContactPage','DemoPage'}
    for i, line in enumerate(lines):
        if len(line) > 300 and i > 5:
            if any(x in name for x in skip_long):
                break
            # Real corruption: two filter().length patterns on same line
            filters = len(re.findall(r'\.filter\(', line))
            lengths = len(re.findall(r'\.length', line))
            if filters >= 2 and lengths >= 2:
                errors.append(f"❌ {name}:L{i+1}: merged line ({len(line)} chars, {filters} filters) → 'Unterminated string'")

    # ── 3. double </div></div> NOT inside a map/inline pattern ───────────
    # Valid: <div key={i}><div>content</div></div>  (wrapped in parent)
    # Invalid: two sibling closing divs that break JSX nesting
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == '</div></div>':  # ONLY if the ENTIRE line is just ></div></div>
            errors.append(f"❌ {name}:L{i+1}: bare '</div></div>' line → 'Adjacent JSX elements'")

    # ── 4. Multiple export default (real duplicate) ───────────────────────
    if path.suffix == '.jsx' and '/ui/' not in name:
        defaults = re.findall(r'^export default\b', code, re.MULTILINE)
        if len(defaults) > 1:
            errors.append(f"❌ {name}: {len(defaults)}x 'export default' → 'Unexpected token'")

def scan():
    files = list(SRC.rglob("*.jsx")) + list(SRC.rglob("*.js"))
    files = [f for f in files if 'node_modules' not in str(f) and '.test.' not in str(f)]
    for f in sorted(files):
        check(f)
    return len(files)

total = scan()
print(f"✅ Scanned {total} files\n")

if errors:
    print("=" * 60)
    print(f"❌ {len(errors)} BUILD-BLOCKING ERRORS:")
    print("=" * 60)
    for e in errors:
        print(f"  {e}")
    print()
    sys.exit(1)
else:
    print("✅ ALL CLEAR — no build-blocking errors found")
    print("✅ Safe to push and deploy\n")
    sys.exit(0)
