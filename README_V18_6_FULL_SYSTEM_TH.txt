DOC-FULL-NR / Nangrong Smart Worksheet System
V18.6 ROOM WORK CHECKLIST + REALITY AUDIT
วันที่ 16 กันยายน 2569

นี่คือ Full Source Tree ที่ทำต่อจากโปรเจกต์ NEW_______DOC______V7 เดิม ไม่ใช่เว็บใหม่และไม่ใช่ Patch แยก

เพิ่มใน V18.6
- เมนู Admin “ตารางเช็กรวม”
- แยกนักศึกษาตามข้อมูลลงทะเบียน: ระดับ / ห้อง / แผนก / สาขา
- เลือกปีการศึกษา / ภาคเรียน / รายวิชา
- 17 คอลัมน์งานแบบ Logical Work Pair: Digital + Paper หน่วยเดียวกัน = 1 งาน
- หัวคอลัมน์ใช้ชื่อใบงาน เช่น “ใบงานการเขียนโปรแกรมภาษาคอมพิวเตอร์ หน่วยที่ 1” ไม่ใช้เลข 1–17 อย่างเดียว
- แสดงสถานะ ✓ ส่งแล้ว / ช ส่งย้อนหลัง / ร ร่าง / / รอดำเนินการ / ✕ พ้นกำหนด / — ไม่ได้มอบหมาย
- คลิกช่องงานเพื่อดูรายละเอียดนักศึกษา สถานะ กำหนดส่ง และเวลาส่ง
- Export Excel-compatible และ Print A4 แนวนอน
- Responsive สำหรับ Desktop/Tablet/Mobile และคงการเลื่อนด้วยลูกกลิ้งเมาส์บน Desktop

ผลตรวจ
- Static/contract tests: PASS
- Browser contract tests แบบ Mock Supabase: PASS รวม Admin Profile, Course CODE, PWA runtime และ V18.6 Room Checklist
- JavaScript syntax ใน site/*.js: PASS หลังแก้ legacy source ที่มี syntax error
- Production Supabase: ACTIVE_HEALTHY, 11 วิชา, 374 templates (187 Digital + 187 Paper)

ข้อควรรู้ก่อนถือว่า Production Ready 100%
- Production exam_question_bank ยัง 0 ข้อ ณ เวลาตรวจ แม้ source มี 550 ข้อและ Exam UI มี auto-import
- ยังต้องทดสอบบัญชี Admin/User จริงกับ Production Browser flow ทั้งชุดก่อนปิดงาน
- PWA ยังพึ่ง CDN บางส่วน จึงยังไม่ใช่ cold-start offline แบบ self-contained 100%
- Production ยังไม่มี paper_scan_packets จริง ณ เวลาตรวจ จึงยังไม่มีหลักฐาน live multi-page scan

ดูรายละเอียด: V18_6_REALITY_AUDIT.md
