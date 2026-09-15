# การติดตั้ง Nangrong Smart Worksheet System (PWA) และโหมดเต็มหน้าจอ

## Android โทรศัพท์ / แท็บเล็ต
1. เปิด URL ระบบด้วย Chrome หรือ Edge
2. กด **ติดตั้งแอป** ในระบบ หรือเมนู Browser > **Install app / เพิ่มไปยังหน้าจอหลัก**
3. ยืนยันการติดตั้ง
4. เปิดจากไอคอน **Nangrong Worksheet** ที่หน้าจอหลัก
5. ระบบจะเปิดด้วย PWA `display: fullscreen` เมื่ออุปกรณ์รองรับ หากเครื่องเปิดแบบ Standalone ให้แตะหนึ่งครั้งเพื่ออนุญาต Fullscreen API หรือกด **⛶ เต็มจอ**

## iPhone / iPad
1. เปิดด้วย Safari
2. กด **Share**
3. เลือก **Add to Home Screen / เพิ่มไปยังหน้าจอโฮม**
4. ยืนยันชื่อ Nangrong Worksheet
5. เปิดจากไอคอนที่หน้าจอโฮม ไม่เปิดจากแท็บ Safari
6. iOS จะใช้โหมด Web App ที่ซ่อนแถบ Safari; Fullscreen API บางรุ่นมีข้อจำกัดของระบบปฏิบัติการ

## Windows
1. เปิดด้วย Microsoft Edge หรือ Google Chrome
2. กด **ติดตั้งแอป** หรือไอคอน Install ที่ Address bar
3. ยืนยัน และเลือก Pin to Start / Taskbar / Desktop ได้ตามต้องการ
4. เปิดจากไอคอนแอปเพื่อใช้หน้าต่าง PWA
5. Manifest ขอ `fullscreen`; หาก Browser/Windows ใช้ Standalone ให้คลิกหนึ่งครั้งหรือกด **⛶ เต็มจอ**

## macOS
1. Chrome/Edge: Install app; Safari รุ่นที่รองรับ: Add to Dock
2. เปิดจาก Applications / Dock
3. ใช้ปุ่ม **⛶ เต็มจอ** เป็น fallback หากระบบปฏิบัติการไม่อนุญาต manifest fullscreen

## การป้องกันการคัดลอก
ระบบบล็อก Selection, Copy, Cut, Context menu และ Drag บนเนื้อหาทั่วไป แต่อนุญาตในช่องกรอกข้อมูล และอนุญาต Admin คัดลอก CODE รายวิชาโดยปุ่มที่กำหนด

> หมายเหตุ: เว็บไม่สามารถป้องกันการถ่ายภาพหน้าจอหรือ Developer Tools ได้ 100% การป้องกันนี้เป็นมาตรการลดการคัดลอกโดยทั่วไป ส่วนข้อมูลสำคัญ เช่น Answer Key/คะแนน/ไฟล์หน่วยอนาคต ยังป้องกันจริงด้วย RLS และ Server-side authorization

## Paper Worksheet
Admin เข้า **การสอนและรายวิชา > เปิดห้อง > หน่วยเรียน**
- Paper: **พิมพ์ + Barcode**
- ระบบสร้างเอกสารรายบุคคลและ Token
- ตอนรับงาน: Scan Barcode > ถ่าย **ทั้งแผ่น** > ตรวจ Preview > ยืนยันบันทึกสำเนา
- ภาพถูกเก็บใน Private Storage และ Metadata มี `full_sheet=true`
