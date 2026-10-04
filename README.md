# FamMoney

A private family expense tracker: one salary, budgets per person, every rupee logged, shared live. Installable web app (PWA) for Android, iPhone and desktop.
Blueprint: ../idea-blueprint.md (v1.1). Stack: React + Vite, Supabase (Postgres, login, live updates), Vercel hosting, all free.

## Decisions for the pilot
- **Supabase stays** for the first few weeks (DEC-017). Review after real use: stay, self-host on an old laptop, or go phone-only.
- **No weather, no location** (DEC-018). Header shows date and time only.
- **Backup = you, once a month** (DEC-019): Budget tab > Month report > Download CSV (restorable, every entry) + Save as PDF (readable). Keep copies on your phone and a laptop/pen drive.
- **Privacy**: GitHub and Vercel hold only code. Supabase holds the data. Entering salary is optional; budgets and spends work without it.

## Database (run once each, in order, in Supabase > SQL Editor > New query)
1. `001_init.sql`  2. `002_categories_notes.sql`  3. `003_ping.sql` (optional)  4. `004_profile.sql` (lets everyone edit their own name and colour)

## Run locally
```
npm install
cp .env.example .env    # paste your sb_publishable_... key
npm run dev             # http://localhost:5173
```
## Deploy (Vercel)
Import the repo, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`, deploy. Then Supabase > Authentication > URL Configuration: Site URL + `…/**` redirect = your Vercel address (keep localhost too).
Install on phones: Chrome > Install app, or Safari > Share > Add to Home Screen. Updates arrive as an "Update available" banner. To force an update: `update app_config set min_app_version = '0.7.0';`

## Keep-alive (optional, sends no data)
Free Supabase pauses after 7 idle days; daily family use prevents that. As a safety net, add GitHub secrets `SUPABASE_URL` and `SUPABASE_KEY` (publishable key), then Actions > "Keep Supabase awake" > Run workflow once.

## Monthly routine (5 minutes)
1. Budget tab > Close month (locks it).
2. Month report > Download CSV + Save as PDF; store them safely.
3. Start next month's budget and add the new salary (optional).

## Pilot checklist (2-4 weeks)
Everyone logs at least 5 entries a week; try offline entries; try edit/void; check alerts; note what annoys you. Then decide the next step.

## Later (after the pilot)
Bill photos, push notifications, visual redesign, more members, Android APK wrapper (Capacitor), self-hosting, Wealth Vault (Module 2).

## Drop 1 (v0.7.0): look and feel
New design system (cards, buttons, tables, skeleton loaders), desktop sidebar, Home budget overview ring, new icon, Settings (profile, household, categories), Insights custom range + month comparison + table view.

## Full build (v0.8.0)
Run `005_full.sql` once (re-runnable). Adds bill photos (private bucket `bills`), "log as paid" on bill reminders, PIN locks (this device only), leave/rejoin, audit filter, delete-everything for Owners, and the Wealth Vault. Push notifications are NOT built yet (reminders and alerts show inside the app).
