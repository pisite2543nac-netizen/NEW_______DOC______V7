# DOC-FULL-NR V18.1 — Complete Learning System

ระบบถูกจัดใหม่ให้แกนการเรียนเห็นและใช้งานต่อเนื่องจริงทั้ง User และ Admin:

สมัคร/ถ่ายรูป → Admin อนุมัติ → User ใส่ CODE → ห้องเรียนรายวิชา → 17 หน่วย → สไลด์ 20 หน้า/หน่วย → ใบงาน Digital/Paper → ส่งงาน → Admin ตรวจ → คะแนนจริง → Gradebook → Attendance → Exam → Report → Profile → Promotion → Notification

## จุดแก้ V18.1 ที่เกิดจากการทดสอบใช้งานจริง

- โหลด Core UI CSS ของ Modal/Profile/Course ก่อน Minimal theme ทำให้ Admin เปิดรายละเอียดนักศึกษาได้จริง และช่อง CODE รับการพิมพ์/โฟกัสได้
- Paper Scan เป็นเมนูหลัก Admin ไม่ซ่อนอยู่ในห้องวิชา
- Paper Scan ใช้ Packet หลักฐานหลายหน้า หน้า 1..N และไม่ยืนยัน Submission จนสแกนครบทุกหน้า
- Digital final submission ใช้ immutable evidence metadata + SHA-256 + idempotency + IndexedDB offline draft/outbox
- Grade revision มีเหตุผลและ append-only history ใน Backend
- Exam นำระบบสอบต้นแบบ 550 ข้อมาใช้เป็น Question Bank ของ Supabase โดยไม่ใช้ localStorage/Firebase ของระบบเดิม
- Question Bank = 11 วิชา × 50 ข้อ, difficulty = Basic 10 / Easy 15 / Hard 25
- Student Exam payload ไม่มี answer key และหน้า User ไม่แสดง score/key/rubric/admin comment
- Registration rate limiting ถูกผูกเข้ากับ Camera Registration Edge Function
- Legacy `initialize_system` และ legacy `grade_submission` ใน Admin Edge Function ถูกปิด ไม่ให้มี mutation path แข่งกับ V18 RPC
- System Health แสดง Data Integrity + Capacity

## การสอบ

Admin เปิด Exam Center ครั้งแรก หากคลัง Production ยังไม่ครบ 550 ข้อ ระบบจะอ่าน `site/data/exam-question-bank-v18.json` แล้ว import ผ่าน `admin_import_exam_bank_v18` ครั้งละ 50 ข้อแบบ upsert จนเต็ม 550 ข้อ จากนั้นสร้างชุดสอบ 50 ข้อผ่าน `admin_create_exam_from_bank_v18` โดยเก็บคำถาม safe payload ใน `exams.questions` และเก็บเฉลยใน `exam_answer_keys` ซึ่ง Admin-only

## Paper late-work

ใบงานย้อนหลังต้องพิมพ์รายบุคคลพร้อม Barcode หลัง Digital deadline เท่านั้น Admin เลือกเมนู “สแกนงานย้อนหลัง” → เลือกวิชา → อ่าน Barcode → ถ่ายหน้า 1..N ให้ครบ → ตรวจ Preview → ยืนยันรับงาน หลังจากนั้นจึงสร้าง/ยืนยัน Paper Submission และเครดิตย้อนหลังสูงสุด 50%

## ข้อจำกัดที่เป็นบริการภายนอก

OS notification ในรุ่นนี้ยังเป็น PWA/Reatime notification + replay เมื่อ session กลับมา ไม่ใช่ Remote Web Push ขณะระบบปฏิบัติการ kill แอปทั้งหมด เพราะ Remote Push ต้องมี VAPID/Push provider secret แยกจาก Source Package

การทดสอบ load 300 คนแบบพร้อมกันควรทำบน staging/disposable database ไม่ทำกับ Production จริง เพื่อไม่ปนข้อมูลนักศึกษาและคะแนนจริง
