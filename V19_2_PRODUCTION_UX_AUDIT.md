# DOC-FULL-NR V19.2 Production UX/UI Audit

วันที่ตรวจ: 17 กันยายน 2569

## ขอบเขต
V19.2 ปรับชั้น Presentation/UX ของระบบ V19.1.3 โดย **ไม่เปลี่ยน Business Logic, Supabase schema, RPC, สิทธิ์, งาน Digital/Paper, ระบบสอบ, Gradebook, Attendance Gate หรือระบบหัวหน้าห้อง**

## สิ่งที่เพิ่ม/ปรับ
- Design tokens กลางโทนเขียว-ขาว และ Night Mode ที่ใช้ร่วมกันทั้งระบบ
- ปรับ Sidebar/Topbar/Card/Button/Input/Table/Modal/Toast ให้เป็นภาษาออกแบบเดียวกัน
- Adaptive density สำหรับ Notebook ที่ความสูงจอน้อย ลดช่องว่างแนวตั้งโดยอัตโนมัติ
- Tablet: Sidebar เป็น Drawer พร้อม Backdrop และกด Escape เพื่อปิดได้
- Mobile: เพิ่ม Bottom Quick Navigation สำหรับเมนูที่ใช้บ่อย และปุ่ม “เมนู” สำหรับเปิด Sidebar เต็ม
- รองรับ safe-area ของ iPhone/iPad/PWA
- Touch target สำหรับอุปกรณ์สัมผัสอย่างน้อยประมาณ 44–46px
- ตารางกว้างเลื่อนภายในพื้นที่ตาราง ไม่ดันหน้าเว็บออกนอก viewport
- ตารางสามารถ Focus ด้วย Keyboard และมี aria-label อธิบายการเลื่อน
- รองรับ prefers-reduced-motion และ prefers-contrast
- หน้า Room Work Checklist ถูกลดพื้นที่ว่างและทำให้เห็น Filter/Summary/Table เร็วขึ้น

## Viewport ที่ทดสอบด้วย Chromium Browser Contract
- 2560×1440
- 1920×1080
- 1440×900
- 1366×768
- 1280×800
- 1024×1366
- 834×1194
- 820×1180
- 768×1024
- 430×932
- 412×915
- 390×844
- 360×800
- 844×390 (มือถือแนวนอน)

ผล: ไม่มี Body Horizontal Overflow, Content อยู่ใน viewport, ตารางเลื่อนภายในกรอบ, Tablet/Phone ใช้ Drawer ได้ และ Phone มี Bottom Navigation

## Regression
Legacy Contracts V17 → V19.1 ผ่านทั้งหมด รวม Browser flows ของ Dashboard, Course CODE, Profile/Paper Scan, Room Checklist, Exam Admin และ Exam Student

## หมายเหตุ Production
V19.2 เป็น Frontend/UX stabilization เท่านั้น จึงไม่แตะข้อมูล Production Supabase หรือ Migration เดิมในแพ็กเกจนี้
