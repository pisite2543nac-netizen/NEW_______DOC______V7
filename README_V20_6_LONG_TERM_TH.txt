DOC-FULL-NR V20.6 LONG-TERM STABLE UI

เป้าหมาย: ใช้งานจริงระยะยาว โดยให้ความสำคัญกับความเสถียรและความง่ายในการใช้งานมากกว่าการคงธีมสีเดิม

สิ่งที่รวมในชุดนี้
- UI final layer ใหม่ โหลดท้ายสุด: Desktop / Tablet / Phone
- Sidebar เดสก์ท็อปอ่านง่าย, Touch target มือถือ/แท็บเล็ต, Safe-area, Modal/Table overflow
- ลด visual clutter และใช้ hierarchy เดียวกันทุกหน้า
- Teacher workspace ใช้ staff_*_v206 RPC แบบจำกัดวิชา/ห้อง
- ตรวจงาน/Gradebook/Attendance/Exam/Print ตาม Teacher scope
- Admin Room Group ใช้ V20.6 dynamic binding, Classroom sync, seat number และ auto numbering
- Late attendance แสดง QR + Code128 และ revoke/rotate ได้
- Camera/route/backdrop lifecycle เดิมยังคง guard และ regression test
- ไม่ลบ Submission / Grade / Attendance / Exam Attempt / Audit / History

หมายเหตุ Backend
Production thjscmfqunlaqxlievna ได้รับ migration V20.6/V20.6.1 และชุด teacher-grade/exam, stability-security, teacher-submission-lifecycle, canonical-template cleanup และ room-group filters แล้ว ตัว Source/UI ในแพ็กนี้ reconcile กับ RPC จริงเหล่านั้น

การยืนยัน
- Static contracts เดิมทั้งหมดผ่าน
- Chromium core + real-use + V20.2/V20.3/V20.4/V20.5/V20.6 browser contracts ผ่าน
- Physical iPhone/Android/iPad hardware camera permission UI ต้องตรวจบนอุปกรณ์จริงก่อน rollout ขนาดใหญ่
