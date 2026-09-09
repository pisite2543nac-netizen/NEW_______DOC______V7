# วิธีนำขึ้น GitHub ใหม่แบบง่ายที่สุด

## 1) สร้าง Repository ใหม่
GitHub > New repository > ตั้งชื่อ `doc-full-nr-universal` > Public > **อย่าเลือก README/.gitignore/license** > Create repository

## 2) Push โค้ด
แตก ZIP แล้วเข้าโฟลเดอร์ `scripts` ดับเบิลคลิก `00_PUSH_NEW_GITHUB.bat` แล้ววาง URL repo ใหม่ เช่น `https://github.com/pisite2543nac-netizen/doc-full-nr-universal.git`

## 3) เปิด GitHub Pages
Repository > Settings > Pages > Source เลือก **GitHub Actions**
จากนั้น Actions > `Deploy DOC-FULL-NR Universal` รอเครื่องหมายเขียว

URL โดยทั่วไป: `https://pisite2543nac-netizen.github.io/doc-full-nr-universal/`

## 4) ตั้งค่า Admin คนแรก
เปิดเว็บ > สมัครบัญชี > ยืนยันอีเมลถ้าระบบร้องขอ > Login > โปรไฟล์ > `ตั้งบัญชีนี้เป็น Admin คนแรก`

## 5) ติดตั้งเป็นแอป
- Windows/Chrome/Edge: Install app
- Android: Chrome > Install app/Add to Home screen
- iPhone/iPad: Safari > Share > Add to Home Screen

> Supabase URL + Publishable key ใน frontend เป็น client-public key ตามการออกแบบของ Supabase. ห้ามใส่ service_role key ใน GitHub.
