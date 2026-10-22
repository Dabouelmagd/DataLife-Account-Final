#!/usr/bin/env bash
# فحص داتا لايف أكونت قبل التشغيل — read-only, changes nothing.
#   bash /opt/datalifeaccount/scripts/prelaunch_check.sh
# Prints ✅ / ⚠️ / ❌ per check and a summary at the end.
cd /opt/datalifeaccount 2>/dev/null || { echo "❌ /opt/datalifeaccount مش موجود"; exit 1; }
SITE="https://datalifeaccount.com"
OK=0; WARN=0; BAD=0
ok()   { echo "✅ $*"; OK=$((OK+1)); }
warn() { echo "⚠️  $*"; WARN=$((WARN+1)); }
bad()  { echo "❌ $*"; BAD=$((BAD+1)); }
code() { curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$1"; }

echo "── الإصدار والحاويات"
echo "   الكود: $(git log --oneline -1)"
for c in datalife_backend datalife_mongo; do
  st=$(docker inspect -f '{{.State.Status}} {{.RestartCount}}' "$c" 2>/dev/null)
  [ "${st%% *}" = "running" ] && ok "$c شغال (إعادات تشغيل: ${st##* })" || bad "$c مش شغال ($st)"
done
fe=$(docker ps --format '{{.Names}}' | grep -i -m1 front)
[ -n "$fe" ] && ok "الواجهة شغالة ($fe)" || warn "مش لاقي حاوية الواجهة باسم فيه front — راجعي docker ps"

echo "── الموقع"
for p in / /staff /app /manifest.json /icon-192.png; do
  c=$(code "$SITE$p"); [ "$c" = "200" ] && ok "$p → 200" || bad "$p → $c"
done
c=$(code "$SITE/api/health"); [ "$c" = "200" ] && ok "/api/health → 200" || bad "/api/health → $c"
c=$(code "$SITE/api/payments/catalog"); [ "$c" = "200" ] && ok "صفحة الأسعار بتجيب الأسعار من السيرفر" || bad "/api/payments/catalog → $c"
c=$(code "$SITE/api/sales/customers"); { [ "$c" = "401" ] || [ "$c" = "403" ]; } && ok "الـ API مقفول من غير تسجيل دخول ($c)" || bad "/api/sales/customers من غير دخول رجّع $c"
c=$(code "http://datalifeaccount.com/"); { [ "$c" = "301" ] || [ "$c" = "308" ]; } && ok "http بيتحول لـ https" || warn "http رجّع $c"
hdr=$(curl -sI --max-time 20 "$SITE/" | tr -d '\r')
echo "$hdr" | grep -qi "geolocation=(self)" && ok "الموقع مسموح له يحدد مكان الموظف (GPS)" || bad "Permissions-Policy مش فيه geolocation=(self)"
echo "$hdr" | grep -qi "strict-transport-security" && ok "HSTS موجود" || warn "HSTS مش موجود"

echo "── شهادة SSL"
end=$(echo | openssl s_client -servername datalifeaccount.com -connect datalifeaccount.com:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$end" ]; then
  days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
  [ "$days" -gt 14 ] && ok "الشهادة صالحة $days يوم" || bad "الشهادة هتخلص بعد $days يوم"
else bad "مش قادر أقرا الشهادة"; fi

echo "── الإعدادات (من غير ما نطبع أي سر)"
for k in JWT_SECRET_KEY MONGO_URL MONGO_ROOT_PASSWORD; do
  grep -q "^$k=." .env && ok "$k موجود" || bad "$k ناقص في .env"
done
grep -q "^PLAN_ENFORCEMENT=enforce" .env && ok "قفل الباقات شغال" || warn "PLAN_ENFORCEMENT مش enforce"
grep -q "^PERMISSION_ENFORCEMENT=log" .env && warn "الصلاحيات في وضع log بس" || ok "الصلاحيات مطبقة"
grep -q "PASTE\|CHANGE_ME\|changeme" .env && bad "فيه قيمة مؤقتة في .env (PASTE / CHANGE_ME)" || ok "مفيش قيم مؤقتة في .env"
docker port datalife_mongo 2>/dev/null | grep -q "0.0.0.0" && bad "قاعدة البيانات مفتوحة للإنترنت" || ok "قاعدة البيانات مش مفتوحة برا السيرفر"

echo "── النسخ الاحتياطي"
# the active job is deploy/backup/mongo_backup.sh (replaced scripts/backup_datalife.sh)
[ -r /etc/datalife-backup.env ] && { set -a; . /etc/datalife-backup.env; set +a; }
BDIR="${BACKUP_DIR:-/var/backups/datalife}"
last=$(ls -t "$BDIR"/datalife-*.archive.gz 2>/dev/null | head -1)
if [ -n "$last" ]; then
  age=$(( ( $(date +%s) - $(stat -c %Y "$last") ) / 3600 ))
  [ "$age" -le 26 ] && ok "آخر نسخة على السيرفر من $age ساعة ($(basename "$last"))" || bad "آخر نسخة على السيرفر عمرها $age ساعة ($(basename "$last"))"
else bad "مفيش نسخ في $BDIR"; fi
if [ -r "$BDIR/last_backup.json" ]; then
  grep -q '"verified": *true' "$BDIR/last_backup.json" && ok "آخر نسخة اتجربت واسترجاعها سليم" || warn "آخر نسخة مكتوب إنها ما اتجربتش"
  off=$(grep -o '"offsite": *"[^"]*"' "$BDIR/last_backup.json" | cut -d'"' -f4)
  [ -n "$off" ] && [ "$off" != "none" ] && ok "آخر نسخة اترفعت برا السيرفر ($off)" || bad "آخر نسخة ما اترفعتش برا السيرفر"
fi
if { crontab -l 2>/dev/null; cat /etc/crontab /etc/cron.d/* 2>/dev/null; } | grep -v '^\s*#' | grep -q 'mongo_backup.sh'; then
  ok "النسخ اليومي متجدول"
else bad "النسخ اليومي مش متجدول"; fi
if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null; then
  rl=$(rclone lsl "$RCLONE_REMOTE" --include 'datalife-*' 2>/dev/null | sort -k2,3 | tail -1)
  [ -n "$rl" ] && ok "آخر نسخة على درايف: $(echo "$rl" | awk '{print $2, $NF}')" || bad "مفيش نسخ على $RCLONE_REMOTE"
else warn "RCLONE_REMOTE مش متظبط في /etc/datalife-backup.env"; fi

echo "── السيرفر"
use=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "$use" -lt 80 ] && ok "مساحة الديسك مستخدمة $use%" || bad "الديسك مستخدم $use% — نظّفي"
mem=$(free -m | awk '/Mem/{print int($7*100/$2)}')
[ "$mem" -gt 10 ] && ok "الرامات المتاحة $mem%" || warn "الرامات المتاحة $mem% بس"

echo "── أخطاء آخر ساعة في البرنامج"
errs=$(docker compose logs --since 1h backend 2>/dev/null | grep -ciE "traceback|error")
[ "$errs" -eq 0 ] && ok "مفيش أخطاء" || warn "$errs سطر فيه خطأ — شوفيهم: docker compose logs --since 1h backend | grep -iE 'traceback|error' | tail -40"

echo
echo "النتيجة: ✅ $OK   ⚠️  $WARN   ❌ $BAD"
[ "$BAD" -eq 0 ] && echo "البرنامج جاهز تقنياً — باقي التجربة اليدوية من القائمة." || echo "فيه حاجات لازم تتصلح قبل التشغيل — ابعتي الناتج."
