import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizeLiveClass } from "../server/vercel-api/admin/live-class-validation.js";
import { insertLiveClass } from "../server/vercel-api/admin/live-classes.js";

test("Live Training Admin validation has no seat-limit field", () => {
  const course = normalizeLiveClass({ title: "Live", slug: "live", price_inr: 100, max_seats: 25 });
  assert.equal(Object.hasOwn(course, "max_seats"), false);
});

test("Live Training create retries without the optional LinkedIn column on legacy production schemas", async () => {
  const attempts = [];
  const supabase = { from: () => ({ insert: (payload) => ({ select: () => ({ single: async () => { attempts.push(payload); return attempts.length === 1 ? { data: null, error: { code: "PGRST204", message: "instructor_linkedin_url does not exist" } } : { data: { id: "live-1" }, error: null }; } }) }) }) };
  const result = await insertLiveClass(supabase, { title: "Live", instructor_linkedin_url: "" });
  assert.equal(result.error, null);
  assert.deepEqual(attempts, [{ title: "Live", instructor_linkedin_url: "" }, { title: "Live" }]);
});

test("Live Training migrations are unlimited while retaining one registration record per student and course", () => {
  const initial = readFileSync("supabase/migrations/20260907_add_live_classes.sql", "utf8");
  const followUp = readFileSync("supabase/migrations/20260908_remove_live_class_capacity_and_add_refunds.sql", "utf8");
  assert.match(initial, /UNIQUE \(user_id, live_course_id\)/);
  assert.doesNotMatch(initial, /max_seats|Class is full|seats >=/i);
  assert.match(followUp, /DROP COLUMN IF EXISTS max_seats/);
  assert.doesNotMatch(followUp, /Class is full|seats >=/i);
});

test("active paid registration blocks duplicates while failed and unpaid registrations allow retry", () => {
  const payments = readFileSync("server/vercel-api/live-class-payments.js", "utf8");
  assert.match(payments, /\.eq\("payment_status", "paid"\)\.eq\("enrollment_status", "active"\)\.maybeSingle\(\)/);
  assert.match(payments, /if \(existing\.data\) return res\.status\(409\)/);
  assert.doesNotMatch(payments, /\.eq\("enrollment_status", "cancelled"\)/);
});

test("successful Live Training payment finalization creates a paid active registration", () => {
  const migration = readFileSync("supabase/migrations/20260908_remove_live_class_capacity_and_add_refunds.sql", "utf8");
  assert.match(migration, /VALUES\(o\.student_id, c\.id, o\.id, p_razorpay_payment_id, 'paid', 'active'\)/);
  assert.match(migration, /ON CONFLICT\(user_id, live_course_id\) DO UPDATE[\s\S]*payment_status = 'paid', enrollment_status = 'active'/);
  assert.doesNotMatch(migration, /Class is full|seats >=/i);
});

test("Live Training webhook deliberately ignores refunds and never finalizes a Live Training refund", () => {
  const payments = readFileSync("server/vercel-api/live-class-payments.js", "utf8");
  assert.match(payments, /\["refund\.created", "refund\.processed"\]\.includes\(event\.event\)\) return res\.status\(200\)\.json\(\{ ignored: true \}\)/);
  assert.doesNotMatch(payments, /finalizeRefund|finalize_razorpay_live_class_refund/);
});

test("protected Join Training URL is unavailable before and after a session and to unauthorized or unpaid users", () => {
  const migration = readFileSync("supabase/migrations/20260908_secure_live_class_join_window.sql", "utf8");
  assert.match(migration, /IF auth\.uid\(\) IS NULL THEN RAISE EXCEPTION/);
  assert.match(migration, /s\.starts_at <= now\(\)[\s\S]*s\.ends_at > now\(\)/);
  assert.match(migration, /r\.user_id = auth\.uid\(\)[\s\S]*r\.payment_status = 'paid'[\s\S]*r\.enrollment_status = 'active'/);
  assert.match(migration, /IF NOT FOUND THEN RAISE EXCEPTION/);
});

test("student live-training dashboard reads only the authenticated student's persisted bookings and keeps active sessions", () => {
  const endpoint = readFileSync("api/live-classes/my.js", "utf8");
  assert.match(endpoint, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(endpoint, /enrollment_status,payment_status,enrolled_at,updated_at/);
  assert.doesNotMatch(endpoint, /filter\(s => new Date\(s\.starts_at\) > new Date\(\)\)/);
});

test("student dashboard hides Join Training before start and after end while rendering booking status", () => {
  const dashboard = readFileSync("artifacts/infokb/src/components/MyLiveClasses.tsx", "utf8");
  assert.match(dashboard, /Date\.parse\(session\.ends_at\) <= now \? "completed" : Date\.parse\(session\.starts_at\) <= now \? "live" : "upcoming"/);
  assert.match(dashboard, /state === "live" \? <button/);
  assert.match(dashboard, /Join Training/);
  assert.match(dashboard, /item\.registration\?\.payment_status === "paid" \? "Booked"/);
});

test("public and Admin live-training UI do not expose capacity or the protected join URL", () => {
  const admin = readFileSync("artifacts/infokb/src/components/admin/LiveClassesManager.tsx", "utf8");
  const publicCard = readFileSync("artifacts/infokb/src/pages/LiveClasses.tsx", "utf8");
  assert.doesNotMatch(admin, /Maximum students|max_seats|capacity/i);
  assert.doesNotMatch(publicCard, /max_seats|capacity/i);
  assert.doesNotMatch(publicCard, /meeting_url/);
});