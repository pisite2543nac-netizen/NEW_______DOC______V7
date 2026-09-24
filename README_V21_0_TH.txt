DOC-FULL-NR V21.0 MAJOR STABILITY • UNIFIED RUNTIME • PRODUCTION READY
วันที่ 24 กันยายน 2569

วัตถุประสงค์
V21.0 เป็น Major Stability Upgrade จาก Source ล่าสุด โดยแก้ปัญหา UI/Router/Responsive runtime ซ้อนกันที่ทำให้ Desktop/Tablet/Phone กดไม่ได้ โหลดซ้ำ หรือ layout แกว่ง

สถาปัตยกรรม Frontend V21
- app.js = business shell/router owner
- v21-runtime.js = presentation/viewport/drawer/mobile navigation owner เพียงตัวเดียว
- v16-platform.js = feature renderer / business workflows
- v16-7-hardening.js + v16-8-course-flow.js = business enhancers ที่ไม่แย่ง router
- v16-exam.js = Exam page owner
- Production ไม่โหลด mobile.js, v19-ux-runtime.js, v20-stability-runtime.js อีกต่อไป

Device UX
- Desktop: sidebar ถาวร พื้นที่ทำงานกว้าง ตารางเลื่อนภายใน
- Tablet: touch-first drawer/grid
- Phone: single-column, ปุ่มแตะง่าย, bottom navigation 5 ปุ่ม, menu เพิ่มเติม, CODE registry ย่อรายการอัตโนมัติ
- Loading route เป็น non-blocking และมี stale async navigation guard

Role / Functions
- Admin: คงความสามารถเดิมทั้งหมด + Teacher assignment + Room Group V20.6 integration
- Teacher: จำกัดตาม subject/classroom assignment; ตรวจงาน, คะแนน, Gradebook, Attendance/Late Barcode, Exam, Room filters, Print/Report
- Student: Course CODE -> 17 Units -> Teaching slides -> Digital/Paper -> Attendance -> Exam -> Grade/History

Backend Alignment
- มี supabase/migrations/20260924_v21_0_production_alignment.sql
- ใช้เพื่อให้ source ที่เริ่มจาก V20.5 มี contract เทียบเท่า Production V20.6+
- รักษา submission/grade/attendance/exam attempt/audit/history
- Installer ไม่รัน migration บน Production อัตโนมัติ เพื่อลดความเสี่ยงข้อมูลเสียหาย

ผลตรวจ Release
- Static contracts: 37/37 PASS
- Browser contracts: 23/23 PASS
- V21 browser matrix: Admin/Teacher/User × 9 viewport/orientation = 27 cases PASS
- site JavaScript syntax: 24/24 PASS
- Index/Exam/Service Worker asset integrity: PASS
- Production data: 11 subjects / 187 Digital / 187 Paper / 374 worksheets / 550 exam-bank questions
- Required V21 Production staff/admin RPC: 20/20 present

ข้อจำกัดที่ยังต้องยืนยันหลัง Deploy
- กล้อง/Permission UI บน iPhone, Android, iPad เครื่องจริง
- GitHub Push / Actions / Pages / Live marker ต้องเกิดหลังรัน One-Click ด้วย Git credential ของเจ้าของ repository
- Supabase Security Advisor ปัจจุบันยังมี INFO/WARN เดิมบางส่วน (RPC SECURITY DEFINER หลายตัวตรวจ authorization ภายใน function); ห้าม revoke แบบเหมาโดยไม่ทำ per-RPC review
