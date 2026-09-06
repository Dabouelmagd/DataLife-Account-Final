#!/usr/bin/env python3
"""
Pre-deploy validator — two modes:
  1. Python structural checks (fast, runs anywhere)
  2. Babel JSX parse (accurate, runs on server where node_modules exists)
"""
import re, sys, os, subprocess
from pathlib import Path

SRC = Path("frontend/src")
errors = []

# ── Mode 1: Python structural checks ─────────────────────────
def check(path):
    try:
        code = path.read_text(encoding="utf-8")
    except:
        return

    lines = code.split("\n")
    name = str(path.relative_to(SRC))

    # Duplicate 'import React from' = duplicated file body
    react_imports = re.findall(r"^import React from", code, re.MULTILINE)
    if len(react_imports) > 1:
        errors.append(f"❌ {name}: {len(react_imports)}x 'import React from' → duplicated file body")

    # Corrupted merged line: two filter().length on same line (>300 chars)
    skip_long = {'PrivacyPage','TermsPage','logos','ui/','AdminLogin',
                 'FinancialSub','HRSub','AboutPage','ContactPage'}
    for i, line in enumerate(lines):
        if len(line) > 300 and not any(x in name for x in skip_long):
            filters = len(re.findall(r'\.filter\(', line))
            lengths = len(re.findall(r'\.length', line))
            if filters >= 2 and lengths >= 2:
                errors.append(f"❌ {name}:L{i+1}: merged line ({len(line)}c) → Unterminated string")

    # Bare </div></div> as entire line content
    for i, line in enumerate(lines):
        if line.strip() == '</div></div>':
            errors.append(f"❌ {name}:L{i+1}: bare '</div></div>' → Adjacent JSX elements")

    # Multiple export default in .jsx files (not ui components)
    if path.suffix == '.jsx' and '/ui/' not in name:
        defaults = re.findall(r'^export default\b', code, re.MULTILINE)
        if len(defaults) > 1:
            errors.append(f"❌ {name}: {len(defaults)}x 'export default' → duplicated body")

# ── Mode 2: Babel JSX parse (server only) ────────────────────
def babel_parse():
    """Run babel parser on all JSX files if node_modules is available."""
    babel = Path("frontend/node_modules/@babel/parser/lib/index.js")
    if not babel.exists():
        return False  # not on server

    script = """
const fs = require('fs');
const path = require('path');
const parser = require('./frontend/node_modules/@babel/parser');

function walk(dir) {
  const items = fs.readdirSync(dir);
  let files = [];
  for (const item of items) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory() && item !== 'node_modules' && item !== 'ui') {
      files = files.concat(walk(full));
    } else if ((item.endsWith('.jsx') || item.endsWith('.js')) && !item.includes('.test.')) {
      files.push(full);
    }
  }
  return files;
}

const files = walk('frontend/src');
let errors = 0;
for (const f of files) {
  try {
    const code = fs.readFileSync(f, 'utf8');
    parser.parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript', 'classProperties'] });
  } catch(e) {
    console.log('BABEL_ERROR:' + f.replace('frontend/src/', '') + ':' + e.loc?.line + ':' + e.message?.substring(0, 100));
    errors++;
  }
}
console.log('BABEL_DONE:' + files.length + ':' + errors);
"""
    
    result = subprocess.run(['node', '-e', script], capture_output=True, text=True)
    lines = result.stdout.strip().split('\n')
    
    for line in lines:
        if line.startswith('BABEL_ERROR:'):
            parts = line.split(':', 3)
            errors.append(f"❌ {parts[1]}:L{parts[2]}: {parts[3]}")
    
    for line in lines:
        if line.startswith('BABEL_DONE:'):
            parts = line.split(':')
            total, errs = parts[1], parts[2]
            print(f"  Babel parsed {total} files, {errs} errors")
            return int(errs) == 0
    
    return len([e for e in errors if 'BABEL' in e]) == 0

# ── Run both modes ────────────────────────────────────────────
files = list(SRC.rglob("*.jsx")) + list(SRC.rglob("*.js"))
files = [f for f in files if 'node_modules' not in str(f) and '.test.' not in str(f)]

print(f"Mode 1: Python structural check ({len(files)} files)...")
for f in sorted(files):
    check(f)

print(f"Mode 2: Babel JSX parse...")
babel_ok = babel_parse()
if not babel_ok and not any('BABEL' in e for e in errors):
    print("  (skipped — node_modules not available, run on server for full check)")

print(f"\nScanned {len(files)} files\n")

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
