# DOC-FULL-NR V16.6 — System Stabilization Report

วันที่ตรวจ: 14 กันยายน 2569  
Release marker: `V16.6-STABLE-FULL-SYSTEM`

## Production Backend ที่ตรวจยืนยันแล้ว

- ใบงานสำเร็จรูป 198 ใบ: Paper 55 / Digital 143
- รายวิชาเปิดใช้งาน 11 วิชา / Join Code เปิดใช้งาน 11 ชุด
- Account approval: pending → approved/active
- Course Join Code → enrollment → assignment
- Bulk worksheet release
- Digital Save Draft → Final Submit
- ส่งย้อนหลังที่ Admin อนุมัติใช้ credit factor 0.50
- Attendance scan → record → Realtime notification → 15-minute auto finalization
- Paper token → full-sheet evidence → confirmed submission
- Exam start → autosave → violation audit → submit → grading
- Exam timeout hardening: หลัง `expires_at` Server ไม่รับคำตอบใหม่ แต่ใช้ autosave ล่าสุด
- Promotion batch workflow
- Student privacy: User อ่าน grades, exam scores, answer keys และ join codes ตรงจากฐานข้อมูลไม่ได้

## Edge Functions

- `register-user-camera` ACTIVE v8
- `admin-create-user` ACTIVE v10
- `admin-operations` ACTIVE v13
- `register-user` ACTIVE v4 และบังคับไปเส้นทางสมัครด้วยกล้อง

## Frontend stabilization

- ลบ `v15-tech.css` ที่ไม่มีไฟล์จริงออกจาก runtime
- ใช้ cache-bust `20260914-v16-6` ชุดเดียว
- แก้ Card Menu ไม่ให้กลับเป็น plain text หลัง rerender
- Admin สร้าง/แก้ Student ได้ครบ: ชื่อ, ชื่อเล่น, วันเกิด, รหัส, ชั้น/ห้อง, แผนก, สาขา, โทรศัพท์, เลขที่
- เปลี่ยนรหัสนักศึกษาแล้ว sync Supabase Auth login ด้วย
- User Profile read-only
- Course / Worksheet / Gradebook / Attendance / Exam / Paper Scan / Report ใช้ runtime owner V16

## Release gates

- `python tests/static_validation.py` PASS
- `node --check` app.js / camera-registration.js / mobile.js / v16-platform.js / v16-exam.js / sw.js PASS
- manifest + VERSION + Tree template JSON PASS
- PWA icon sources PASS
- ทุก relative JS/CSS ที่ Production อ้างถึงมีไฟล์จริง
- Installer ใช้ SHA-256, Backup, Staging, atomic commit, main-change guard, Pages wait, public marker verify และ rollback

## Deployment state

GitHub Production `main` ที่ตรวจล่าสุดยังเป็น V15 ดังนั้น Frontend V16.6 จะถือว่าขึ้น Production ก็ต่อเมื่อ Final Installer แสดง `COMPLETED` และ `Public verification: PASSED` เท่านั้น

## Non-blocking advisories

Supabase ยังแจ้งข้อเสนอด้าน performance เช่น foreign-key indexes / RLS init-plan และ Auth leaked-password protection ยังไม่ได้เปิดจาก connector ที่มีอยู่ จึงไม่ทำ broad migration ในรอบนี้เพื่อหลีกเลี่ยงความเสี่ยงต่อ Production functional release
