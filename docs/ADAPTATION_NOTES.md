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


## V15.1 ห้องเรียนรายวิชา
- ไม่สร้างตารางห้องเรียนรายวิชาซ้ำกับ `subjects`
- ใช้ `subjects` เป็น Single Source of Truth ของ “ห้องเรียนรายวิชา”
- ชื่อห้อง = รหัสวิชา + ชื่อวิชา จึงไม่เกิดชื่อห้องกับชื่อวิชาไม่ตรงกัน
- สมาชิกห้อง = `subject_enrollments.status = approved`
- ใบงานสำเร็จรูป = `worksheets.subject_id` + `settings.template_ready=true`
- สไลด์/สื่อ = `subject_files.subject_id`
- ข้อสอบ = `exams.subject_id`
- Admin เปิดห้องเดียวแล้วจัดนักศึกษา ใบงาน สื่อ การปล่อยงาน และระบบสอบได้จากบริบทวิชาเดียว
- ระบบสอบเดิม V15 ยังใช้งานได้ และเพิ่ม Subject Context ผ่าน `exam.html?subject=<subject_id>` เพื่อรองรับการนำโมเดลระบบสอบเก่ามาปรับใช้ภายหลัง
