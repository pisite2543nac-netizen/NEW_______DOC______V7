DOC-FULL-NR V20.6 — STABILITY FIRST / ADAPTIVE UI / BACKEND COMPATIBILITY
วันที่ 24 กันยายน 2569

เป้าหมาย Release นี้
- ทำ UI/Runtime ให้เสถียรขึ้นบน Desktop, Tablet และ Phone
- ไม่ลบฟังก์ชันเดิม และไม่เปลี่ยน Architecture หลัก
- คง V20.3–V20.5 camera/router/mobile contracts
- ใช้ Production Backend ที่มี V20.6/V20.6.1 อยู่แล้ว โดยไม่ลง migration ซ้ำใน release stability นี้

สิ่งที่เพิ่ม
1. site/v20-stability-runtime.js
   - authority สุดท้ายสำหรับ visual viewport/orientation/device class
   - stale backdrop pointer guard
   - route/page lifecycle cleanup
2. site/v20-stability.css
   - safe-area / modal height / internal table scroll
   - min-width:0 guards ลด horizontal overflow
   - touch target สำหรับ Phone/Tablet
   - landscape phone hardening
3. tests/v206_adaptive_stability_*.py
   - Static contract
   - Chromium contract 6 viewport/orientation

ข้อจำกัดที่รายงานตรง ๆ
- กล้องจริงบน Android/iPhone/iPad ยังไม่ได้ทดสอบกับอุปกรณ์จริงใน environment นี้
- npm/Vite React build ไม่ได้ยืนยัน เพราะ package ไม่ได้พก node_modules/lockfile และ npm dependency install timeout; Production deployment เป็น Static PWA จาก /site
- Supabase Security Advisor ยังมี warnings; ไม่ revoke RPC แบบเหมารวมเพื่อไม่ทำ RPC-only architecture พัง
