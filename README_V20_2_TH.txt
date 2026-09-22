DOC-FULL-NR V20.2 — Adaptive Mobile Camera • Stability

สิ่งที่เพิ่ม/แก้ใน V20.2
- คงระบบ V20.1 และ Feature เดิมทั้งหมด
- UX/UI ปรับตาม Phone / Tablet / Desktop โดยคงธีมเขียว-ขาวเดิม
- โทรศัพท์เน้นการเช็คชื่อ QR และการเก็บสำเนาใบงานย้อนหลังด้วยกล้อง
- Digital Worksheet บนโทรศัพท์เป็น Read-only: ดูได้ แต่ไม่เปิดให้พิมพ์ บันทึกร่าง หรือส่ง
- Tablet / iPad / Computer ยังคงทำ Digital Worksheet ได้เต็มรูปแบบ
- Camera runtime กลาง เลือกกล้องหลังและลด constraints อัตโนมัติเมื่ออุปกรณ์ไม่รองรับ
- Attendance scanner มี fallback ถ่ายภาพ QR จากกล้องระบบ + Token manual
- Paper evidence scanner มี fallback ถ่ายภาพ Barcode/QR และถ่ายหน้าเอกสารจากกล้องระบบ
- แปลงหลักฐานภาพเป็น JPEG มาตรฐานก่อน upload และมี Preview ก่อนบันทึก
- หยุด MediaStream เมื่อเปลี่ยนหน้า ซ่อนแอป หรือออกจากหน้า เพื่อเปิดกล้องซ้ำได้เสถียร
- Fullscreen บนโทรศัพท์ไม่แย่ง user gesture ที่ใช้ขอ Camera permission
- V20.1 content-focused slides, Exam, Gradebook, Attendance, Print V19.6, PWA และ Special Activities คงอยู่ครบ

Backend
- ไม่มี Database migration ใหม่ใน V20.2
- ใช้ Production RPC เดิมแบบ server-authoritative สำหรับ attendance และ paper scan
