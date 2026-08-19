import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hashAdminPassword, verifyAdminPassword } from "../server/vercel-api/_utils/auth.js";

test("Admin password hashes use unique scrypt salts and verify without storing plaintext", async () => {
  const first = await hashAdminPassword("correct horse battery staple");
  const second = await hashAdminPassword("correct horse battery staple");
  assert.match(first, /^scrypt\$[^$]+\$[^$]+$/);
  assert.notEqual(first, second);
  assert.equal(first.includes("correct horse battery staple"), false);
  assert.equal(await verifyAdminPassword("correct horse battery staple", first), true);
  assert.equal(await verifyAdminPassword("wrong password", first), false);
});

test("Admin reset endpoint owns recipients and does not accept a browser email", () => {
  const request = readFileSync("api/admin-password-reset/request.js", "utf8");
  assert.match(request, /const RECIPIENTS = \["imran@infokb\.com", "irfan@infokb\.com"\]/);
  assert.doesNotMatch(request, /req\.body\?\.email/);
  assert.match(request, /randomBytes\(32\)/);
  assert.match(request, /30 \* 60 \* 1000/);
});

test("Admin reset migration invalidates prior tokens and atomically consumes a token", () => {
  const migration = readFileSync("supabase/migrations/20260830_add_admin_password_reset.sql", "utf8");
  assert.match(migration, /UPDATE public\.admin_password_reset_tokens SET used_at = now\(\) WHERE used_at IS NULL/);
  assert.match(migration, /AND used_at IS NULL\s+AND expires_at > now\(\)/);
  assert.match(migration, /SET password_hash = p_password_hash/);
  assert.match(migration, /interval '10 minutes'/);
});