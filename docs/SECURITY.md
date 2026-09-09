# Security Model

- Authentication: Supabase Auth
- Authorization: Row Level Security (RLS) + database RPC + Edge Functions
- Roles: `admin`, `user`
- `worksheet_answer_keys`: Admin only
- `submission_grades`: Admin only; ผู้เรียนไม่สามารถอ่านคะแนน/เกรด/admin_comment ผ่าน API โดยตรง
- `submission_overrides`: Admin only
- `audit_logs`: Admin only
- Storage bucket สำหรับงานเป็น private และควบคุมด้วย policies
- การส่งงาน Digital ใช้ `save_worksheet_draft` และ `finalize_digital_submission` ฝั่ง PostgreSQL
- กำหนดส่งและ attempt ตรวจ server-side ไม่เชื่อเวลาเครื่องผู้ใช้
- Edge Functions เปิด JWT verification
- ไม่มี service-role key, password หรือ private key ใน repository
