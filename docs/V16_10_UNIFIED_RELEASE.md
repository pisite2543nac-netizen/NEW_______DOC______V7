# DOC-FULL-NR V16.10 UNIFIED PRODUCTION

วันที่: 15 กันยายน 2569

## เป้าหมายของรอบนี้

V16.10 เป็นรอบ “รวมระบบให้ทำงานจริง” ไม่ใช่การเพิ่มหน้าตาใหม่ โดยแก้ต้นเหตุที่ Production เคยมีหลายสคริปต์แย่งกันควบคุม Dashboard/Sidebar/Router จนหน้าเว็บดูพร้อมแต่กดแล้วไม่เดินงาน หรือค้างที่ “กำลังโหลด...”.

Production V16.10 ใช้เจ้าของงานชัดเจน:

- `site/app.js` — Auth, Shell, Base Router และฟังก์ชันฐาน เช่น Users, Grading, Overrides, Reports, Audit, System, Profile และตัวเปิดใบงาน
- `site/v16-platform.js` — Dashboard/Feature Router เพียงตัวเดียวสำหรับ Course, Enrollment, Attendance, Presence, Promotion, Exam entry, Gradebook, Paper Scan และ Account Approval
- `site/v16-7-hardening.js` — Paper print pack, Barcode/full-sheet hardening, Profile read-only presentation และ runtime safeguards
- `site/v16-8-course-flow.js` — Course learning path 13 หน่วยและ Sequential Unlock UI
- `site/v16-exam.js` — Exam 50Q/75min แบบ Server-authoritative

`v16-9-clean-dashboard.js` และ `v16-9-runtime-rescue.js` ยังเก็บไว้เป็นประวัติใน repository แต่ **ไม่ถูกโหลดใน Production**.

## การเดินทางของปุ่ม

Dashboard ไม่กดปุ่มเมนูที่ถูกซ่อนอีกต่อไป:

- Feature action → `window.DOCNR_V16_6.navigate(route)` โดยตรง
- Base action → `window.DOCNR_BASE.navigate(route)` โดยตรง
- ก่อนข้ามไป Base flow จะหยุด Presence/Room realtime ของหน้าเดิมและเปลี่ยน route state เพื่อไม่ให้ callback เก่ามา redraw ทับหน้าปัจจุบัน

ปุ่มตรวจระบบแบบซ้ำใน Topbar ถูกตัดออกใน V16.10; Dashboard แสดง Health Contract แบบ non-blocking แทน เพื่อลดความรกและลด query ซ้ำ.

Sidebar จงใจให้สั้น:

- หน้าแรก
- รายวิชา/การสอน (ตาม role)
- โปรไฟล์ของฉัน

งานอื่นเปิดผ่าน Dashboard Flow ซึ่งลดความรกแต่ไม่ได้ลบฟังก์ชัน.

## Boot / Loading

- Dashboard ไม่รอ Health RPC ก่อนแสดง
- Initial server clock sync เป็น non-blocking
- `syncServerClock()` มี timeout 3.5 วินาที
- เวลา Server ยังเป็น authoritative ใน RPC ที่ตัดสิน due date / exam / attendance
- Base dashboard ทำหน้าที่ handoff ไป Feature Dashboard เท่านั้น จึงไม่มี async dashboard รุ่นเก่ามา overwrite หน้ารุ่นใหม่ภายหลัง

## Course Flow

นักศึกษา:

1. รายวิชาทั้งหมด
2. เลือกรายวิชา
3. ใส่ CODE จาก Admin
4. `join_subject_with_code()` อนุมัติ Enrollment
5. เห็น Learning Path 13 หน่วย
6. หน่วยอนาคตมองเห็นได้แต่เปิดไม่ได้
7. เมื่อครูปลดล็อกหน่วย จึงเห็นสไลด์/สื่อและใบงานของหน่วยนั้น

Admin:

1. เปิดรายวิชา
2. ดู/เปลี่ยน CODE
3. ดูแผน 13 หน่วย
4. `admin_unlock_subject_unit()` เปิดได้ทีละหน่วย
5. Server ปฏิเสธการข้ามลำดับด้วย `PREVIOUS_UNIT_LOCKED`
6. ระบบสร้าง Assignment ให้นักศึกษาสมาชิกที่ approved อัตโนมัติ

## Digital Worksheet

- Draft → `save_worksheet_draft()`
- Final → `finalize_digital_submission()`
- Required / preview / attempt / due rule ตรวจร่วมกับ Server
- Student ไม่อ่าน Grade/Rubric admin โดยตรง

## Paper Worksheet

- พิมพ์รายบุคคลผ่าน `admin_prepare_paper_print_pack()`
- Code128 เป็น Primary Identifier
- Payload ผูก Token + ชื่อใบงาน + Due/Expiry + Reference
- กล้องเก็บ **สำเนาทั้งแผ่น** เป็นหลักฐาน
- Upload ไป private `submissions` bucket
- `admin_record_paper_scan()` ตรวจ token, assignment, expiry, revoked, duplicate และ path ก่อนบันทึก
- Admin เปิดสำเนาผ่าน signed URL

## Profile

- Student profile เป็น read-only ทั้ง UI และ DB
- Policy `profiles_update_admin_only` ป้องกัน User UPDATE โดยตรง
- Admin เป็นผู้แก้ข้อมูลนักศึกษา
- Password credential แยกจาก academic profile

## Attendance

- Session / QR / 15-minute window
- Present / Late / Absent / Excused
- Server snapshot/finalize
- Leader capability ไม่ใช่ role ใหม่
- Notifications / Realtime ใช้เฉพาะบริบทที่เกี่ยวข้อง

## Exam

- 50 ข้อ / 4 ตัวเลือก / 75 นาที / 20 คะแนน
- Server timer / autosave / final submit / timeout
- Random question/options และ anti-cheat audit
- Student path ไม่เปิด score/key โดยตรง

## Gradebook

- Work 40
- Behavior 20
- Midterm 20
- Final 20
- Work denominator คิดจากงานที่ถูก Assign จริง
- Retroactive eligible work ใช้ factor สูงสุด 0.50 ตามกติกาเดิม

## Promotion

Prepare → Review → Approve → Apply → Academic History

## Production backend contract ที่ตรวจแล้ว

- Standard templates: 198
- Paper: 55
- Digital: 143
- Active core subjects: 11
- Active join codes: 11
- Subjects with 13 units: 11
- Critical RPC set for V16.10: 15/15
- Critical RLS tables: 22/22
- Private buckets: 5/5
- Student profile DB lock: PASS
- Locked subject resource policy: PASS
- Submission override computed relation: PASS

Admin Dashboard ใช้ `admin_system_health_v1610()` เพื่อตรวจ contract นี้แบบ read-only โดยไม่บล็อกการแสดง Dashboard.

## สิ่งที่การตรวจอัตโนมัติครอบคลุม

- Static production dependencies
- ไม่มี V16.9 overlay/rescue อยู่ใน Production index
- ไม่มี legacy production scripts ใน index/exam
- Active JavaScript syntax
- Router/action contract
- Dashboard action → known route mapping
- PWA manifest/icons/cache markers
- Registration/no OTP/read-only profile markers
- Course/Gradebook/Paper/Attendance/Exam markers
- Backend schema/RPC/RLS/storage passive audit

## สิ่งที่ต้องอาศัยอุปกรณ์จริง

การตรวจด้วย source/database ไม่สามารถพิสูจน์ hardware permission ของอุปกรณ์ทุกเครื่องได้ เช่น กล้องจริง, PWA install behavior ของ Safari/Android และ fullscreen/focus behavior ระหว่างสอบ. หลัง Deploy จึงควรทำ smoke test บนอุปกรณ์จริงอย่างน้อย 1 ครั้งสำหรับ Login, กด Dashboard, Join CODE, เปิดรายวิชา และกล้อง Paper Scan.
