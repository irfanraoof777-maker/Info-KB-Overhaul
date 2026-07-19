# InfoKB — IT Certification Training Platform

## Overview
InfoKB is a full-stack IT training and certification platform built with React + Vite (frontend) and Express (backend), backed by Supabase for auth, course data, and file storage.

## Architecture
- **Frontend**: `artifacts/infokb/` — React + Vite, Tailwind CSS v4, Wouter routing, TanStack Query, Supabase JS client
- **API Server**: `artifacts/api-server/` — Express, Supabase admin client, AWS S3 (file uploads), multer
- **Shared libs**: `lib/db/` (Drizzle + Postgres), `lib/api-spec/` (OpenAPI), `lib/api-client-react/` (generated hooks)

## Pages / Routes
- `/` — Home (hero, featured courses, search)
- `/courses` — Course catalog with filters
- `/courses/:slug` — Course detail + enroll
- `/about` — Team / trainers
- `/contact` — Contact form
- `/login`, `/signup`, `/forgot-password`, `/reset-password` — Auth
- `/dashboard` — Enrolled courses for logged-in users
- `/admin` — Admin panel (protected by Basic Auth)

## Key Environment Variables
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key (used in frontend)
- `SUPABASE_SECRET_KEY` — Supabase service role key (used in api-server only)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — Basic auth for `/api/admin/*`
- `SESSION_SECRET` — Session secret

## Running
Workflows are managed automatically:
- `artifacts/infokb: web` — Frontend dev server (port 24431)
- `artifacts/api-server: API Server` — Backend (port 8080)

## User Preferences
- Keep existing pnpm workspace structure; do not flatten or restructure packages
