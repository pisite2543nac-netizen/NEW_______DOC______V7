from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
plat=(ROOT/'site/v16-platform.js').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
idx=(ROOT/'site/index.html').read_text('utf-8')
app=(ROOT/'site/app.js').read_text('utf-8')
checks={
'release':'v17-8-full-notifications-production' in idx,
'permission':'requestMobileNotificationPermission' in plat and 'Notification.requestPermission' in plat,
'os popup':'showOsNotification' in plat and 'showNotification' in plat,
'replay':'my_pending_deadline_notifications' in plat,
'realtime deadline':'worksheet_due_1h' in plat and 'worksheet_due_now' in plat,
'click route':'DOCNR_NOTIFICATION_CLICK' in sw and 'notifyRoute' in sw,
'icon':'nangrong-app-192-v1761.png' in sw and 'nangrong-app-192-v1761.png' in plat,
'install guide':'แจ้งเตือนใกล้หมดเวลาส่งงาน' in app,
'cache':'doc-full-nr-v17-8-full-notifications-20260915' in sw,
}
bad=[k for k,v in checks.items() if not v]
if bad:
 print('V17.8 NOTIFICATION CONTRACT FAILED');[print('-',x) for x in bad];raise SystemExit(1)
print('V17.8 NOTIFICATION CONTRACT PASS')
