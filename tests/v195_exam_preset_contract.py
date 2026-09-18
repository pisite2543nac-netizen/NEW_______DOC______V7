from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
bank=json.loads((ROOT/'site/data/exam-question-bank-v18.json').read_text(encoding='utf-8'))
exam=(ROOT/'site/v16-exam.js').read_text(encoding='utf-8')
mig=(ROOT/'supabase/migrations/20260918_v19_5_exam_preset_25_25.sql').read_text(encoding='utf-8')
manifest=json.loads((ROOT/'site/data/exam-presets-v19_5/manifest.json').read_text(encoding='utf-8'))

assert len(bank)==550
codes=sorted({q['subjectCode'] for q in bank})
assert len(codes)==11
for code in codes:
    rows=[q for q in bank if q['subjectCode']==code]
    assert len(rows)==50
    course=[q for q in rows if q.get('presetSection')=='course']
    analysis=[q for q in rows if q.get('presetSection')=='analysis']
    assert len(course)==25,(code,len(course))
    assert len(analysis)==25,(code,len(analysis))
    assert all(len(q['options'])==4 for q in rows)
    assert all(0<=q['correct']<4 for q in rows)
    assert all(q.get('difficultyLabel')=='very-hard' for q in analysis)
    assert all('เหมาะกับเป้าหมายอีกลักษณะหนึ่ง' not in ' '.join(q['options']) for q in analysis)
    assert all('ตอบเป้าหมายของสถานการณ์โดยตรง' not in ' '.join(q['options']) for q in analysis)
    assert all('หลายแนวทางที่ดูสมเหตุผลใกล้เคียงกัน' in q['q'] for q in analysis)
    preset=json.loads((ROOT/f'site/data/exam-presets-v19_5/{code}.json').read_text(encoding='utf-8'))
    assert len(preset['questions'])==50
    assert all(q['presetSection']=='course' for q in preset['questions'][:25])
    assert all(q['presetSection']=='analysis' for q in preset['questions'][25:])

assert manifest['questions_per_subject']==50
assert manifest['course_questions']==25
assert manifest['analysis_questions']==25
assert 'admin_create_exam_preset_v195' in exam
assert 'ชุดสอบสำเร็จรูป 25+25' in exam
assert 'admin_create_exam_preset_v195' in mig
assert "'course_questions',25" in mig
assert "'analysis_questions',25" in mig
print('V19.5 EXAM PRESET CONTRACT PASS')
