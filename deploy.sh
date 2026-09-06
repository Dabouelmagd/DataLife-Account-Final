#!/bin/bash
set -e
cd /opt/datalifeaccount
echo "═══ DataLife Safe Deploy ═══"

echo "── Step 1: Pull ──"
# Set token: git remote set-url origin https://<TOKEN>@github.com/Dabouelmagd/DataLife-Account-Final.git
git fetch origin && git reset --hard origin/main
echo "Commit: $(git log --oneline -1)"

echo "── Step 2: Pre-build validation ──"
python3 validate_build.py
if [ $? -ne 0 ]; then
  echo "❌ Validation failed — fix errors before deploying"
  exit 1
fi

echo "── Step 3: Build & Deploy ──"
export CACHE_BUST=$(date +%s)
docker compose down
docker compose build --no-cache
docker compose up -d

echo "── Step 4: Verify ──"
sleep 8
NEW_HASH=$(docker exec datalife_frontend ls /usr/share/nginx/html/static/js/ | grep "^main\." | head -1)
echo "JS bundle: $NEW_HASH"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://datalifeaccount.com/api/)
[ "$STATUS" = "200" ] && echo "✅ Deploy complete!" || { echo "❌ HTTP $STATUS"; docker logs datalife_backend --tail 20; exit 1; }
