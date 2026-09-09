# Supabase Production Backend

Project: `DOC-FULL-NR-UNIVERSAL`
Project ref: `thjscmfqunlaqxlievna`
Region: `ap-southeast-1` (Singapore)

Backend ถูก provision จริงแล้ว ณ 9 ก.ย. 2569 และ frontend ชุดนี้ชี้ไป project นี้โดยตรง.

Migrations ที่มีใน production:
1. `init_doc_full_nr_universal`
2. `harden_rls_storage_deadlines`
3. `security_advisor_hardening`
4. `submission_and_classroom_hardening`
5. `nangrong_full_production_extension`
6. `harden_submission_rpc_security`
7. `optimize_rls_and_indexes`
8. `seed_complete_worksheet_content`
9. `submission_fix_and_audit_triggers`

Edge Functions:
- `bootstrap-admin`
- `admin-create-user`

สำคัญ: โฟลเดอร์นี้เป็นเอกสารอ้างอิง production. ไม่ต้องรัน SQL ซ้ำบน project ปัจจุบัน.
