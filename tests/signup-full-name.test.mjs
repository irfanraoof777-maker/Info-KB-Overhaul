import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const signup = readFileSync("artifacts/infokb/src/pages/Signup.tsx", "utf8");
test("signup trims and persists required full name in Auth metadata", () => {
  assert.match(signup, /const normalizedFullName = fullName\.trim\(\)/);
  assert.match(signup, /if \(!normalizedFullName\)/);
  assert.match(signup, /normalizedFullName\.length > 120/);
  assert.match(signup, /options: \{ data: \{ full_name: normalizedFullName \} \}/);
  assert.match(signup, /Label htmlFor="full-name">Full Name/);
});
