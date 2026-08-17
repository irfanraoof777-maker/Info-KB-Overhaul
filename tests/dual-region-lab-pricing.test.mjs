import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateLabPricing } from "../server/vercel-api/_utils/lab-pricing.js";

const migration = readFileSync("supabase/migrations/20260822_add_dual_region_lab_pricing.sql", "utf8");
const createHandler = readFileSync("server/vercel-api/admin/labs.js", "utf8");
const updateHandler = readFileSync("server/vercel-api/admin/labs/[id].js", "utf8");
const adminPage = readFileSync("artifacts/infokb/src/pages/Admin.tsx", "utf8");

test("migration preserves legacy USD pricing and leaves INR unconfigured", () => {
  assert.match(migration, /price_usd = price/);
  assert.match(migration, /discounted_price > 0\s+AND discounted_price < price/);
  assert.match(migration, /price_inr = NULL/);
  assert.match(migration, /discounted_price_inr = NULL/);
  assert.doesNotMatch(migration, /price_inr\s*=\s*price/);
});

test("regional price validation permits free USD labs and rejects invalid relationships", () => {
  assert.deepEqual(validateLabPricing({ price_usd: 0, price_inr: "", discounted_price_inr: "" }), { price_usd: 0, discounted_price_usd: null, price_inr: null, discounted_price_inr: null, price: 0, discounted_price: null });
  assert.throws(() => validateLabPricing({ price_usd: -1 }), /non-negative/);
  assert.throws(() => validateLabPricing({ price_usd: 10, discounted_price_usd: 10 }), /lower/);
  assert.throws(() => validateLabPricing({ price_usd: 10, discounted_price_inr: 100 }), /required/);
});

test("empty INR stores NULL without changing USD pricing", () => {
  assert.deepEqual(validateLabPricing({ price_inr: "", discounted_price_inr: "" }, { price_usd: 12.5, discounted_price_usd: 10, price_inr: 999, discounted_price_inr: 899 }), { price_usd: 12.5, discounted_price_usd: 10, price_inr: null, discounted_price_inr: null, price: 12.5, discounted_price: 10 });
});

test("pricing writes remain admin-only and server-side validated", () => {
  assert.match(createHandler, /checkBasicAuth\(req, res\)/);
  assert.match(updateHandler, /checkBasicAuth\(req, res\)/);
  assert.match(createHandler, /validateLabPricing\(body\)/);
  assert.match(updateHandler, /validateLabPricing\(body, current\)/);
});

test("admin separates USD and INR pricing", () => {
  assert.match(adminPage, /International Pricing \(USD\)/);
  assert.match(adminPage, /India Pricing \(INR\)/);
  assert.match(adminPage, /Regular Price \(INR\)/);
  assert.match(adminPage, /Not configured/);
});