DOC-FULL-NR V17.9 FULL SYSTEM HARDENED

นี่คือชุดเต็มสำหรับระบบ Nangrong Smart Worksheet System

แกนหลัก:
CODE เข้าเรียน -> สมาชิกห้อง -> รับงาน -> Digital/Paper -> ส่งงาน -> Admin ตรวจ -> คะแนนจริง -> Gradebook
รวม Attendance / Exam / Notification / Report / Promotion / PWA / Fullscreen

ข้อมูลมาตรฐาน:
11 วิชา
17 หน่วย/วิชา
20 สไลด์/หน่วย
187 Digital + 187 Paper = 374 Templates
187 Logical Work Pairs

Hardening V17.9:
- Critical Action ใช้ Transaction Lock
- ป้องกันคำสั่งซ้ำจากเน็ตช้า/กดซ้ำด้วย Request Key
- Digital หมดเวลาฝั่ง Server จริง
- Digital/Paper คู่เดียวกันสำเร็จได้เพียงช่องทางเดียว
- Paper ต้อง Admin Scan หลักฐานทั้งแผ่น
- Gradebook ใช้คะแนนที่ครูตรวจจริง
- งานย้อนหลังเครดิตสูงสุด 50%
- Attendance Scan Idempotent
- Exam Start/Submit Hardened
- Assignment Reconcile ทุก 5 นาที
- Integrity Monitor ตรวจข้อมูลสัมพันธ์กันทั้งระบบ
- แจ้งเตือน User และ Admin

Backend V17.9 ถูกติดตั้ง Production แล้ว
ไฟล์ Deploy ใน READY PACKAGE ใช้สำหรับอัปเดต Frontend/Repository ให้ตรงกับ Backend
ไม่ต้องกรอก GitHub Token ใหม่ และไม่ต้องกรอก Supabase service_role
