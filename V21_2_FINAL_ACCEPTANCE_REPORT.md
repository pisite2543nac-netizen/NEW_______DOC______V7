# DOC-FULL-NR V21.2 — Cross-Device Stable Acceptance Report

**วันที่:** 25 กันยายน 2569  
**เป้าหมาย:** ใช้ฐานข้อมูลและ business logic ชุดเดียวกัน แต่ลดความซับซ้อนตามอุปกรณ์เพื่อความเสถียรและใช้งานระยะยาว

## 1. สถาปัตยกรรมที่ยืนยัน

- `app.js` เป็นเจ้าของ Business Shell/Router เพียงตัวเดียว
- `v21-runtime.js` เป็นเจ้าของ Viewport, Drawer และ Mobile Navigation เพียงตัวเดียว
- `v16-platform.js` เป็น feature renderer และใช้ RPC/ข้อมูลเดิม
- Runtime รุ่นเก่าที่เคยแย่งควบคุม UI (`mobile.js`, `v19-ux-runtime.js`, `v20-stability-runtime.js`) ไม่ถูกโหลดใน Production shell
- Desktop / Tablet / Phone ใช้ Supabase, Auth, Session, Role และข้อมูลชุดเดียวกัน

## 2. Device Contract

### Desktop — Full Feature
คงฟังก์ชันทั้งหมดตาม Role เช่น Dashboard, รายวิชา, งาน/ตรวจงาน, Gradebook, Attendance, Exam, Print/PDF, Users/Permission, Room Group, Audit, Settings และ Promotion

### Tablet — Operational
จำกัดไม่เกิน 10 top-level hubs ต่อบทบาท เน้นงานปฏิบัติการแบบ touch-first, ตรวจงาน, เช็กชื่อ, กล้อง, สอบ, รายงาน และ Admin Lite

### Phone — Quick Action
ฟังก์ชันหลักไม่เกิน 6 ปุ่ม:

- **Admin:** เช็คชื่อ / ถ่ายใบงาน / ติดตามงาน / รายวิชา / ผู้ใช้ด่วน / แจ้งเตือน
- **Teacher:** เช็คชื่อ / ติดตามงาน / รายวิชา / โปรไฟล์ / แจ้งเตือน
- **Student:** เช็คชื่อ / งานของฉัน / รายวิชา / โปรไฟล์ / แจ้งเตือน

หน้าแรก / ย้อนกลับ / Night Mode / Logout เป็น Shell Control มาตรฐานและไม่นับรวมใน 6 ปุ่ม

## 3. Authentication ทุกอุปกรณ์

คง Register, Login, Logout, `getSession`, `onAuthStateChange`, Role Guard และ account-state flow ไว้ครบทุกอุปกรณ์ ไม่มีการสร้างระบบ Auth แยกตาม Device

Admin Lite บน Tablet/Phone จำกัดเป็น **ค้นหา / เพิ่มผู้ใช้ / เปิด-ระงับบัญชี** เท่านั้น การตั้งสิทธิ์ละเอียด ห้องเรียน หัวหน้าห้อง และงานผู้ดูแลขั้นสูงยังอยู่ Desktop

## 4. Workflow กลาง

Desktop สร้าง/ควบคุม → Tablet/Phone รับข้อมูลและบันทึกผล/ภาพ/เช็กชื่อ → Supabase กลาง → Desktop/Teacher ตรวจและสรุปผล โดยไม่สร้าง Task Database ซ้ำกับระบบใบงานเดิม

Deep link หรือ Notification ที่ชี้ไปหน้าหนักซึ่งไม่เหมาะกับ Phone/Tablet จะผ่าน Device Route Policy และถูก map ไปหน้าที่รองรับ แทนการเปิดหน้าที่กดไม่ได้หรือ layout พัง

## 5. Acceptance Results

- Static validation: **PASS**
- Non-browser static contracts: **38/38 PASS**
- JavaScript syntax: **24/24 PASS**
- Browser contract files: **25/25 PASS**
- V21.2 device matrix: **3 roles × 8 viewport/orientation cases PASS**
- Login/Register responsive browser matrix: **8 viewport/orientation cases PASS**
- V21.1 Mobile Essentials compatibility: **PASS**
- Camera/router/attendance/room-group/teacher/grade/print/exam regression: **PASS**

## 6. Production Backend Verification

Read-only verification ณ วันที่ release:

- Active subjects: **11**
- Digital worksheets: **187**
- Paper worksheets: **187**
- Canonical worksheets: **374**
- Exam question bank: **550**
- Required staff/admin RPCs: **20/20 present**

## 7. สิ่งที่ไม่อ้างว่า PASS 100%

Physical camera/permission บน iPhone, Android และ iPad ต้อง smoke-test หลัง deploy บนอุปกรณ์จริง เนื่องจาก Chromium ไม่สามารถจำลอง hardware permission behavior ได้ครบทุกกรณี และ build นี้ยังไม่ได้ถูก push จาก environment นี้ไป GitHub Pages; One-Click Installer จะทำ backup → push → Actions → live marker verification ด้วย Git credentials ของเจ้าของ repo

Security Advisor ของ Production ยังมีรายการที่ต้อง review เป็นรายกรณี ได้แก่ RLS-without-policy (INFO), authenticated `SECURITY DEFINER` RPC warnings และ leaked-password-protection setting จึงไม่มีการ revoke/fix แบบเหมาเพื่อหลีกเลี่ยงการทำ API เดิมเสีย

## 8. Release Decision

**Local Release Gate: PASS** สำหรับ Source/Installer/Browser regression และ cross-device architecture ตามขอบเขตที่ทดสอบได้ใน environment นี้
