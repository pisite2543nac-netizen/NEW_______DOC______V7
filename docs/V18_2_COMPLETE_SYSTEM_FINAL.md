# V18.2 COMPLETE SYSTEM FINAL

## เป้าหมาย
รุ่นนี้รวมระบบเรียนทั้งหมดเป็น Flow เดียว ไม่ใช่ฟังก์ชันแยกกระจัดกระจาย

### User Flow
สมัคร + กล้องสด -> รอ Admin อนุมัติ -> Login -> เลือกวิชา -> กรอก CODE -> เข้าเรียนทันที -> ห้องรายวิชา -> 17 หน่วย -> Slide 20 หน้า -> ใบงานประจำหน่วย -> Digital ตรงเวลา / Paper หลัง Deadline -> สถานะงาน -> Attendance -> Exam -> Profile

### Admin Flow
Dashboard -> นักศึกษา -> โปรไฟล์รายบุคคล -> รายวิชา/สมาชิก -> เปิดหน่วย -> ตรวจงาน -> ตรวจคะแนนจริง -> Gradebook -> Paper Scan ครบทุกหน้า -> Attendance -> Exam Center -> Reports -> Promotion -> Audit/System Health

## จุดแก้จากปัญหาที่พบจริง
1. Admin Student Profile: v18-core-ui.css ถูกโหลดก่อน minimal CSS และมี browser contract เปิด modal จริง
2. User Course CODE: input modal พิมพ์ได้จริง, normalize code, V18 server rate limit, join แล้ว route เข้า subject room
3. Paper Scan: ยกเป็น Admin main route; Barcode -> expected pages -> page 1..N -> preview -> server stores SHA256 -> final packet only when complete
4. Exam: นำ bank 550 ข้อจากระบบสอบที่ผู้ใช้ส่งมาเข้าระบบ Supabase เดิม ไม่มี Firebase ระบบที่สอง

## Exam
- 11 วิชา x 50 ข้อใน bank = 550
- 50 MCQ / 4 ตัวเลือก / 75 นาที / 20 คะแนน
- Basic 10 / Easy 15 / Hard 25 ต่อวิชา
- Admin import bank อัตโนมัติถ้า Production bank ยังว่าง
- random question / random option
- autosave + server timer + auto-submit
- anti-cheat event audit
- answer key แยก Admin-only
- Student ไม่เห็น score/key/correct count/rubric/comment
- Midterm/Final เชื่อม Gradebook

## Evidence / Grading
- Digital attachment immutable หลัง Final Submit
- เก็บ SHA-256 + metadata
- Digital/Paper คู่เดียว complete ได้ช่องทางเดียว
- Paper packet ต้องครบทุกหน้าตาม page_count ก่อน finalize
- งานย้อนหลัง credit factor 0.50
- Worksheet grade transaction เดียว + append-only grade history
- Exam grade history

## Reliability
- request-key idempotency critical actions
- assignment reconciliation cron
- deadline notification cron
- attendance auto finalize
- IndexedDB offline worksheet draft/outbox
- single Supabase client/session owner
- RLS + Private Storage
- capacity/integrity Admin monitor
- registration and course-code rate limiting

## Frontend acceptance
Release ต้องผ่านจาก release tree จริง:
- all V17 compatibility/static contracts
- V18.1 complete learning contract
- V18.2 final contract
- JavaScript syntax
- Dashboard browser
- Course CODE browser
- Real-use browser
- Core browser: Admin profile + Paper Scan
