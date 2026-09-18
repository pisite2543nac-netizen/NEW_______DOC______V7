from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
js=(ROOT/'site/v16-platform.js').read_text('utf-8')
css=(ROOT/'site/v19-production-ui.css').read_text('utf-8')
mig=(ROOT/'supabase/migrations/20260918_v19_3_gradebook_17_units_manual_adjustments.sql').read_text('utf-8')
fix=(ROOT/'supabase/migrations/20260918_v19_3_1_fixed_grade_weights.sql').read_text('utf-8')
ver=(ROOT/'VERSION.json').read_text('utf-8')
checks={
 '17 official units':'between 1 and 17' in mig and '17::int assigned_count' in mig and '/17::numeric' in mig,
 'fixed 40 20 20 20':'new.work_points := 40' in fix and 'new.behavior_points := 20' in fix and 'new.midterm_points := 20' in fix and 'new.final_points := 20' in fix,
 'new gradebook rpc':'admin_subject_gradebook_v193' in mig and 'admin_subject_gradebook_v193' in js,
 'manual score rpc':'admin_adjust_subject_scores_v193' in mig and 'admin_adjust_subject_scores_v193' in js,
 'audit adjustment':"ADJUST_SUBJECT_SCORES_V193" in mig,
 'raw mid final controls':'คะแนนดิบกลางภาค' in js and 'คะแนนดิบปลายภาค' in js and 'data-v193-step' in js,
 'automatic grade':'when t.total>=80 then 4.0' in mig and "when t.total>=50 then 1.0" in mig,
 'pass fail':"then 'ผ่าน' else 'ไม่ผ่าน'" in mig and 'v193-pass-pill' in js,
 'export grade result':'<th>เกรด</th><th>ผล</th>' in js,
 'responsive score ui':'.v193-score-panel' in css and '@media(max-width:760px)' in css,
 'version':'V19.3 GRADEBOOK 17-UNIT' in ver,
}
for k,v in checks.items(): print(f'{k}:', 'PASS' if v else 'FAIL')
assert all(checks.values())
print('V19.3 GRADEBOOK CONTRACT PASS')
