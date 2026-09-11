# DOC-FULL-NR V16.1 — Attendance & Menu UX

## Menu UX
- Dashboard ของ Admin และ User ใช้ Menu Card รูปแบบเดียวกัน: ไอคอนใหญ่ + ชื่อ + คำอธิบาย
- Admin รวมเมนูหลัก: อนุมัติบัญชี, ห้องเรียนรายวิชา, อนุมัติวิชา, เช็คชื่อ, Presence, โปรไฟล์นักศึกษา, Promotion, Exam, ผู้ใช้งาน, ตรวจงาน, Overrides, Reports, Audit, System
- User รวมเมนูหลัก: ห้องเรียนของฉัน, ลงทะเบียนรายวิชา, สถานะงาน, Attendance, Exam, โปรไฟล์ของฉัน

## Student Profile
- โปรไฟล์ฝั่ง User เป็น Read-only
- DB RLS ป้องกัน User UPDATE ตาราง profiles โดยตรง
- User ยังเปลี่ยน Password ของบัญชีได้
- การแก้ชื่อ/รหัส/ชั้น/ห้อง/แผนก/สาขา ทำโดย Admin เท่านั้น

## Attendance 15 นาที
1. หัวหน้าห้องหรือ Admin เลือกห้อง + วิชา
2. QR ของนักศึกษาคนแรกเริ่ม Attendance Session
3. Server กำหนด auto_close_at = started_at + 15 นาที
4. ภายใน 15 นาที การสแกน = present
5. หัวหน้าห้องกด “สรุปยอดและส่ง Admin” ได้ทุกเวลา
6. ถ้าไม่กด ระบบ pg_cron ตรวจทุก 1 นาทีและสรุปอัตโนมัติเมื่อครบ 15 นาที
7. คนที่ยังไม่เช็คชื่อเมื่อสรุป = absent
8. หลัง Session ปิด หัวหน้าห้องสแกนเพิ่มไม่ได้
9. Admin สามารถสแกนคนที่มาทีหลังเข้า Session เดิม และระบบบันทึก = late
10. Admin สามารถกำหนด leave/excused ได้โดยตรงใน Roster

## Scan Result
ทุกครั้งที่สแกนสำเร็จ Server คืน:
- ชื่อ-นามสกุล
- ชั้น/กลุ่ม
- รหัสนักศึกษา
- สถานะ present/late/excused
- วันและเวลา Server
- Session ID
- Auto close deadline

## Realtime Notifications
ตาราง `app_notifications` เป็น Private RLS + Realtime
- นักศึกษาที่ถูกสแกนได้รับ “เช็คชื่อแล้ววันนี้”
- ผู้สแกนได้รับ “เช็คชื่อสำเร็จ”
- เมื่อ Session สรุป Admin ทุกคนได้รับผลรวม
- หัวหน้าห้องที่กดสรุปได้รับยืนยันว่า “ส่งสรุปให้ Admin แล้ว”
- UI มี Notification Bell + unread count + panel
- หน้า Attendance ของนักศึกษาแสดงสถานะล่าสุดแบบ Real-time

## Summary
Summary เก็บ:
- expected
- present
- late
- absent
- excused
- started_at
- closed_at
- reason

ตัวอย่าง ห้อง 40 คน มา 16 คน:
- ก่อนปิด: checked 16/40
- กดสรุปทันทีได้
- หลังปิด: present 16, absent 24 (ยกเว้นมี late/excused)
- Admin แก้ absent → excused/late ภายหลังได้ และ summary จะ refresh อัตโนมัติ

## Auto-finalization
Cron job:
`docfullnr-attendance-auto-summary`
Schedule:
`* * * * *`
Command:
`select public.auto_finalize_due_attendance_sessions();`

Client countdown แสดงวินาทีแบบ Real-time แต่ Server เป็นผู้ตัดสินเวลาจริง
