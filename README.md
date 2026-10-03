# FamMoney

Family expense tracker (blueprint v1.0, `../idea-blueprint.md`). Free stack: React PWA + Supabase + free static host.

## Status
- [x] Slice 1: database (`supabase/migrations/001_init.sql`): tables, row-level security, audit log, caps, invites, realtime
- [x] Slice 2: app shell (Vite + React + dark theme + sign-in + create household + invites)
- [x] Slice 3: walking skeleton (add spend offline, sync, second device sees it, bar chart)
- [x] Slice 4 (MVP core): plan + envelopes, edit/void own spends, charts (month/year), calendar, audit log, installable app with update banner
- [ ] Next: nightly backup job, month close, bill photos, alerts, forced-update screen

## Run locally
```
npm install
cp .env.example .env     # then paste your sb_publishable key into .env
npm run dev              # opens http://localhost:5173
```
Supabase > Authentication > URL Configuration: set Site URL `http://localhost:5173` and add `http://localhost:5173/**` to Redirect URLs.
Key: Supabase > Settings > API Keys > Publishable key (`sb_publishable_...`), or the Legacy tab's `anon`.

## Setup (all free)
1. GitHub: create an account and an empty private repo `fammoney`; upload this folder.
2. Supabase: new project (region nearest India), then SQL Editor > paste `001_init.sql` > Run.
3. Supabase > Authentication > Providers: enable Email (magic link) and, if wanted, Google.
4. Keep the Project URL and `anon` key for slice 2. Never share the `service_role` key.
5. Host later on Cloudflare Pages, Vercel or Netlify (any one).

## Tests to run after step 2 (VAL-003)
- A member cannot update another member's transaction (expect 0 rows).
- A third Owner is rejected (`max_two_owners`); the last Owner cannot leave (`last_owner`).
- Editing `audit_entries` fails (`audit_is_append_only`).
