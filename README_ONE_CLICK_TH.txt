DOC-FULL-NR V18.7 — ONE CLICK PACKAGE

วิธีใช้สำหรับผู้ติดตั้ง
1) แตก ZIP ทั้งหมดก่อน
2) กลับไปที่โฟลเดอร์บนสุด
3) ดับเบิลคลิกไฟล์:
   00_คลิกไฟล์นี้ไฟล์เดียว_ติดตั้งอัปเดตระบบ.cmd
4) ไม่ต้องเปิด/รัน .bat, .js, .py หรือไฟล์อื่นใน SYSTEM_FULL_SOURCE

สิ่งที่ตัวติดตั้งทำ
- ตรวจ Full Source ในแพ็กเกจ
- ตรวจ/ติดตั้ง Git และ GitHub CLI ผ่าน winget เมื่อจำเป็น
- ใช้ GitHub Login เดิม; ไม่ขอ Token
- Clone main ล่าสุด
- สร้าง Remote Backup Branch
- รวม Full Source Tree ชุด V18.7
- Commit + Push แบบ Atomic
- รอ GitHub Actions Contract/Browser Tests
- ตรวจ Public Marker บน GitHub Pages
- ถ้าตรวจไม่ผ่านจะ git revert กลับระบบก่อนหน้าโดยอัตโนมัติ
- ไม่ลบ/รีเซ็ตข้อมูล Supabase Production

ระบบที่รวมอยู่
- User/Admin
- 11 วิชา × 17 หน่วย
- Digital 187 + Paper 187
- ตารางเช็กรวมเก็บงานรายห้อง
- Multi-page Paper Scan
- Gradebook / Attendance / Reports / Promotion
- Exam Center ที่ปรับจาก ALL_Test
- คลังข้อสอบ Source 550 ข้อ
- PWA / Mobile / Tablet / Desktop
