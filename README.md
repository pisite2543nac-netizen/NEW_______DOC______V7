# DOC-FULL-NR Universal Smart Learning Platform — V14.1 FINAL

ระบบจัดการการเรียนของวิทยาลัยเทคนิคนางรอง รองรับ PC / Android / iPhone / iPad / Tablet และติดตั้งเป็น PWA ได้

## 📱 สำหรับใช้งานบนโทรศัพท์

**ลิงก์ทางการ:** https://pisite2543nac-netizen.github.io/smartworksheet/

ลิงก์ Production โดยตรง: https://pisite2543nac-netizen.github.io/NEW_______DOC______V7/

## Production architecture

Production เป็น **Static PWA จากโฟลเดอร์ `/site` โดยตรง** ผ่าน GitHub Pages — ไม่ต้อง `npm build` และไม่ใช้ React/Vite ในเส้นทาง Production

- Frontend owner: `site/app.js` + `site/v14-platform.js`
- Exam Center: `site/v14-exam.js` + `site/exam.html`
- Supabase: Auth + PostgreSQL/RLS + Storage + Edge Functions + Realtime
- Project ref: `thjscmfqunlaqxlievna`
- Service Worker ใช้ cache prefix เฉพาะ `doc-full-nr-` และไม่ลบ cache ของระบบอื่น

## ฟังก์ชันหลัก V14.1

- สมัครนักศึกษาด้วยเลขนักศึกษา + รหัสผ่าน + เบอร์โทร + ถ่ายรูปจากกล้องหน้าสดเท่านั้น
- OTP เบอร์โทรพร้อมใช้เมื่อ Admin ตั้ง SMS Provider และเปิดการบังคับ OTP
- Admin-only private student profiles
- ลงทะเบียนรายวิชา → รอ Admin อนุมัติ → แสดงใน Dashboard ผู้เรียน
- รายวิชาแบบ Subject-first: แยกใบงานกระดาษ / ใบงานอิเล็กทรอนิกส์ และจับคู่สไลด์/สื่อ
- ปล่อยหลายใบงานพร้อมกันให้ผู้เรียนที่ได้รับอนุมัติทั้งรายวิชา
- Countdown โดยอิง Server Time
- ตารางสถานะงาน: ยังไม่เปิด / ยังไม่ส่ง / ร่าง / ส่งแล้ว / ส่งช้า / เกินกำหนด / ตรวจคะแนนแล้ว
- Digital worksheet: Focus Mode, manual typing, ปิด copy/paste, autosave, preview ก่อน final submit, attachment, resubmit ตามสิทธิ์
- Paper worksheet: preview/print A4 แยกจาก Digital
- ตรวจงาน / คะแนน / Answer key Admin-only / Reports เดิมยังคงอยู่
- Real-time Presence
- หัวหน้าห้อง + QR Attendance + auto-open session + มา/สาย/ขาด/ลา + Attendance %
- ระบบเลื่อนชั้น: เตรียมรายการ → Admin ตรวจ → อนุมัติ → ดำเนินการจริง
- Exam Center แยก: สร้างข้อสอบ, สุ่มข้อ/ตัวเลือก, timer, autosave, auto-submit, auto/manual grading
- Technology UI/UX โทน Navy/Cyan/Blue/Violet responsive mobile-first

## ความปลอดภัย

สิทธิ์สำคัญบังคับที่ PostgreSQL RLS/RPC ไม่ใช่เพียงซ่อนปุ่มบนหน้าเว็บ และไม่มี Service Role key อยู่ใน frontend

## หมายเหตุ OTP

ระบบ OTP ใช้ Supabase Phone Auth จริง แต่ Production ยังไม่บังคับ OTP จนกว่าจะตั้ง SMS Provider ใน Supabase (เช่น Twilio/Vonage/MessageBird) เพื่อไม่ให้ผู้ใช้ติดอยู่ในขั้นสมัครสมาชิก

ดูรายละเอียด Backend ที่ `supabase/PRODUCTION_BACKEND.md`
