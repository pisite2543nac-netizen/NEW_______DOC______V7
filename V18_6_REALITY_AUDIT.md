# V18.6 REALITY AUDIT — DOC-FULL-NR

วันที่ตรวจ: 16 กันยายน 2569

## สิ่งที่ยืนยันจาก Production Backend
- Supabase Project `thjscmfqunlaqxlievna` สถานะ ACTIVE_HEALTHY
- รายวิชา active 11 วิชา
- Worksheet template พร้อมใช้ 374 รายการ: Digital 187 + Paper 187
- Critical V18 RPC มีจริง: Course CODE, Grade, Exam Start/Submit, Paper Multi-page Scan, Gradebook, System Health, Capacity
- Edge Function `admin-operations` ปิด legacy `initialize_system` และ `grade_submission` แล้ว (410)
- `register-user-camera` ใช้กล้อง JPEG, rate limit ฝั่ง server และ approval flow

## สิ่งที่ยังไม่ควรอ้างว่าใช้งานจริง 100%
1. Browser E2E ใน Source ต้องใช้ environment/บัญชีทดสอบจริง จึงยังไม่ได้ยืนยันทุก User/Admin flow ในการ audit แบบ local
2. `exam_question_bank` ใน Production ณ เวลาตรวจมี 0 ข้อ แม้ Source มี bank 550 ข้อ และ Exam UI มี auto-import; ต้องเปิด Exam Center ด้วย Admin และตรวจ import สำเร็จจริงก่อนใช้สอบ
3. PWA ยังพึ่ง CDN สำหรับ Supabase JS/QRCode/JsBarcode/jsQR ดังนั้น cold-start offline แบบไม่มี network ยังไม่ self-contained 100%
4. Production ยังไม่มี `paper_scan_packets` ที่ใช้งานจริง ณ เวลาตรวจ จึงยืนยันได้ว่า backend/UI contract มี แต่ยังไม่มีหลักฐานจากงานสแกนจริงในฐานข้อมูล
5. React/Vite development tree ไม่ใช่ runtime เจ้าของ GitHub Pages; runtime จริงคือ `/site`. การติดตั้ง npm ไม่ถูกใช้เป็นเกณฑ์ว่าระบบ production พร้อมหรือไม่

## เพิ่มใน V18.6
- เมนู Admin: `ตารางเช็กรวม`
- แยกกลุ่มตามข้อมูลลงทะเบียน: ระดับ / ห้อง / แผนก / สาขา
- เลือกปีการศึกษา / ภาคเรียน / รายวิชา
- 17 Logical Work Pairs ต่อวิชา; Digital + Paper หน่วยเดียวกันนับ 1 ช่อง
- หัวคอลัมน์แสดงชื่อใบงาน เช่น `ใบงานการเขียนโปรแกรมภาษาคอมพิวเตอร์ หน่วยที่ 1` พร้อมหัวข้อหน่วย
- สถานะ ✓ / ช / ร / / / ✕ / — และคลิกดูรายละเอียดได้
- Export Excel-compatible `.xls` และ Print A4 Landscape
- Responsive horizontal table scrolling โดยไม่ intercept mouse-wheel ของหน้า Desktop

## Security Advisor ที่ยังต้อง Harden ต่อ
- Supabase Security Advisor แจ้งว่า Leaked Password Protection ยังปิดอยู่
- `private.enforce_exam_safe_payload_v18` ยังไม่มี fixed `search_path` ตาม advisor
- Advisor แจ้ง SECURITY DEFINER execute grants หลายรายการ; Admin RPC หลายตัวมี guard `private.is_admin()` อยู่ภายใน แต่สิทธิ์ EXECUTE ควรถูกทบทวน/ลดให้เหลือเท่าที่จำเป็น
- Trigger functions `enforce_work_pair_single_completion()` และ `sync_submission_status_from_grade()` ถูก grant execute ให้ anon/authenticated ตาม advisor แม้เป็น trigger function; ควร revoke direct execute ในรอบ hardening backend ถัดไป

รายการ Security Advisor เหล่านี้ไม่ใช่หลักฐานว่า flow ปัจจุบันถูกเจาะได้ แต่เป็นงาน production hardening ที่ยังไม่ควรปิดเป็น Done จนกว่าจะตรวจ ACL/function guard ทีละตัว
