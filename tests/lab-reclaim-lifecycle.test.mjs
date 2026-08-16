import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { canAccessLab, effectiveLabStatus } from "../server/vercel-api/_utils/access.js";

const migration = readFileSync("supabase/migrations/20260820_allow_lab_reclaim_after_terminal_rentals.sql", "utf8");
const dashboard = readFileSync("api/dashboard-access.js", "utf8");

test("terminal Lab rentals are historical while current rentals remain unique", () => {
  assert.match(migration, /'payment_pending', 'preparing', 'ready', 'cancelled', 'expired'/);
  assert.match(migration, /SET state = 'expired'[\s\S]*expires_at IS NULL OR rental_row\.expires_at <= now\(\)/);
  assert.match(migration, /lab_rentals_user_lab_current_unique_idx[\s\S]*WHERE state IN \('payment_pending', 'preparing', 'ready'\)/);
  assert.match(migration, /CREATE UNIQUE INDEX lab_rentals_user_lab_current_unique_idx[\s\S]*WHERE state IN \('payment_pending', 'preparing', 'ready'\)/);
});

test("free claims return only a newest current entitlement or create a new one", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /state IN \('payment_pending', 'preparing', 'ready'\)[\s\S]*ORDER BY rental_row\.created_at DESC/);
  assert.match(migration, /VALUES \(p_student_id, p_lab_id, 'preparing', 'free_trial'\)/);
  assert.match(migration, /updated_at, false/);
  assert.match(migration, /updated_at, true/);
});

test("dashboard and launch access exclude terminal and time-expired rentals", () => {
  assert.match(dashboard, /\.in\("state", \["payment_pending", "preparing", "ready"\]\)/);
  assert.match(dashboard, /state\.eq\.ready,expires_at\.gt\.\$\{nowIso\}/);
  const now = new Date("2026-08-20T00:00:00.000Z");
  for (const rental of [
    { state: "cancelled", expires_at: "2026-09-01T00:00:00.000Z" },
    { state: "expired", expires_at: "2026-09-01T00:00:00.000Z" },
    { state: "ready", expires_at: "2026-08-19T00:00:00.000Z" },
  ]) assert.equal(canAccessLab(rental, now), false);
  assert.equal(effectiveLabStatus({ state: "expired", expires_at: null }, now), "expired");
});

test("admin lifecycle does not revive terminal rentals", () => {
  assert.match(migration, /current_rental\.state IN \('cancelled', 'expired'\)[\s\S]*Terminal Lab rental cannot be changed/);
  assert.match(migration, /admin_assign_lab_rental[\s\S]*pg_advisory_xact_lock/);
});
