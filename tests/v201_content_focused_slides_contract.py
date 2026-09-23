from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
flow=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
idx=(ROOT/'site/index.html').read_text('utf-8')
meta=(ROOT/'site/release-meta.js').read_text('utf-8')
sw=(ROOT/'site/sw.js').read_text('utf-8')
ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert any(x in idx for x in ['data-docnr-release="v20-1-content-focused-slides"','data-docnr-release="v20-2-adaptive-mobile-camera-stability"','data-docnr-release="v20-3-device-adaptive-interaction-camera-stability"','data-docnr-release="v20-4-real-device-mobile-router-adaptive-camera"','data-docnr-release="v20-5-late-teacher-barcode-admin-room-groups"'])
assert any(x in meta for x in ['RELEASE_VERSION="V20.1"','RELEASE_VERSION="V20.2"','RELEASE_VERSION="V20.3"','RELEASE_VERSION="V20.4"','RELEASE_VERSION="V20.5"'])
assert any(x in sw for x in ['doc-full-nr-v20-1-content-focused-slides-20260922','doc-full-nr-v20-2-adaptive-mobile-camera-stability-20260922','doc-full-nr-v20-3-device-adaptive-interaction-camera-stability-20260922','doc-full-nr-v20-4-real-device-mobile-router-adaptive-camera-20260923','doc-full-nr-v20-5-late-teacher-barcode-admin-room-groups-20260923'])
assert 'function analyticalQuestions(' in flow
for marker in ['MEANING & IMPORTANCE','SCOPE & CONTEXT','KEY CONCEPTS','PRINCIPLES','COMPONENTS & RELATIONSHIPS','HOW IT WORKS','PROCESS','APPLICATION EXAMPLE','CASE STUDY','CORRECT / INCORRECT','TROUBLESHOOTING & PRECAUTION','ANALYTICAL QUESTIONS','COMPARE & DISTINGUISH','UNIT SUMMARY']:
    assert marker in flow,marker
assert 'return slides.slice(0,20)' in flow
start=flow.index('function deckSlides(')
end=flow.index('\n// V20.0 compatibility markers',start)
deck=flow[start:end]
for forbidden in ['WORKSHEET • DIGITAL','WORKSHEET • PAPER','EXAM ALIGNMENT','TEACHER NOTE + REVIEW']:
    assert forbidden not in deck,forbidden
assert deck.index('ANALYTICAL QUESTIONS') < deck.index('COMPARE & DISTINGUISH') < deck.index('UNIT SUMMARY')
ts=ver['teaching_slides']
assert ver['version'] in ['20.1','20.2','20.3','20.4','20.5']
assert ts['pages_per_unit']==20 and ts['content_pages']==17
assert ts['analytical_question_pages']==[18,19] and ts['summary_page']==20
assert ts['content_focused_only'] is True
assert ts['dedicated_worksheet_pages_rendered'] is False
assert ts['dedicated_exam_alignment_page_rendered'] is False
assert ts['teacher_note_page_rendered'] is False
assert ts['metadata_alignment_internal'] is True
print('V20.1 CONTENT-FOCUSED TEACHING SLIDES CONTRACT PASS')
