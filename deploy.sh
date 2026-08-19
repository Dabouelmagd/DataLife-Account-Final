#!/bin/bash
set -e

echo "═══════════════════════════════════════"
echo "  DataLife Deploy — $(date '+%Y-%m-%d %H:%M')"
echo "═══════════════════════════════════════"

cd /opt/datalifeaccount

# 1. Pull latest code
echo "▶ Pulling latest code..."
git fetch origin
git reset --hard origin/main
echo "  Commit: $(git log --oneline -1)"

# 2. PRE-BUILD CHECKS
echo "▶ Verifying source code..."
BANK=$(grep -c "bankModal" frontend/src/pages/PayrollPage.jsx || true)
GPS=$(grep -c "gps-attendance" frontend/src/pages/GuideWebPage.jsx || true)
echo "  bankModal occurrences: $BANK"
echo "  gps-attendance occurrences: $GPS"
if [ "$BANK" -lt 1 ] || [ "$GPS" -lt 1 ]; then
  echo "❌ Source code check failed — aborting"
  exit 1
fi
echo "  ✅ Source code verified"

# 3. Build backend (Docker — no issues here)
echo "▶ Building backend..."
docker build --no-cache \
  --build-arg CACHE_BUST=$(date +%s) \
  -f backend/Dockerfile \
  -t datalife-backend:latest backend/ 2>&1 | tail -2

# 4. Build frontend DIRECTLY on server (bypasses Docker cache issues)
echo "▶ Building frontend on server..."
cd frontend
rm -rf build/ node_modules/.cache/
NODE_OPTIONS=--max-old-space-size=1536 \
REACT_APP_BACKEND_URL=https://datalifeaccount.com \
yarn build 2>&1 | tail -3
cd ..

# 5. POST-BUILD CHECKS
echo "▶ Verifying build output..."
JSFILE=$(ls frontend/build/static/js/main.*.js | head -1)
BANK_BUILD=$(grep -c "bankModal" "$JSFILE" || true)
echo "  JS bundle: $(basename $JSFILE)"
echo "  bankModal in build: $BANK_BUILD"
if [ "$BANK_BUILD" -lt 1 ]; then
  echo "❌ Build verification failed — bankModal missing from bundle"
  exit 1
fi
echo "  ✅ Build verified"

# 6. Build frontend Docker image FROM the verified build
echo "▶ Building frontend Docker image..."
docker build --no-cache \
  -t datalife-frontend:latest \
  -f frontend/Dockerfile frontend/ 2>&1 | tail -2

# 7. Verify Docker image has the right build
DOCKER_BANK=$(docker run --rm datalife-frontend:latest \
  grep -c "bankModal" /usr/share/nginx/html/static/js/main.*.js || true)
echo "  bankModal in Docker image: $DOCKER_BANK"
if [ "$DOCKER_BANK" -lt 1 ]; then
  echo "⚠️  Docker image has wrong build — copying directly..."
  docker compose down
  docker compose up -d
  sleep 2
  docker cp frontend/build/. datalife_frontend:/usr/share/nginx/html/
  docker exec datalife_frontend nginx -s reload
else
  # 8. Restart containers
  echo "▶ Restarting containers..."
  docker compose down && docker compose up -d
fi

sleep 3
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://datalifeaccount.com/api/)
LIVE_BANK=$(curl -s https://datalifeaccount.com/static/js/main.*.js 2>/dev/null | grep -c "bankModal" || \
  curl -s "https://datalifeaccount.com/static/js/$(ls frontend/build/static/js/main.*.js | xargs basename)" | grep -c "bankModal" || true)

echo "═══════════════════════════════════════"
echo "  API: HTTP $STATUS"
echo "  bankModal live: $LIVE_BANK"
[ "$STATUS" = "200" ] && echo "  ✅ Deploy complete!" || echo "  ⚠️  Check API"
echo "═══════════════════════════════════════"
