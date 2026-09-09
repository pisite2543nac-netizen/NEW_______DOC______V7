# V7 BUILD FIX 01

แก้ GitHub Actions build errors ที่พบจริงจาก run #1:
- TS2305 lucide-react ไม่มี `Install` -> ใช้ `Download`
- React useEffect ห้ามคืน Promise -> ใช้ callback ที่คืน void
- SubmissionPage ปัญหา worksheet อาจเป็น null
- TS5096 tsconfig.node.json -> เพิ่ม `noEmit: true`

## วิธีเร็วสุดบน GitHub Web
1. แตกไฟล์ `V7_BUILD_FIX_ONLY.zip`
2. ที่ root ของ repo: Code > Add file > Upload files
3. อัปโหลด `src` และ `tsconfig.node.json` โดยคง path เดิม
4. Commit changes
5. Actions จะรัน `Deploy DOC-FULL-NR Universal` ใหม่อัตโนมัติ
6. ต้องให้ build และ deploy เป็นสีเขียว

หากต้องการเริ่มใหม่ทั้งหมด ให้ใช้ `DOC_FULL_NR_V7_PRODUCTION_BUILD_FIXED.zip`
