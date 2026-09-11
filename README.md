# Nangrong Smart Worksheet System / DOC-FULL-NR — V15 FINAL

Production Ready Smart Learning Platform สำหรับวิทยาลัยเทคนิคนางรอง ใช้งานบน PC, Android, iPhone, iPad และ Tablet พร้อมติดตั้งเป็น PWA

## Production URLs

- Mobile / short link: `https://pisite2543nac-netizen.github.io/smartworksheet/`
- Direct GitHub Pages: `https://pisite2543nac-netizen.github.io/NEW_______DOC______V7/`

## Production architecture

Frontend เป็น **Static PWA ใน `/site`** โดยตรง ไม่ใช้ React/Vite build ใน Production

- Core shell/router: `site/app.js` + `site/v15-platform.js`
- Exam Center: `site/v15-exam.js` + `site/exam.html`
- Supabase: Auth + PostgreSQL + RLS + RPC + Storage + Edge Functions
- Deployment: GitHub Actions → GitHub Pages
- App icon: monitor/server artwork supplied by project owner; installed PWA uses 192/512/maskable variants

## Base roles

ระบบมี Base Role เพียง 2 แบบ:

- `admin` — ครู/ผู้ดูแลระบบ
- `user` — นักเรียน/นักศึกษา

`classroom_leaders` เป็น capability ของ User ไม่ใช่ role ที่สาม

## Core flow

1. นักศึกษาสมัครด้วยรหัสนักศึกษา + รหัสผ่าน + ข้อมูลการศึกษา + กล้องหน้าสด
2. บัญชีเริ่มที่ `pending` และไม่เข้าถึงข้อมูลการเรียนจน Admin อนุมัติ
3. หลังบัญชีอนุมัติ นักศึกษาขอลงทะเบียนวิชา
4. Admin อนุมัติรายวิชา
5. Admin ปล่อยใบงานหลายใบพร้อมกันให้สมาชิก Approved ของวิชา
6. ผู้เรียนทำ Digital / พิมพ์ Paper / ส่งงาน / สแกน QR ตามเงื่อนไข
7. Admin ตรวจงานและคะแนน โดยข้อมูลคะแนน/เฉลย/Rubric/ความคิดเห็นไม่ถูกเปิดแก่ User
8. ระบบรองรับ Attendance, Exam, Academic History และ Promotion

## Ready-made worksheets

Production มีใบงานสำเร็จรูปเดิม **198 ใบ** ครบ 11 รายวิชา:

- Paper 55 ใบ
- Digital 143 ใบ

ห้าม seed ซ้ำหรือทำลายข้อมูลเดิม

## Security baseline

- Default-deny RLS สำหรับข้อมูลสำคัญ
- User อ่านเฉพาะข้อมูลของตนเอง
- คะแนน/เกรด/Answer Key/Rubric/Admin Comment เป็น Admin-only
- User Exam ใช้ RPC สถานะที่ไม่คืน score/max_score
- Submission และ Exam ใช้ Server Time เป็นผู้ตัดสิน
- ไม่มี Service Role key ใน Frontend
- Storage สำคัญเป็น Private และเปิดด้วย Signed URL ตามสิทธิ์

## การนำเอกสาร Requirement มาปรับใช้

V15 ใช้เอกสาร Requirement ที่เจ้าของโครงการส่งมาแบบ **Selective Adaptation** คือเลือกเฉพาะแนวทางที่ช่วยเพิ่มความเสถียร ความปลอดภัย Mobile UX และการบำรุงรักษา ไม่ได้นำทุกข้อมาแทนระบบเดิมแบบ 1:1 รายละเอียดอยู่ที่ `docs/ADAPTATION_NOTES.md`

## Documentation

- `docs/ADMIN_GUIDE.md`
- `docs/USER_GUIDE.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/MAINTENANCE.md`
- `docs/ARCHITECTURE.md`
- `tests/README.md`

## Deployment rule

ทุก Release ต้องผ่าน validation → staging/backup → production → Pages verification. ห้ามแก้ฐานข้อมูล Production แบบ destructive และห้าม deploy script legacy ที่สร้าง route owner ซ้ำ
