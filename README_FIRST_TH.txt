DOC-FULL-NR V7 FINAL ZERO-BUILD
================================

เป้าหมายของชุดนี้:
- ให้เว็บขึ้นใช้งานจริงก่อน โดยตัดปัญหา TypeScript/Vite build ออกจาก GitHub Pages
- Backend ยังคงใช้ Supabase DOC-FULL-NR-UNIVERSAL ตัวจริง
- ไม่ลบ React source เดิมใน GitHub; deploy เฉพาะโฟลเดอร์ /site

วิธีใช้:
1) แตก ZIP
2) ดับเบิลคลิก 00_FINISH_V7_NOW.bat
3) รอ GitHub Actions ชื่อ "Deploy DOC-FULL-NR FINAL" เป็นสีเขียว
4) เว็บจะเปิดอัตโนมัติ หรือใช้ 01_OPEN_LIVE_APP.bat

URL:
https://pisite2543nac-netizen.github.io/NEW_______DOC______V7/

ทดสอบครั้งแรก:
1. สมัครบัญชีเจ้าของระบบ
2. ถ้าระบบให้ยืนยันอีเมล ให้กดยืนยันก่อน
3. Login
4. โปรไฟล์ > ตั้งบัญชีนี้เป็น Admin คนแรก
5. สร้างห้องเรียน
6. สร้างผู้เรียน 1 คน และเลือกห้อง
7. เข้าใบงาน > แก้ไขใบงานตัวอย่าง 1 ชุด > ตั้งเวลาเปิด/กำหนดส่ง > Publish
8. Login ผู้เรียน > ทำใบงาน > ส่งงาน
9. Login Admin > ตรวจงาน > บันทึกคะแนน > รายงาน

ความปลอดภัย:
- Publishable key ฝั่งเว็บเป็นคีย์ client ตามปกติของ Supabase
- ไม่มี Service Role key ใน GitHub
- Answer key / Grades / Overrides จำกัด Admin ด้วย RLS
- Storage เป็น Private
- Deadline และ submission lifecycle ตรวจฝั่ง PostgreSQL
- Role/active ของ profile ถูกป้องกันด้วย trigger ฝั่งฐานข้อมูล
