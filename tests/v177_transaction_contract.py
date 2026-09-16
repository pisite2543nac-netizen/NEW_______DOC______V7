from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/"site/app.js").read_text("utf-8")
platform=(ROOT/"site/v16-platform.js").read_text("utf-8")
idx=(ROOT/"site/index.html").read_text("utf-8")
sw=(ROOT/"site/sw.js").read_text("utf-8")
doc=(ROOT/"docs/V17_7_CLASSROOM_TRANSACTION_HARDENING.md").read_text("utf-8")
checks={
"release":"v17-7-full-system-hardened-production" in idx,
"idempotent rpc":"finalize_digital_submission_v18" in app and "p_request_key" in app,
"retry/reconcile":"finalizeDigitalHardened" in app and "reconciled" in app,
"grade rpc":"admin_grade_submission_v18" in app,
"paper admin only":"นักศึกษาไม่สามารถยืนยันงานกระดาษด้วยตนเอง" in app,
"errors":"DIGITAL_DEADLINE_PASSED_USE_PAPER" in app and "WORK_PAIR_ALREADY_COMPLETED" in app,
"gradebook wording":"คะแนนที่ครูตรวจจริง" in platform and "1 งาน" in platform,
"health":"transaction_core_ok" in app and "real_gradebook_scores" in app,
"cache":"doc-full-nr-v18-1-complete-learning-system-20260916" in sw,
"docs":"idempotent" in doc.lower() and "40 / 20 / 20 / 20" in doc,
}
bad=[k for k,v in checks.items() if not v]
if bad:
 print("V17.7 TRANSACTION CONTRACT FAILED");[print("-",x) for x in bad];raise SystemExit(1)
print("V17.7 TRANSACTION CONTRACT PASS")
