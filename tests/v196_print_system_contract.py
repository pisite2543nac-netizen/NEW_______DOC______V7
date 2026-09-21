from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
index=(ROOT/'site/index.html').read_text('utf-8')
app=(ROOT/'site/app.js').read_text('utf-8')
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
exam=(ROOT/'site/v16-exam.js').read_text('utf-8')
hard=(ROOT/'site/v16-7-hardening.js').read_text('utf-8')
hardcss=(ROOT/'site/v16-7-hardening.css').read_text('utf-8')
flow=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
css=(ROOT/'site/v19-print-system.css').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
mig=(ROOT/'supabase/migrations/20260918_v19_6_print_system_subject_colors.sql').read_text('utf-8')
ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))

assert any(x in index for x in ['data-docnr-release="v19-6-production-print-system"','data-docnr-release="v19-7-programming-special-activity"','data-docnr-release="v19-8-standalone-special-activities"'])
assert 'v19-print-system.css?' in index
assert index.index('v19-print-system.css?') > index.index('v19-production-ui.css?')
assert 'printcenter' in app and 'ศูนย์พิมพ์และสรุปผล' in app and 'พิมพ์เอกสารของฉัน' in app
assert 'renderPrintCenterV196' in platform and 'renderPrintSubjectV196' in platform
assert 'printGradebookSummaryV196' in platform and 'printStudentGradeV196' in platform
assert 'printMyWorkSummaryV196' in platform
assert 'printSubjectWorksheetPack' in app and 'v196WorksheetSheetHtml' in app
assert 'data-v196-blank-pack' in platform and 'พิมพ์ใบงานเปล่าทั้ง 17 หน่วย' in platform
assert 'พิมพ์สรุปการเข้าเรียน' in platform
assert 'examPrintV196' in exam and 'พิมพ์สรุปผล' in exam
assert 'subject_color' in hard and '--subject-color' in hard
assert 'color_hex' in flow and '--subject-color' in flow
assert 'body.v167-printing>*:not(#v167-print-overlay)' in hardcss
assert '@media(max-width:900px)' in hardcss and '\n  .v167-print-page{width:96vw' in hardcss
assert 'body.v167-printing .v167-print-page{width:96vw' not in hardcss
assert 'body.v196-printing[data-v196-orientation="portrait"] @page' not in css
assert '@page v196Portrait' in css and '@page v196Landscape' in css
assert '.v196-report.landscape{page:v196Landscape}' in css
assert '.v196-workbook-cover' in css and '.v196-worksheet-sheet' in css
assert any(x in sw for x in ['doc-full-nr-v19-6-production-print-system-20260918','doc-full-nr-v19-7-programming-special-activity-20260920','doc-full-nr-v19-8-standalone-special-activities-20260921'])
colors={
'20001-1001':'#2E7D32','20001-1004':'#9A6700','21900-1005':'#1565C0','21901-2008':'#7B1FA2',
'21901-2017':'#00838F','21901-2020':'#455A64','21910-2010':'#EF6C00','31901-2001':'#512DA8',
'31901-2004':'#00796B','31901-2009':'#00897B','31910-0004':'#D84315'}
for code,color in colors.items():
    assert code in mig and color in mig
assert 'admin_prepare_paper_print_pack' in mig and 'my_prepare_late_paper_print' in mig
assert "'subject_color'" in mig and "'color_hex'" in mig
assert float(ver['version'])>=19.6
assert ver.get('print_system',{}).get('subject_color_identity') is True
assert ver['print_system']['paper_work_personalized_barcode'] is True
assert ver['print_system']['gradebook_room_summary'] is True
print('V19.6 PRODUCTION PRINT SYSTEM CONTRACT PASS')
