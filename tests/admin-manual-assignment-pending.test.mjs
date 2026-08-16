import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accessManager = readFileSync("artifacts/infokb/src/components/admin/AccessManager.tsx", "utf8");

test("manual lab assignment immediately shows the returned rental in Pending Requests", () => {
  assert.match(accessManager, /await load\(\); return data/);
  assert.match(accessManager, /const rental = result \? \(result as \{ rental\?: Rental \}\)\.rental : undefined/);
  assert.match(accessManager, /setRentals\(\(current\) => \[\{ \.\.\.rental, effective_status: rental\.effective_status \?\? rental\.state \}, \.\.\.current\.filter\(\(item\) => item\.id !== rental\.id\)\]\)/);
  assert.match(accessManager, /setRentalView\("pending"\)/);
  assert.match(accessManager, /onClick=\{\(\) => void assignLabManually\(\)\}/);
});
