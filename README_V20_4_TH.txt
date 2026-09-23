DOC-FULL-NR V20.4 — REAL-DEVICE MOBILE ROUTER / ADAPTIVE UX / CAMERA FLOW

รุ่นนี้แก้จากอาการในวิดีโอทดสอบโทรศัพท์จริง โดยพบต้นเหตุว่า Admin กดเข้า Attendance แล้ว route `attendance` ไม่อยู่ในรายการ route ที่ Admin อนุญาต จึงถูกระบบเปลี่ยนกลับเป็น dashboard ก่อนถึงหน้ากล้อง

สิ่งที่แก้ใน V20.4
- Admin Attendance เป็น route ที่อนุญาตจริง และกดจากโทรศัพท์เข้าหน้าสแกนได้โดยตรง
- Bottom Navigation โทรศัพท์เรียก router โดยตรง ไม่จำลองการคลิกเมนู Desktop ที่ซ่อนอยู่
- ยกเลิกผล render เก่าที่มาช้ากว่า route ใหม่ ป้องกันหน้าสลับกลับไปกลับมา
- เปลี่ยน route แล้วหยุด MediaStream/Scanner เดิมทันที ป้องกันกล้องค้าง/แย่งกล้อง
- Attendance ต้องเลือกห้องและวิชาก่อนจึงขอเปิดกล้อง
- Paper Scan ป้องกัน async render เก่าทับหน้าปัจจุบัน
- Phone UI เน้น 2 งานหลัก: เช็คชื่อด้วย QR และเก็บสำเนาใบงานย้อนหลัง
- Tablet/iPad ใช้งานแบบ Touch-first และทำ Digital Worksheet ได้เต็มระบบ
- Desktop/Notebook คง Sidebar และ Workflow เต็ม
- Phone Digital Worksheet ดูได้ แต่ไม่พิมพ์/บันทึกร่าง/ส่ง
- ธีมเขียว-ขาว / Dark Mode / Exam / Gradebook / Print / Teaching / PWA / Special Activities เดิมยังอยู่ครบ

การติดตั้ง
1. แตก ZIP ทั้งหมด
2. ดับเบิลคลิก 00_INSTALL_UPDATE_SYSTEM.cmd
3. Installer จะ Preflight -> Backup Branch -> Push Main -> รอ GitHub Actions -> ตรวจ RELEASE_BUILD.txt และ index marker บน Live
4. Installer จะรายงาน SUCCESS ต่อเมื่อ Actions และ Live marker เป็น V20.4 จริง

หลังติดตั้ง แนะนำทดสอบโทรศัพท์จริงตามลำดับ:
หน้าแรก -> เช็คชื่อ -> เลือกห้อง/วิชา -> เปิดกล้อง -> สแกน QR
จากนั้น หน้าแรก -> เก็บงาน -> เลือกวิชา -> สแกน Barcode/QR -> ถ่ายเอกสาร -> Preview -> บันทึก

หมายเหตุ: Environment ที่สร้าง Release ไม่สามารถเปิดกล้อง iPhone/Android จริง จึงมี Browser regression และ camera lifecycle simulation ครบ แต่ควร smoke test เครื่องจริงหลัง deploy ก่อนใช้งานกับนักศึกษาจำนวนมาก
