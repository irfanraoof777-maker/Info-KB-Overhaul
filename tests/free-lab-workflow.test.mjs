import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260816_secure_free_lab_claim_and_test_launch.sql", "utf8");
const studentRouter = readFileSync("server/vercel-api/student-lab-router.js", "utf8");

test("free claims use authoritative price and a full student-Lab unique boundary", () => {
  assert.match(migration, /discounted_price IS NOT NULL[\s\S]+discounted_price < target_lab\.price/);
  assert.match(migration, /effective_price <> 0/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS lab_rentals_user_lab_unique_idx[\s\S]+ON public\.lab_rentals \(user_id, lab_id\)/);
  assert.doesNotMatch(migration, /WHERE source = 'free_trial'/);
  assert.match(migration, /ON CONFLICT \(user_id, lab_id\) DO NOTHING/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /'preparing', 'free_trial'/);
});

test("Dashboard pre-opens and safely cleans up the authorized launch tab", () => {
  const dashboard = readFileSync("artifacts/infokb/src/pages/Dashboard.tsx", "utf8");
  const openAt = dashboard.indexOf('window.open("about:blank", "_blank")');
  const fetchAt = dashboard.indexOf('fetch(`/api/lab-rentals/${item.rentalId}/access`');
  assert.ok(openAt >= 0 && openAt < fetchAt);
  assert.match(dashboard, /launchWindow\.opener = null/);
  assert.match(dashboard, /if \(!launchWindow\)[\s\S]+return;/);
  assert.match(dashboard, /if \(!session \|\| !item\.canAccess \|\| labLaunchLocked\.current\) return;\s+labLaunchLocked\.current = true/);
  assert.match(dashboard, /if \(!launchWindow\)[\s\S]+labLaunchLocked\.current = false;[\s\S]+return;/);
  assert.match(dashboard, /finally \{\s+labLaunchLocked\.current = false/);
  assert.match(dashboard, /launchWindow\.location\.replace\(target\.toString\(\)\)/);
  assert.match(dashboard, /catch \(cause\) \{\s+launchWindow\.close\(\)/);
  assert.doesNotMatch(dashboard, /guacamole/i);
});

test("browser roles cannot reach private launch data or server-only RPCs", () => {
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE private\.lab_launch_configurations[\s\S]+PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.claim_free_lab_rental\(uuid, uuid\)[\s\S]+PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.get_authorized_lab_launch\(uuid, uuid\) TO service_role/);
  assert.doesNotMatch(studentRouter, /username|password|connection_secret|credential/i);
});

test("student endpoints derive identity from verified bearer authentication", () => {
  assert.match(studentRouter, /createStudentLabRouter\(authenticate = requireStudent\)/);
  assert.match(studentRouter, /authenticate\(req, res\)/);
  assert.match(studentRouter, /p_student_id: auth\.user\.id/);
  assert.match(studentRouter, /path === "free-claim"/);
  assert.match(studentRouter, /\/access\$/);
});

test("Admin Lab transitions preserve the deployed action contract", () => {
  const adminHandler = readFileSync("server/vercel-api/admin/lab-rentals/[id].js", "utf8");
  for (const action of ["start_preparing", "mark_ready", "cancel", "update_schedule", "extend"]) {
    assert.match(adminHandler, new RegExp(action));
    assert.match(migration, new RegExp(`'${action}'`));
  }
  assert.doesNotMatch(adminHandler, /advance/);
  assert.doesNotMatch(migration, /p_action\s*=\s*'advance'|p_action\s+IN\s*\([^)]*'advance'/);
  const preparingAt = migration.indexOf("p_action = 'mark_ready'");
  const configAt = migration.indexOf("private.lab_launch_configurations", preparingAt);
  const readyUpdateAt = migration.indexOf("state = 'ready'", preparingAt);
  assert.ok(preparingAt >= 0 && configAt > preparingAt && readyUpdateAt > configAt);
});
