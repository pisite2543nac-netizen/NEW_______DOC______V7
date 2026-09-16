# V17.8 Deadline Mobile Notifications

- Server cron checks published Digital assignments every minute.
- Reminder 1: when remaining time is <= 1 hour and work is incomplete.
- Reminder 2: when Digital deadline arrives; message directs student to late Paper workflow.
- private dispatch ledger prevents duplicate notifications for the same user/worksheet/reminder kind.
- Completed logical work pairs are excluded.
- Realtime app_notifications trigger an operating-system popup when Notification permission is granted.
- Service Worker notification click focuses/opens the PWA and routes to “งานของฉัน”.
- Recent deadline notifications are replayed after reconnect so a user does not miss the reminder merely because realtime disconnected.
- Each phone/tablet/computer must grant Notification permission once.
- Browser/PWA background execution is controlled by the operating system; if the app is force-terminated, queued in-app reminders are shown on the next active session. This package does not claim remote Web Push delivery to a fully terminated app.
