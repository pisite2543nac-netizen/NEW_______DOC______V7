# DOC-FULL-NR Universal V7

ระบบ Smart Worksheet สำหรับวิทยาลัยเทคนิคนางรอง ใช้โค้ดชุดเดียวบน PC / Android / iPhone / iPad / Tablet และติดตั้งเป็น PWA ได้

## Stack
React 18 + TypeScript + Vite + Supabase Auth/PostgreSQL/Storage/Edge Functions + GitHub Pages + PWA

## Production backend
เชื่อมกับ Supabase project `DOC-FULL-NR-UNIVERSAL` (`thjscmfqunlaqxlievna`) ที่ provision แล้ว

## โมดูล
- Login / Signup / Forgot password
- Admin/User role
- Users
- Classrooms
- 13 Subjects
- Digital & Paper worksheets
- Answer keys / Rubric (Admin-only)
- Draft / Submit server-side RPC
- Grading
- Reports CSV
- QR / Print / Save PDF
- Audit log
- Profile
- PWA installation
- Responsive UI

## เปิดใช้งาน
อ่าน `docs/DEPLOY_GUIDE_TH.md`

## Local
`npm install` แล้ว `npm run dev`

## Build
`npm run build`
