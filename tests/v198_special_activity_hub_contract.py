from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'site/app.js').read_text('utf-8')
platform=(ROOT/'site/v16-platform.js').read_text('utf-8')
js=(ROOT/'site/v19-programming-activity.js').read_text('utf-8')
css=(ROOT/'site/v19-programming-activity.css').read_text('utf-8')
mig=(ROOT/'supabase/migrations/20260921_v19_8_special_activity_standalone_hub.sql').read_text('utf-8')
idx=(ROOT/'site/index.html').read_text('utf-8')
ver=json.loads((ROOT/'VERSION.json').read_text('utf-8'))
assert 'data-docnr-release="v19-8-standalone-special-activities"' in idx
assert app.count('["specialactivity","กิจกรรมพิเศษ"]')==2
assert 'specialactivity:"กิจกรรมพิเศษ"' in app
assert 'specialactivity:"🎮"' in app
assert 'if(route==="specialactivity")' in app and 'openHub' in app
assert 'data-v197-special' not in platform
assert 'openHub' in js and 'v198-special-hub' in js and 'data-v198-open-code' in js
assert 'กลับหมวดกิจกรรมพิเศษ' in js
assert 'กิจกรรมพิเศษอิสระ' in js
assert 'v198-activity-grid' in css and 'v198-activity-card' in css
assert 'from public.profiles p' in mig
assert "se.status='approved'" not in mig
assert ver['version']=='19.8'
assert ver['programming_special_activity']['course_enrollment_required'] is False
assert ver['programming_special_activity']['standalone_top_level_menu'] is True
print('V19.8 STANDALONE SPECIAL ACTIVITY HUB CONTRACT PASS')
