#!/bin/bash
set -e

echo "═══════════════════════════════════════"
echo "  DataLife Deploy — $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════"

cd /opt/datalifeaccount

echo "▶ Pulling latest code..."
git fetch origin
git reset --hard origin/main
echo "  Commit: $(git log --oneline -1)"

echo "▶ Building backend..."
docker build --no-cache \
  --build-arg CACHE_BUST=$(date +%s) \
  -f backend/Dockerfile \
  -t datalife-backend:latest backend/ 2>&1 | tail -2

echo "▶ Building frontend..."
docker build --no-cache \
  --build-arg REACT_APP_BACKEND_URL=https://datalifeaccount.com \
  --build-arg CACHE_BUST=$(date +%s) \
  -t datalife-frontend:latest \
  -f frontend/Dockerfile frontend/ 2>&1 | tail -2

echo "▶ Verifying JS bundle..."
docker run --rm datalife-frontend:latest ls /usr/share/nginx/html/static/js/ | grep "^main\."

echo "▶ Restarting..."
docker compose down && docker compose up -d

sleep 3
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://datalifeaccount.com/api/)
echo "▶ API: HTTP $STATUS"
echo "✅ Deploy complete — $(date '+%H:%M:%S')"
