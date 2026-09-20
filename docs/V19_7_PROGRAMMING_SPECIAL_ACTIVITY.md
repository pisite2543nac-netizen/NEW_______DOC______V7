# V19.7 — Programming Special Activity / Code Typing Academy

## Source audit

V19.7 was adapted from the user-provided **Code Typing Academy V6.0.2** project. The source archive is a large standalone Firebase game: 562 files, about 141 MB when extracted, including 26 JavaScript files, 5 HTML files, 49 Markdown/history documents, art assets, PVP, world/zone, shop/equipment, quests, ranking, levels, and Firebase backend files.

The adaptation deliberately keeps the parts that directly support **21910-2010 การเขียนโปรแกรมภาษาคอมพิวเตอร์** and integrates them with DOC-FULL-NR instead of embedding a second application.

### Adapted into DOC-FULL-NR

- HTML learning track: 50 stages
- Python learning track: 50 stages
- progressive/sequential stage unlock
- Practice mode
- Ranking mode
- WPM, Accuracy, mistakes, elapsed time
- class and overall leaderboard
- Teacher Quest system with reward tokens
- Daily Focus activity with server heartbeat
- Official Challenge: 30 selected stages / 40 activity points
- Admin activity settings
- Admin student progress dashboard
- responsive typing workspace for desktop/tablet/mobile
- server-side audit trail for submitted stages

### Intentionally not imported

- Firebase Authentication / Firestore
- PVP wagering/battle
- open-world chat / 2D social zone
- large cosmetic shop, inventory, equipment, pets, and skin assets

These parts were excluded because DOC-FULL-NR already has Supabase authentication, enrollment, roles, classroom permissions, and academic data. Importing a second auth/database would create duplicate identities and inconsistent permissions. PVP/social/cosmetic systems also add unrelated privacy, moderation, storage, and security surface to an academic activity.

## Access model

The special-activity button appears only for subject code `21910-2010`.

- `admin`: can open the activity from the subject page, configure features, review the whole class, and manage Teacher Quests.
- `user`: must be active/approved, have an approved enrollment in the subject, and the classroom must be open.
- Closing the classroom through V19.4 also blocks student activity access without deleting progress.

All V19.7 activity tables are RPC-only for signed-in clients. Direct authenticated table access is revoked.

## Server-authoritative integrity

The browser displays target code because it is a typing exercise, but the database stores a SHA-256 target hash rather than the raw target source. A student submission is accepted through a server session:

1. `start_programming_stage_v197` validates access, unlock state, mode, and official-stage mapping, then creates/reuses a server-timed session.
2. `submit_programming_stage_v197` validates the session, hashes normalized typed text, compares it with the protected stage hash, computes elapsed time on the server, then calculates WPM/accuracy/reward.
3. `request_key` makes stage submission idempotent.
4. Daily Focus uses periodic server heartbeats rather than trusting a client-supplied accumulated duration.

## Academic separation

The Official Challenge has **30 stages / 40 activity points**. These are explicitly **activity points**, not the subject gradebook's 40-point worksheet component and not part of the 100-point course grade. V19.7 does not change the established V19.3 grade weights:

- Worksheets 40
- Behavior 20
- Midterm 20
- Final 20
- Total 100

This separation is stated in both User and Admin UIs to avoid accidental grade inflation.

## Static learning asset

`site/data/programming-activity-v197.json` is the PWA learning catalog and contains the visible code target and educational metadata needed by the typing UI. It contains 100 stages (50 HTML + 50 Python) and the 30-stage official mapping. It is not an answer key for the course exam and is not used to expose exam answers.

## Production backend

Production Supabase was prepared with V19.7 backend objects before frontend deployment. The packaged source includes both the base V19.7 migration and a V19.7.1 alignment migration so a fresh V19.6 database reaches the hardened Production contract: hashed stages, server sessions, heartbeat focus tracking, current RPC signatures, and RPC-only access.
