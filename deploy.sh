#!/bin/bash
set -e
cd /opt/datalifeaccount
echo "═══ DataLife Safe Deploy ═══"

echo "── Step 1: Pull ──"
git fetch origin && git reset --hard origin/main
echo "Commit: $(git log --oneline -1)"

echo "── Step 2: Verify source ──"
BANK=$(grep -c "bankModal" frontend/src/pages/PayrollPage.jsx || true)
[ "$BANK" -lt 1 ] && echo "❌ Source check failed" && exit 1
echo "✅ bankModal: $BANK"

echo "── Step 3: Build & Deploy ──"
export CACHE_BUST=$(date +%s)
docker compose down
docker compose build --no-cache
docker compose up -d

echo "── Step 4: Verify ──"
sleep 5
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://datalifeaccount.com/api/)
[ "$STATUS" = "200" ] && echo "✅ Deploy complete!" || { echo "❌ HTTP $STATUS"; docker logs datalife_backend --tail 20; exit 1; }
