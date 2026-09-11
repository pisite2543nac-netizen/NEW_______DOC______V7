# Nangrong Smart Worksheet System / DOC-FULL-NR — V16 FINAL

ระบบจัดการการเรียนรายวิชาแบบ PWA สำหรับวิทยาลัยเทคนิคนางรอง โดยใช้ **1 รายวิชา = 1 ห้องเรียนรายวิชา** และรวมสมาชิก ใบงาน สื่อ ระบบสอบ สแกนสำเนากระดาษ และสรุปคะแนนไว้ในวงจรเดียวกัน

## โครงสร้างหลัก

`ห้องเรียนรายวิชา → นักศึกษา → ใบงาน Paper/Digital → สื่อ → ระบบสอบ → สแกนสำเนางานกระดาษ → สรุปคะแนน`

Frontend เป็น Static PWA ใน `/site` ไม่ใช้ React/Vite และ Backend ใช้ Supabase Auth/PostgreSQL/RLS/RPC/Storage/Realtime

## V16 Exam Center

นำแนวคิดที่เหมาะสมจากระบบสอบเดิมมาปรับเป็น Server-backed Exam Center:

- ข้อสอบปรนัย 4 ตัวเลือก **50 ข้อ**
- เวลา **75 นาที** และ Auto-submit เมื่อหมดเวลา
- คะแนนเต็ม **20** สูตร `จำนวนข้อถูก × 20 / 50`
- Question Bank แยกตามรายวิชา
- สุ่มข้อจากคลัง และสลับลำดับข้อ/ตัวเลือกต่อ attempt
- กล่องตัวเลือกมีขนาดสม่ำเสมอ
- บันทึกเหตุการณ์สลับแท็บ / ออกจาก Fullscreen / Copy-Paste-Cut / Context Menu / Print
- Browser restriction เป็นมาตรการลดการทุจริตและ Audit ไม่ใช่ security boundary 100%
- Student ไม่เห็นคะแนน เฉลย Answer Key หรือ Admin Comment
- Admin เพิ่ม/แก้/ปิดข้อสอบ, Import/Export JSON, ดูผล, ดูเหตุการณ์, Reset ผู้เข้าสอบ และลบชุดสอบ
- คะแนนปลายภาคไม่มี flow ให้ Student ขอเปิดดู

## สรุปคะแนนรายวิชา 100 คะแนน

ค่าเริ่มต้นต่อห้องเรียนรายวิชา:

- งาน 40
- จิตพิสัย 20
- สอบกลางภาค 20
- สอบปลายภาค 20

**คะแนนงานคิดจากงานที่ครูปล่อย/มอบหมายจริงเท่านั้น** ไม่ใช่จำนวน Template ทั้งหมด เช่นมี Template 15 งาน แต่ครูอนุมัติ/ปล่อย 13 งาน และนักศึกษาส่งครบ 13 งาน = คะแนนงานเต็ม 40

Admin เปิด `📊 สรุปคะแนน` ในห้องเรียนเพื่อดูตาราง Real-time, แก้จิตพิสัย, เลือกชุดกลาง/ปลายภาค, Export CSV และพิมพ์ A4 Landscape ได้

## สแกนสำเนางานกระดาษทั้งแผ่น

Admin เปิด `📄 สแกนสำเนาใบงาน` ในห้องเรียน:

1. กล้องอ่าน QR/Barcode เป็นจุดอ้างอิงหลัก
2. Server ตรวจ Token, การมอบหมาย, ใบงาน, Student, Reference Code, วันหมดอายุและการยกเลิก
3. กล้องถ่าย **ทั้งแผ่น** เป็น JPEG เพื่อเก็บหลักฐานว่ามีการเขียน/ส่งงานจริง
4. สำเนาเก็บใน Private `submissions` Storage
5. Metadata เก็บใน `paper_scans`
6. Admin สามารถเปิดสำเนาผ่าน Signed URL
7. Token หมดอายุจะแจ้งเตือน และต้องให้ Admin ยืนยันหากต้องการรับเป็นกรณีพิเศษ

## Realtime

Subject room และงานหลักใช้ Supabase Realtime สำหรับ enrollment, worksheets, assignments, submissions, exams, exam attempts, behavior scores, paper scans, attendance และ presence ตามสิทธิ์ RLS

## Ready-made worksheets

ยังรักษาใบงานสำเร็จรูปเดิม **198 ใบ** (Paper 55 / Digital 143) และแสดงภายในห้องเรียนรายวิชาตาม `subject_id` โดยไม่ Seed ซ้ำ

## Security

- RLS เป็นตัวบังคับสิทธิ์ ไม่ใช่แค่ซ่อนปุ่ม
- Student ไม่อ่าน Answer Key / Grade / Rubric / Exam Score โดยตรง
- Submission/Exam ใช้ Server Time
- Storage สำคัญเป็น Private
- ไม่มี Service Role key ใน Frontend
- Account approval และ Subject enrollment แยกกัน

## Production URLs

- `https://pisite2543nac-netizen.github.io/smartworksheet/`
- `https://pisite2543nac-netizen.github.io/NEW_______DOC______V7/`


## V16.1 Menu + Attendance Realtime
- Menu Card แบบเดียวกันทั้ง Admin/User เพื่อใช้งานง่าย
- User Profile เป็น Read-only และ RLS ป้องกันการแก้ข้อมูลเอง
- Attendance เริ่มนับ 15 นาทีจากคนแรก
- Manual summary ได้ทุกเวลา / Auto summary ด้วย pg_cron
- หลังหมดเวลาเช็คผ่าน Admin เท่านั้นและบันทึก Late
- Leave/Excused กำหนดโดย Admin ใน Attendance roster
- Realtime in-app notifications ทั้งผู้สแกน นักศึกษา และ Admin
- Scan result แสดงชื่อ ชั้น รหัสนักศึกษา วันเวลา
