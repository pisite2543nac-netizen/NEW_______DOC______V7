DOC-FULL-NR V20.3 — Device Adaptive UX • Mobile Interaction & Camera Stability

เป้าหมาย Release นี้
- แก้โทรศัพท์ที่แตะปุ่ม/เมนูแล้วไม่ทำงานจาก backdrop/overlay ซ้อนกัน
- แก้กล้องเปิด-ปิด/สลับหน้าวนจาก camera lifecycle race และ visibility transition
- ทำ UX/UI แยกตามอุปกรณ์โดยยังใช้ธีมเขียว-ขาวเดียวกัน
- รักษา Feature, Backend contract และข้อมูลเดิมทั้งหมด

PHONE UX
- Dashboard แบบ Camera-first
- เมนูหลักด้านล่าง: หน้าแรก / เช็คชื่อ / สแกนงานย้อนหลัง / นักศึกษา (Admin) / เมนู
- ปุ่มแตะอย่างน้อย 48px, single-column, safe-area, portrait/landscape
- Digital Worksheet ดูได้แต่ไม่กรอก/บันทึกร่าง/ส่ง
- งานหลัก: QR Attendance + Barcode/QR/Paper Evidence Camera

TABLET / iPad UX
- Touch-first layout 2 คอลัมน์เมื่อพื้นที่พอ
- Digital Worksheet กรอก/บันทึกร่าง/ส่งได้เต็มรูปแบบ
- ใช้กล้องเช็คชื่อและเก็บหลักฐานได้
- Drawer ใช้ backdrop เดียว ไม่ซ้อนกับ mobile navigation

DESKTOP UX
- Sidebar และข้อมูลแบบ Compact/Professional
- Full Digital Worksheet, Exam, Gradebook, Print, Admin tools
- Explicit Fullscreen/Presentation คงอยู่

MOBILE INTERACTION FIX
- เหลือ drawer/backdrop owner เพียงชุดเดียว
- sidebar อยู่เหนือ backdrop; backdrop ปิดแล้ว pointer-events:none
- bottom nav อยู่ใต้ backdrop ขณะเปิด drawer
- Fullscreen ไม่กิน touch gesture ของ Phone/Tablet
- route transition ปิดกล้องและ drawer แบบ deterministic

CAMERA FIX
- One camera owner ต่อ feature และกัน double-start ระหว่าง getUserMedia pending
- กล้องหลัง preferred พร้อม constraint fallback
- permission prompt visibility guard ป้องกันการ stop stream ขณะกำลังขอสิทธิ์
- video play/metadata timeout guard ป้องกันหน้าแขวน
- Native picker handoff: หยุด live stream ก่อนเปิดกล้องระบบ/เลือกภาพ
- Attendance: Live QR -> ถ่ายภาพ QR สำรอง -> Token manual
- Paper evidence: Live Barcode/QR -> ถ่ายภาพรหัสสำรอง -> ถ่ายหน้าเอกสาร -> Preview -> JPEG -> Private Storage
- stop stream เมื่อ route change/pagehide และแจ้ง lifecycle event ให้ UI clear state

Backend
- ไม่มี Database migration ใหม่ใน V20.3
- Attendance/Paper Scan ยังใช้ Production RPC เดิมแบบ server-authoritative
- Smoke test ใช้ BEGIN/ROLLBACK ไม่มีข้อมูลทดสอบค้าง
