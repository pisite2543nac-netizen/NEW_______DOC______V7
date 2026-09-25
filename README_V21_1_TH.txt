DOC-FULL-NR V21.1 MOBILE ESSENTIALS • RELIABLE BACK • DESKTOP FULL MODE
วันที่ 25 กันยายน 2569

V21.1 เป็น Mobile UX hardening ต่อจาก V21.0 โดยไม่รื้อ business logic ที่ผ่าน regression แล้ว

PHONE
- ตัด Sidebar/เมนูรวมออกจากโทรศัพท์
- Bottom navigation เหลือ 5 ปุ่มต่อบทบาท
- Admin: หน้าแรก / เช็คชื่อ / ถ่ายใบงาน / ติดตามงาน / รายวิชา
- Teacher: หน้าแรก / เช็คชื่อ / ติดตามงาน / รายวิชา / โปรไฟล์
- Student: หน้าแรก / เช็คชื่อ / งานของฉัน / รายวิชา / โปรไฟล์
- ซ่อน entry point ของ Exam / Print / Settings / User Admin / Room Group / Audit และงาน Desktop-heavy ออกจาก Phone UI
- Dashboard มือถือทำเป็น Mobile Essentials โดยตรง

BACK NAVIGATION
- app.js ยังคงเก็บ route history ผ่าน goBackUnified()
- DOCNR_BASE export goBack
- v21-runtime.js จับ #global-back ที่ capture phase และเรียก goBack กลาง
- หาก bridge ใช้ไม่ได้ มี browser-history/dashboard fallback
- เพิ่ม touch-action และ z-index เพื่อไม่ให้ปุ่มย้อนกลับถูก layer อื่นบัง

TABLET / DESKTOP
- Tablet ยังคงใช้ drawer/touch layout
- Desktop คง Sidebar และฟังก์ชันเต็มทั้งหมด
- Business routes และ backend permissions ไม่ถูกลบ

VALIDATION
- Selected static regression: PASS ตั้งแต่ V17 → V21.1
- Mobile/camera static contracts V20.1–V20.7 + V21.1: PASS
- Browser mobile/camera contracts V20.2–V20.7 + V21.1: PASS
- V21.1 browser: Admin/Teacher/Student บน Phone/Tablet/Desktop + reliable back: PASS
- site JavaScript syntax: 24/24 PASS
- index/exam local asset references: PASS

BACKEND
V21.1 ไม่มี schema change ใหม่ จึงใช้ production alignment migration เดิม:
supabase/migrations/20260924_v21_0_production_alignment.sql
