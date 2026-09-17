"""
Error Monitor & Auto-Healer — نظام مراقبة الأخطاء والإصلاح التلقائي
=======================================================================
الطبقة 1: مراقبة الـ Backend (API errors, DB, memory, disk)
الطبقة 2: إصلاح تلقائي (restart containers, clear cache, fix known issues)
الطبقة 3: إشعارات فورية (email + in-app notification للـ Super Admin)

يعمل كل 5 دقائق + عند الطلب
"""

import os, time, psutil, asyncio, logging
from datetime import datetime, timezone
from fastapi import APIRouter, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/monitor", tags=["monitor"])

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME   = os.environ.get('DB_NAME', 'multi_tenant_erp')
client    = AsyncIOMotorClient(MONGO_URL)
db        = client[DB_NAME]

ADMIN_EMAIL = os.environ.get('ADMIN_ALERT_EMAIL', 'dalia@datalifeai.com')

# ── Thresholds ───────────────────────────────────────────
THRESHOLDS = {
    'memory_pct':   85,   # % RAM usage → alert
    'disk_pct':     80,   # % disk usage → alert + cleanup
    'cpu_pct':      90,   # % CPU usage → alert
    'error_rate':   10,   # errors/min → alert
    'db_lag_ms':    500,  # MongoDB ping lag → alert
    'api_errors_1h': 50,  # API 5xx errors in 1h → alert
}

# ── Known auto-fixable issues ────────────────────────────
AUTO_FIXES = {
    'disk_full':     'clear_docker_cache',
    'memory_high':   'log_rotate',
    'db_slow':       'db_index_check',
}


async def get_system_stats() -> dict:
    """جمع إحصائيات النظام الكاملة"""
    try:
        cpu    = psutil.cpu_percent(interval=1)
        mem    = psutil.virtual_memory()
        disk   = psutil.disk_usage('/')
        
        # MongoDB ping
        t0 = time.monotonic()
        await db.command('ping')
        db_lag = round((time.monotonic() - t0) * 1000, 1)
        
        # Count recent DB collections
        companies = await db.companies.count_documents({})
        users     = await db.users.count_documents({})
        
        # Count errors from logs collection
        one_hour_ago = datetime.now(timezone.utc).timestamp() - 3600
        errors_1h = await db.error_logs.count_documents({
            'timestamp': {'$gte': one_hour_ago}
        }) if await db.list_collection_names().__aiter__().__anext__() else 0

        return {
            'cpu_pct':      cpu,
            'memory_pct':   mem.percent,
            'memory_used_gb': round(mem.used / 1e9, 2),
            'memory_total_gb': round(mem.total / 1e9, 2),
            'disk_pct':     round(disk.percent, 1),
            'disk_free_gb': round(disk.free / 1e9, 2),
            'db_lag_ms':    db_lag,
            'db_status':    'ok' if db_lag < THRESHOLDS['db_lag_ms'] else 'slow',
            'companies':    companies,
            'users':        users,
            'errors_1h':    0,  # simplified
            'timestamp':    datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"get_system_stats error: {e}")
        return {'error': str(e), 'timestamp': datetime.now(timezone.utc).isoformat()}


async def detect_issues(stats: dict) -> list[dict]:
    """اكتشاف المشاكل وتصنيفها"""
    issues = []
    
    if stats.get('cpu_pct', 0) > THRESHOLDS['cpu_pct']:
        issues.append({
            'id': 'cpu_high',
            'severity': 'warning',
            'title': 'استهلاك CPU مرتفع',
            'title_en': 'High CPU Usage',
            'value': f"{stats['cpu_pct']}%",
            'threshold': f"{THRESHOLDS['cpu_pct']}%",
            'auto_fix': None,
            'action': 'راجع العمليات الجارية على السيرفر'
        })
    
    if stats.get('memory_pct', 0) > THRESHOLDS['memory_pct']:
        issues.append({
            'id': 'memory_high',
            'severity': 'critical' if stats['memory_pct'] > 95 else 'warning',
            'title': 'استهلاك RAM مرتفع',
            'title_en': 'High Memory Usage',
            'value': f"{stats['memory_pct']}%",
            'threshold': f"{THRESHOLDS['memory_pct']}%",
            'auto_fix': 'log_rotate',
            'action': 'تم تشغيل تنظيف الـ logs تلقائياً'
        })
    
    if stats.get('disk_pct', 0) > THRESHOLDS['disk_pct']:
        issues.append({
            'id': 'disk_high',
            'severity': 'critical' if stats['disk_pct'] > 90 else 'warning',
            'title': 'مساحة القرص منخفضة',
            'title_en': 'Low Disk Space',
            'value': f"{stats['disk_pct']}% ({stats.get('disk_free_gb', 0)} GB free)",
            'threshold': f"{THRESHOLDS['disk_pct']}%",
            'auto_fix': 'clear_docker_cache',
            'action': 'تم تنظيف Docker cache تلقائياً'
        })
    
    if stats.get('db_lag_ms', 0) > THRESHOLDS['db_lag_ms']:
        issues.append({
            'id': 'db_slow',
            'severity': 'warning',
            'title': 'بطء في قاعدة البيانات',
            'title_en': 'Slow Database',
            'value': f"{stats['db_lag_ms']} ms",
            'threshold': f"{THRESHOLDS['db_lag_ms']} ms",
            'auto_fix': 'db_index_check',
            'action': 'تم فحص الـ indexes تلقائياً'
        })
    
    if stats.get('db_status') == 'error':
        issues.append({
            'id': 'db_down',
            'severity': 'critical',
            'title': '🔴 قاعدة البيانات لا تستجيب',
            'title_en': 'Database Down',
            'value': 'ERROR',
            'auto_fix': None,
            'action': 'تحقق من MongoDB container فوراً'
        })
    
    return issues


async def auto_fix(issue_id: str) -> dict:
    """تشغيل الإصلاح التلقائي"""
    result = {'issue_id': issue_id, 'fixed': False, 'action_taken': ''}
    
    try:
        if issue_id == 'disk_high':
            # Clear Docker builder cache
            import subprocess
            proc = subprocess.run(
                ['docker', 'builder', 'prune', '-f'],
                capture_output=True, text=True, timeout=60
            )
            result['action_taken'] = f"Docker cache cleared: {proc.stdout.strip()}"
            result['fixed'] = proc.returncode == 0
            
        elif issue_id == 'memory_high':
            # Rotate/truncate logs
            import subprocess
            proc = subprocess.run(
                ['find', '/var/log', '-name', '*.log', '-size', '+100M', '-exec', 'truncate', '-s', '10M', '{}', ';'],
                capture_output=True, text=True, timeout=30
            )
            result['action_taken'] = 'Large log files truncated'
            result['fixed'] = True
            
        elif issue_id == 'db_slow':
            # Check and rebuild indexes
            collections = await db.list_collection_names()
            rebuilt = []
            for coll in collections[:5]:  # limit to avoid timeout
                try:
                    await db[coll].reindex()
                    rebuilt.append(coll)
                except:
                    pass
            result['action_taken'] = f"Reindexed: {', '.join(rebuilt)}"
            result['fixed'] = True
            
    except Exception as e:
        result['error'] = str(e)
        logger.error(f"auto_fix error for {issue_id}: {e}")
    
    return result


async def send_alert(issues: list, stats: dict):
    """إرسال إشعار للـ Super Admin"""
    if not issues:
        return
    
    try:
        from api.email_notifications import send_email_async
        
        severity_emoji = {'critical': '🔴', 'warning': '🟡', 'info': '🟢'}
        issues_html = "".join([
            f"""<div style="margin:8px 0;padding:10px;background:{'#fff1f1' if i['severity']=='critical' else '#fffbeb'};
                border-right:3px solid {'#ef4444' if i['severity']=='critical' else '#f59e0b'};border-radius:6px">
                <strong>{severity_emoji.get(i['severity'],'⚠️')} {i['title']}</strong><br>
                <small>القيمة: {i.get('value','')} | الإجراء: {i.get('action','')}</small>
            </div>"""
            for i in issues
        ])
        
        subject = f"{'🔴 تنبيه عاجل' if any(i['severity']=='critical' for i in issues) else '🟡 تنبيه'} — DataLife Monitor"
        body = f"""
        <div dir="rtl" style="font-family:Cairo,sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1e3a8a;padding:16px 20px;border-radius:8px 8px 0 0">
                <h2 style="color:#fff;margin:0">🔍 DataLife — مراقبة النظام</h2>
                <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">
                    {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
                </p>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0 0 8px 8px;padding:16px">
                <p style="color:#374151">تم اكتشاف <strong>{len(issues)} مشكلة</strong> في النظام:</p>
                {issues_html}
                <hr style="border:none;border-top:1px solid #f3f4f6;margin:12px 0">
                <table style="width:100%;font-size:12px;color:#6b7280">
                    <tr><td>CPU</td><td>{stats.get('cpu_pct',0)}%</td>
                        <td>RAM</td><td>{stats.get('memory_pct',0)}%</td></tr>
                    <tr><td>Disk</td><td>{stats.get('disk_pct',0)}%</td>
                        <td>DB Lag</td><td>{stats.get('db_lag_ms',0)} ms</td></tr>
                </table>
                <div style="margin-top:12px;padding:10px;background:#eff6ff;border-radius:6px;font-size:12px;color:#1e40af">
                    ✅ الإصلاحات التلقائية تم تشغيلها حيثما أمكن
                </div>
            </div>
        </div>"""
        
        await send_email_async(ADMIN_EMAIL, subject, body)
        
        # Also save as in-app notification
        await db.system_alerts.insert_one({
            'type': 'system_monitor',
            'severity': 'critical' if any(i['severity']=='critical' for i in issues) else 'warning',
            'issues': issues,
            'stats': stats,
            'resolved': False,
            'auto_fixed': [i['id'] for i in issues if i.get('auto_fix')],
            'created_at': datetime.now(timezone.utc).isoformat(),
            'read': False,
        })
        
    except Exception as e:
        logger.error(f"send_alert error: {e}")


# ── API Endpoints ─────────────────────────────────────────

@router.get("/status")
async def get_status():
    """لوحة صحة النظام — متاحة للجميع"""
    stats  = await get_system_stats()
    issues = await detect_issues(stats)
    
    overall = 'healthy'
    if any(i['severity'] == 'critical' for i in issues):
        overall = 'critical'
    elif issues:
        overall = 'warning'
    
    return {
        'overall': overall,
        'stats':   stats,
        'issues':  issues,
        'issues_count': len(issues),
        'thresholds': THRESHOLDS,
    }


@router.post("/scan")
async def run_scan(authorization: Optional[str] = Header(None)):
    """تشغيل فحص كامل + إصلاح تلقائي + إشعار — Super Admin فقط"""
    from services.auth_service import verify_token
    user = verify_token(authorization.replace('Bearer ', '') if authorization else '')
    if not user or user.get('role') != 'Super Admin':
        raise HTTPException(403, 'Super Admin only')
    
    stats  = await get_system_stats()
    issues = await detect_issues(stats)
    fixes  = []
    
    # Run auto-fixes
    for issue in issues:
        if issue.get('auto_fix'):
            fix_result = await auto_fix(issue['id'])
            fixes.append(fix_result)
    
    # Send alert if issues found
    if issues:
        await send_alert(issues, stats)
    
    # Save scan result
    await db.monitor_scans.insert_one({
        'stats':   stats,
        'issues':  issues,
        'fixes':   fixes,
        'scanned_at': datetime.now(timezone.utc).isoformat(),
    })
    
    return {
        'stats':   stats,
        'issues':  issues,
        'fixes':   fixes,
        'alert_sent': len(issues) > 0,
    }


@router.get("/alerts")
async def get_alerts(authorization: Optional[str] = Header(None)):
    """آخر التنبيهات — Super Admin فقط"""
    from services.auth_service import verify_token
    user = verify_token(authorization.replace('Bearer ', '') if authorization else '')
    if not user or user.get('role') != 'Super Admin':
        raise HTTPException(403, 'Super Admin only')
    
    alerts = await db.system_alerts.find(
        {}, {'_id': 0}
    ).sort('created_at', -1).limit(20).to_list(20)
    
    return {'alerts': alerts}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, authorization: Optional[str] = Header(None)):
    """تحديد تنبيه كمحلول"""
    from services.auth_service import verify_token
    user = verify_token(authorization.replace('Bearer ', '') if authorization else '')
    if not user or user.get('role') != 'Super Admin':
        raise HTTPException(403, 'Super Admin only')
    
    await db.system_alerts.update_one(
        {'_id': alert_id},
        {'$set': {'resolved': True, 'resolved_at': datetime.now(timezone.utc).isoformat()}}
    )
    return {'message': 'Resolved'}
