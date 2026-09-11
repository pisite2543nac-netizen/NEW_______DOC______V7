# การปรับข้อกำหนดเอกสารต้นทางเข้ากับ DOC-FULL-NR

เอกสาร “Nangrong Smart Worksheet System” ถูกใช้เป็นแนวทางปรับปรุง ไม่ได้นำมาทั้งหมดแบบ 1:1

## สิ่งที่นำมาปรับใช้
- Mobile First และ Responsive
- Loading / Empty / Error / Success State
- Server Time สำหรับการส่งงานและกำหนดเวลา
- RLS / Server-side authorization
- Answer Key / Rubric / Grade / Admin Comment แยกสิทธิ์
- Paper / Digital แยกชัดเจน
- PDF / QR / Barcode flow
- Audit Log
- Promotion review ก่อน Apply
- CI/CD + Staging + Backup + Rollback
- เอกสาร Admin / User / Security / Deployment / Maintenance

## สิ่งที่ยึดโครงการ DOC-FULL-NR เป็นหลัก
- Static PWA ใน `/site` (ไม่กลับไป React/Vite)
- Supabase Production เดิม
- Login ด้วยรหัสนักศึกษา + Password
- กล้องหน้าสดตอนสมัคร
- ใบงานสำเร็จรูปเดิม 198 ใบ
- Subject Enrollment + Admin Approval
- Attendance / QR Attendance
- Class Leader เป็น capability ไม่ใช่ role เพิ่ม
- Exam Center
- Promotion และ Academic History
- App Icon ตามภาพที่เจ้าของโครงการเลือก

## สิ่งที่ไม่ยกมาทับระบบเดิม
- ไม่เปลี่ยน repository architecture ไปเป็น React/Vite monorepo
- ไม่ seed ใบงานตัวอย่าง 12 ใบทับ 198 ใบเดิม
- ไม่ลบข้อมูล Production
- ไม่เพิ่ม role ที่ขัดกับโครงสร้างสิทธิ์ปัจจุบัน
- ไม่ใช้ Fullscreen หรือปิด Copy/Paste เป็น security boundary

หลักการคือ “เลือกส่วนที่ทำให้ระบบเสถียร ปลอดภัย ใช้ง่าย และดูแลต่อได้” โดยไม่ทำลายโครงสร้างที่ใช้งานจริงอยู่แล้ว
