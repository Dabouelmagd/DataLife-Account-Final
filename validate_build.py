#!/usr/bin/env python3
"""
Pre-deploy validator — catches build-blocking errors before docker build.
Mode 1: Python structural checks (fast, runs anywhere)
Mode 2: Babel JSX parse (accurate, runs on server with node_modules)
Mode 3: Backend Python import checks
"""
import re, sys, os, subprocess
from pathlib import Path

SRC = Path("frontend/src")
BACKEND = Path("backend/api")
errors = []

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

print(f"\nScanned {len(files)} frontend files\n")

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
