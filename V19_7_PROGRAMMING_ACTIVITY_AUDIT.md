# DOC-FULL-NR V19.7 — Detailed Integration Audit

Date: 2026-09-20
Source reviewed: `LLLLLLL_______NRTHC_______pisite2543_Code_gmae.github.io-main.zip`
Target subject: `21910-2010 การเขียนโปรแกรมภาษาคอมพิวเตอร์`

## 1. Source archive review

- 562 files after extraction
- approximately 141 MB
- 26 JavaScript files
- 5 HTML files
- 49 Markdown/history documents
- key academic modules: `levels-html.js`, `levels-python.js`, `lessons.js`, `quest-system.js`, `ranking-system.js`, `economy-system.js`
- separate game/backend modules: Firebase configuration/functions, PVP, chat/zone, shop, inventory, equipment, pets, skins/assets

The source is a standalone game and cannot safely be copied wholesale into DOC-FULL-NR because it owns a second authentication/database model. V19.7 therefore adapts the academic mechanics into the existing Supabase identity/course model.

## 2. Integrated academic functionality

- HTML: 50 stages
- Python: 50 stages
- total: 100 stages
- stage progression/unlock
- practice mode
- ranking mode
- WPM / Accuracy / mistakes / elapsed time
- class and overall leaderboard
- teacher quests
- token rewards
- Daily Focus
- Official Challenge: 30 stages / 40 activity points
- Admin feature switches and thresholds
- Admin class dashboard
- User activity dashboard
- desktop/tablet/mobile responsive typing workspace

## 3. Deliberately excluded

The integrated site does not import Firebase Auth/Firestore, PVP wagering, open-world chat/2D social zone, or the large cosmetic inventory/shop/equipment system. This keeps one identity source, one permission model, less client weight, and a smaller privacy/moderation/security surface.

## 4. Permission and integrity checks

- special activity is restricted to subject code 21910-2010
- user requires active approved profile + approved subject enrollment + open classroom
- admin uses the existing `admin` role; no new base role is introduced
- activity tables are not directly selectable/inserable by authenticated users
- anonymous role cannot execute V19.7 activity RPCs
- stage completion uses server-issued sessions
- elapsed time is server-derived
- target code is validated by SHA-256 hash on the server
- stage submission is idempotent with request keys
- Daily Focus uses server heartbeat timing
- audit log is written on stage submission

## 5. Academic separation

Official Challenge `40 activity points` are not added to the established course total. The course grade remains:

- Worksheets 40
- Behavior 20
- Midterm 20
- Final 20
- Total 100

Both Admin and User screens explicitly show that V19.7 is a special activity and does not change the 100-point gradebook.

## 6. Production backend validation

Production currently contains:

- 100 stages (HTML 50 / Python 50)
- 30 Official stages
- Official total = 40
- 6 active default Teacher Quests
- server sessions and focus heartbeat support
- zero persisted attempts/sessions at audit time

A transaction/rollback student smoke test successfully executed access → progress → start server session → submit exact stage code, then confirmed zero attempts and zero sessions remained after rollback.

During the detailed audit an Admin dashboard PL/pgSQL ambiguity was found (`student_code` output variable vs query column). It was corrected in Production migration `v19_7_2_fix_programming_admin_dashboard` and the source package includes the same fix.

## 7. Frontend validation

V19.7 loads:

- `site/v19-programming-activity.css`
- `site/v19-programming-activity.js`
- `site/data/programming-activity-v197.json`

and exposes the activity entry only on `21910-2010` in both Admin subject management and User course room.

## 8. Automated checks

- JavaScript syntax: PASS
- JSON parsing: PASS
- V17/V18/V19 static regression contracts: PASS
- V19.3 gradebook: PASS
- V19.5 exam preset: PASS
- V19.6 print system: PASS
- V19.7 programming activity static contract: PASS
- V19.7 browser responsive smoke: PASS
- V19.6 print browser smoke: PASS
- V19.3 gradebook browser smoke: PASS
- V19.2 14-viewport browser regression: PASS

## 9. Remaining platform advisories

The Supabase project still reports global advisor notices, including signed-in callable SECURITY DEFINER functions, leaked-password protection disabled, RLS init-plan/performance notices, unindexed foreign keys, and one duplicate index. V19.7 uses internal authorization and RPC-only table access, but the global advisor list is not claimed to be fully clean.
