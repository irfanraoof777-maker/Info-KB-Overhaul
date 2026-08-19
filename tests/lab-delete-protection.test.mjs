import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const handler = readFileSync("server/vercel-api/admin/labs/[id].js", "utf8");
const admin = readFileSync("artifacts/infokb/src/pages/Admin.tsx", "utf8");
test("lab deletion checks historical rentals and payment orders before hard deletion", () => {
  assert.match(
    handler,
    /from\("lab_rentals"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("lab_id", id\)/,
  );
  assert.match(
    handler,
    /from\("lab_payment_orders"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("lab_id", id\)/,
  );
  assert.match(handler, /status\(409\)/);
  assert.match(handler, /LAB_HAS_HISTORY/);
  assert.match(handler, /cannot be deleted\. Disable the lab instead\./);
});
test("Admin preserves and displays the API deletion reason", () => {
  assert.match(admin, /await res\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
  assert.match(
    admin,
    /data\.error \?\? `Delete failed \(HTTP \$\{res\.status\}\)\.`/,
  );
  assert.match(admin, /alert\(message\)/);
});
