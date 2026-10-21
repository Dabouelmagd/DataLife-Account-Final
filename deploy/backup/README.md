# النسخ الاحتياطي لقاعدة بيانات داتا لايف — DataLife MongoDB backup

> These scripts replace `scripts/backup_datalife.sh`. Install one of them in cron, not both.

## ما الذي تفعله السكربتات

| السكربت | الوظيفة |
|---|---|
| `mongo_backup.sh` | نسخة يومية من `datalife_mongo` بصيغة `mongodump --archive --gzip`، والتحقق منها بـ `mongorestore --dryRun`، والاحتفاظ بـ 14 يومية + 8 أسبوعية + 6 شهرية، ونسخة خارج الخادم مشفّرة (اختياري)، وملف حالة `last_backup.json` |
| `mongo_restore.sh` | تجربة استرجاع (drill) في قاعدة مؤقتة `datalife_restore_test` ومقارنة عدد السجلات بالقاعدة الحية، أو استرجاع فعلي `--to-live` بعد كتابة اسم القاعدة للتأكيد |

- بيانات الدخول تُقرأ من الحاوية نفسها (`docker exec printenv`) ولا تُكتب في السكربت ولا تظهر في السجل ولا في `ps`.
- الملفات في `/var/backups/datalife/` بصلاحية `700` (root فقط).
- ملف الحالة `status/last_backup.json` لا يحتوي على أي سر: الوقت، اسم الملف، الحجم، sha256، تم التحقق، النسخة الخارجية.

## التثبيت (مرة واحدة، على الخادم كـ root)

```bash
cd /opt/datalifeaccount
chmod +x deploy/backup/mongo_backup.sh deploy/backup/mongo_restore.sh
mkdir -p /var/backups/datalife && chmod 700 /var/backups/datalife

# أول تشغيل يدوي — يجب أن ينتهي بـ "done"
deploy/backup/mongo_backup.sh
cat /var/backups/datalife/last_backup.json

# cron: كل يوم 03:17 (وقت الخادم)
( crontab -l 2>/dev/null | grep -v 'backup_datalife.sh' | grep -v 'mongo_backup.sh'; \
  echo '17 3 * * * /opt/datalifeaccount/deploy/backup/mongo_backup.sh >> /var/log/datalife-backup.log 2>&1' ) | crontab -
crontab -l
```

The exact crontab line:

```
17 3 * * * /opt/datalifeaccount/deploy/backup/mongo_backup.sh >> /var/log/datalife-backup.log 2>&1
```

(The `grep -v backup_datalife.sh` above removes the old script's line if it was installed.)

## النسخة خارج الخادم (مطلوبة لقاعدة 3-2-1)

نسخة على نفس الخادم لا تنجو إذا فُقد الخادم. ضعي الإعدادات في `/etc/datalife-backup.env` (صلاحية 600):

```bash
# 1) passphrase للتشفير — احفظي نسخة منها خارج الخادم (مدير كلمات مرور). بدونها لا يمكن فك النسخ الخارجية.
openssl rand -base64 48 > /root/.datalife_backup_key && chmod 600 /root/.datalife_backup_key

# 2a) rclone (مثلاً Hetzner Storage Box):  rclone config   ثم:
echo 'RCLONE_REMOTE="storagebox:datalife"' >> /etc/datalife-backup.env

# 2b) أو S3 / Backblaze B2 (يتطلب aws cli):
cat >> /etc/datalife-backup.env <<'EOF'
S3_BUCKET="s3://my-bucket/datalife"
S3_ENDPOINT_URL="https://s3.eu-central-003.backblazeb2.com"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
EOF
chmod 600 /etc/datalife-backup.env   # السكربت يقرأ هذا الملف ويُصدّر متغيراته
```

- الملفات تُشفَّر بـ gpg (AES256) قبل خروجها. لو كان الـ remote يشفّر بنفسه (rclone crypt) ضعي `OFFSITE_ALLOW_PLAINTEXT=1`.
- للـ S3/B2 اضبطي قاعدة lifecycle في الـ bucket (مثلاً حذف بعد 190 يوماً). مع rclone السكربت يحذف الأقدم من 186 يوماً.
- لو فشلت النسخة الخارجية يخرج السكربت بالكود 2 ويظهر في لوحة الإدارة «تحذير» (النسخة المحلية سليمة).

## تجربة الاسترجاع (Restore drill) — مرة كل شهر

```bash
# أحدث نسخة → قاعدة مؤقتة datalife_restore_test، مقارنة الأعداد، ثم حذف المؤقتة
/opt/datalifeaccount/deploy/backup/mongo_restore.sh latest

# نسخة محددة، مع إبقاء القاعدة المؤقتة للفحص
/opt/datalifeaccount/deploy/backup/mongo_restore.sh /var/backups/datalife/datalife-20261021-0317.archive.gz --keep

# من نسخة خارجية مشفرة
rclone copy storagebox:datalife/datalife-20261021-0317.archive.gz.gpg /root/
/opt/datalifeaccount/deploy/backup/mongo_restore.sh /root/datalife-20261021-0317.archive.gz.gpg
```

النتيجة جدول: `collection | backup | live | diff`. الفرق الموجب الصغير طبيعي (القاعدة الحية تتغير بعد النسخة).
مجموعة فيها آلاف السجلات «live» وصفر في «backup» = مشكلة. سجّلي تاريخ التجربة والوقت المستغرق.

## الاسترجاع الفعلي (يستبدل البيانات الحية)

```bash
/opt/datalifeaccount/deploy/backup/mongo_restore.sh /var/backups/datalife/datalife-20261021-0317.archive.gz --to-live
# يطلب كتابة اسم القاعدة (datalife) للتأكيد،
# يأخذ نسخة أمان من البيانات الحالية pre-restore-*.archive.gz،
# يوقف datalife_backend أثناء الاسترجاع ثم يعيد تشغيله.
```

ملفات الرفع (الشعارات والمرفقات): `uploads-<date>.tar.gz`:

```bash
gunzip -c /var/backups/datalife/uploads-20261021-0317.tar.gz | docker cp - datalife_backend:/app/
```

## عرض الحالة في لوحة الإدارة

`GET /api/backup/status` (مديرو المنصة فقط) يقرأ `/backup_status/last_backup.json`. يحتاج docker-compose إلى:

```yaml
  backend:
    volumes:
      - /var/backups/datalife/status:/backup_status:ro
```

بدون هذا السطر تعرض الصفحة «غير معروف» ولا تدّعي وجود نسخة.
الحالات: `ok` (متحقق منها + نسخة خارجية + أحدث من 36 ساعة)، `warning` (لا نسخة خارجية)، `stale`، `failed`، `unknown`.

---

## English summary

- **Install:** `chmod +x deploy/backup/*.sh`, run `deploy/backup/mongo_backup.sh` once by hand, then add the cron line above (daily 03:17, log to `/var/log/datalife-backup.log`). Remove the old `scripts/backup_datalife.sh` cron line.
- **Off-site:** set `RCLONE_REMOTE` or `S3_BUCKET` (+ `S3_ENDPOINT_URL` for B2) in `/etc/datalife-backup.env`; create `/root/.datalife_backup_key` and keep a copy off the server. Files are gpg-encrypted before upload.
- **Retention:** newest per day ×14, per ISO week ×8, per month ×6.
- **Verification:** every archive is read end-to-end with `mongorestore --dryRun`; `verified` is false (and the run fails) otherwise.
- **Restore drill:** `mongo_restore.sh latest` restores into `datalife_restore_test` (nsFrom/nsTo), prints counts vs live, drops it. `--keep` keeps it.
- **Live restore:** `mongo_restore.sh <file> --to-live` — interactive, type the db name, safety dump first, backend stopped meanwhile.
- **Status:** mount `/var/backups/datalife/status:/backup_status:ro` into the backend for `GET /api/backup/status`.
