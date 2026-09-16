DOC-FULL-NR V19.1 COMPLETE STABILIZED CLASSROOM FLOW
====================================================
วันที่จัดทำ: 16 กันยายน 2569

เป้าหมายของรุ่นนี้
-----------------
ทำให้ระบบที่พัฒนาต่อเนื่องมาทั้งหมดกลับมาอยู่ในชุดเดียวที่เสถียร โดยคง Backend, Supabase, ข้อมูล Production และ Flow เดิม ไม่สร้างระบบใหม่ซ้ำ และเพิ่มการทดสอบป้องกัน Regression ก่อน Deploy

ระบบที่รวมและตรวจแล้ว
---------------------
1) Admin / User / การอนุมัติบัญชี / กล้องลงทะเบียน / ห้องเรียน / CODE เข้าวิชา
2) 11 วิชา x 17 หน่วย = 187 หน่วย
3) Digital 187 + Paper 187 = 374 Templates / Logical Work Pair
4) สไลด์ Built-in 20 หน้า/หน่วย + สื่อของครู
5) ตารางเช็กรวมการเก็บงานรายห้อง + Excel + พิมพ์ A4 แนวนอน
6) ระบบสอบ 550 ข้อ + Admin Exam Center + Autosave/Resume/Fullscreen/Audit
7) Gradebook / ตรวจงาน / รายงาน / Promotion / Academic History
8) Attendance / QR / หัวหน้าห้อง / Presence
9) Multi-page Paper Scan + Barcode + Paper ย้อนหลัง
10) PWA / Responsive / Mouse / Touch / Mobile / Tablet / Desktop
11) ธีมเขียว-ขาว + Night Mode

คำขอเพิ่มเติมที่รวมใน V19.1
----------------------------
- Admin กำหนดหรือยกเลิกหัวหน้าห้องได้จากหน้ารายชื่อนักศึกษา
- ปวช. แสดง ทส./ทธ./คธ. และ ปวส. แสดง ส.ทส./ส.ทธ./ส.คท.
- มี Compatibility Mapping เพื่อให้ Backend รุ่นเดิมยังทำงานได้ ขณะ UI แสดงตัวย่อระดับ ปวส. อย่างถูกต้อง
- Admin กำหนด/แก้เวลา Digital ได้จากการ์ดหน่วยโดยตรง
- กำหนดแบบวัน/เดือน/ปี + เวลา หรือกำหนดเป็นจำนวนชั่วโมง
- Preset 1,2,3,6,12,24,48,72,168 ชั่วโมง และกรอกเอง 0.25-720 ชั่วโมง
- Admin เปลี่ยนเวลาได้แม้เปิดหน่วยแล้ว
- เปิด/ปิด Attendance Gate รายหน่วย
- เมื่อเปิด Gate นักศึกษาต้องมีเช็คชื่อของวันนั้นจากหัวหน้าห้องก่อนเปิด/บันทึกร่าง/ส่ง Digital
- Gate ถูกบังคับที่ Database Trigger ด้วย ไม่ใช่แค่ซ่อนปุ่ม Frontend
- เมื่อ Digital หมดเวลาและยังไม่ส่ง จะเปลี่ยนไปใช้ปุ่มพิมพ์ Paper ย้อนหลังตาม Flow เดิม
- ปุ่ม/ไอคอนหลักบนการ์ดหน่วยใหญ่และมองเห็นง่ายขึ้น โดยไม่รื้อ Business Logic

การทดสอบ
---------
- Static/Contract เดิมตั้งแต่ V17-V18 ผ่านทั้งหมด
- V19 Classroom Flow Contract ผ่าน
- V19.1 Complete User Requests Contract ผ่าน
- JavaScript Syntax Check ผ่าน
- Browser Contract ผ่าน: Dashboard, CODE, Real Use, Core, Room Checklist, Exam Admin, Exam Student
- Production Database ตรวจพบ 11 วิชา, 187 Digital, 187 Paper, 187 Subject-Unit Pairs และ Exam Bank 550 ข้อ

One Click
---------
หลังแตก ZIP ให้ดับเบิลคลิกไฟล์ด้านนอกเพียงไฟล์เดียว:
00_INSTALL_UPDATE_SYSTEM.cmd

ตัวติดตั้งจะ Clone Production Source ล่าสุด -> สร้าง Backup Branch -> รวม Full Source -> Push แบบ Atomic -> รอ GitHub Actions Tests -> ตรวจ Production Marker และ Rollback อัตโนมัติถ้าทดสอบ/Deploy ไม่ผ่าน
