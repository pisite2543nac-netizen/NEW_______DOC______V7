from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
flow=(ROOT/'site/v16-8-course-flow.js').read_text('utf-8')
css=(ROOT/'site/v16-8-course-flow.css').read_text('utf-8')
index=(ROOT/'site/index.html').read_text('utf-8')
ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert any(x in index for x in ['v19-9-detailed-teaching-slides','v20-0-teaching-presentation-unified','v20-1-content-focused-slides'])
assert 'function topicExplanation(' in flow
assert 'function conceptExplanation(' in flow
assert 'function conceptExample(' in flow
assert 'function topicScenario(' in flow
assert 'function commonMistakes(' in flow
assert 'v199-slide-explain' in flow and 'v199-slide-example' in flow and 'v199-slide-note' in flow
assert 'คำอธิบาย' in flow and 'ตัวอย่าง / การเชื่อมโยง' in flow
assert ('วิธีวิเคราะห์อย่างเป็นระบบ' in flow) or ('วิเคราะห์ปัญหาอย่างเป็นระบบ' in flow)
assert 'ข้อผิดพลาดที่พบบ่อย' in flow
assert 'return slides.slice(0,20)' in flow
assert '.v199-slide-explain' in css and '.v199-slide-example' in css and '@media print' in css
assert float(ver['version'])>=19.9 and ver['teaching_slides']['detailed_explanations'] is True
print('V19.9 DETAILED TEACHING SLIDES CONTRACT PASS')
