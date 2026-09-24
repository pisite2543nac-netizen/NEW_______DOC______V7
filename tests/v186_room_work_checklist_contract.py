from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'site/app.js').read_text(encoding='utf-8')
platform=(ROOT/'site/v16-platform.js').read_text(encoding='utf-8')
css=(ROOT/'site/v18-core-ui.css').read_text(encoding='utf-8')
version=(ROOT/'VERSION.json').read_text(encoding='utf-8')
checks={
 'admin route': '["workcheck","ตารางเช็กรวม"]' in app and 'workcheck:renderRoomWorkChecklist' in platform,
 'registration grouping': all(x in platform for x in ['grade_level','room_label','department','major']),
 'logical pair': 'work_pair_key' in platform and '1 งาน' in platform,
 'named worksheet header': 'ใบงาน${subject.name}' in platform and 'หน่วยที่ ${' in platform,
 'excel': 'v186ChecklistExcel' in platform and '.xls' in platform,
 'a4 landscape': '@page{size:A4 landscape' in css,
 'responsive scroll': '.v186-table-scroll' in css and 'overflow:auto' in css,
 'version': 'V18.6 ROOM WORK CHECKLIST + REALITY AUDIT' in version,
}
failed=[k for k,v in checks.items() if not v]
if failed: raise SystemExit('V18.6 ROOM CHECKLIST CONTRACT FAIL: '+', '.join(failed))
print('V18.6 ROOM CHECKLIST CONTRACT PASS')
