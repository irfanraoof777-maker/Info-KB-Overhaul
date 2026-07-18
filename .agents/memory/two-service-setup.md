---
name: Two-service setup
description: InfoKB requires both the frontend Vite dev server and the Express API server running simultaneously
---

The InfoKB project has two required workflows:
- "Start application" — `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/infokb run dev` — Vite frontend
- "API Server" — `PORT=8080 pnpm --filter @workspace/api-server run dev` — Express backend

**Why:** The Vite dev server proxies all `/api/*` requests to `localhost:8080`. If only the frontend runs, any page that calls the API (Lab Rentals, Admin panel) gets ECONNREFUSED.

**How to apply:** After any restart or new session, always ensure both workflows are running before testing API-dependent features.
