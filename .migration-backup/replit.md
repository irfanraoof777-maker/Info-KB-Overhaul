# InfoKB Website

A TypeScript React website for InfoKB — an IT training and certification platform with Supabase auth and an admin panel.

## Run & Operate

- **Frontend dev**: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/infokb run dev`
- **API server dev**: `PORT=8080 pnpm --filter @workspace/api-server run dev`
- Both services must be running for full functionality (frontend proxies `/api/*` to port 8080)
- **Typecheck**: `pnpm run typecheck`
- **Build all**: `pnpm run build`

Required secrets (set in Replit Secrets):
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
- `SUPABASE_SECRET_KEY` — Supabase service_role key (server-side only)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — credentials for `/admin` panel

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Wouter (routing)
- **Auth**: Supabase (`@supabase/supabase-js`) — email/password, session via Supabase built-in
- **Backend**: Express 5 (Node 24) — serves `/api/*`
- **Monorepo**: pnpm workspaces
- **Build**: esbuild (api-server), Vite (frontend)

## Where things live

- `artifacts/infokb/src/` — React frontend
  - `pages/` — Home, Courses, CourseDetail, About, Contact, Login, Signup, Dashboard, Admin
  - `components/Navbar.tsx` — auth-aware navbar
  - `context/AuthContext.tsx` — Supabase session provider
  - `lib/supabase.ts` — Supabase client (reads `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`)
- `artifacts/api-server/src/` — Express API
  - `routes/admin.ts` — `/api/admin/users` GET/DELETE (Basic Auth + SUPABASE_SECRET_KEY)

## Architecture decisions

- Vite `envPrefix: ["VITE_", "SUPABASE_"]` exposes `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the browser without requiring a `VITE_` prefix.
- Admin panel uses HTTP Basic Auth on every request — credentials stay in React state (sessionStorage not used); the backend validates against `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars.
- `SUPABASE_SECRET_KEY` (service_role) is only ever used server-side in the api-server; it is never sent to the browser.
- Supabase URL is normalized on the client (https:// prepended if scheme is missing).

## Product

- Public pages: Home, Courses, Course Detail, About, Contact
- Auth: `/login` (email+password), `/signup` (with email confirmation support)
- Protected: `/dashboard` — shows logged-in user's email + logout; redirects to `/login` if not authenticated
- Admin: `/admin` — protected by ADMIN_USERNAME/ADMIN_PASSWORD; lists all Supabase users with delete capability

## User preferences

- Do not break existing pages or styling
- Use environment variables for all keys, never hardcode

## Gotchas

- Frontend workflow must include `PORT` and `BASE_PATH` env vars in the run command
- API server rebuilds on each `dev` start (esbuild); hot reload not supported — restart workflow after backend changes
- `envPrefix` in vite.config.ts must include `"SUPABASE_"` or those vars won't be visible to the browser bundle
