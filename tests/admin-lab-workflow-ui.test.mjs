import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accessManager = readFileSync("artifacts/infokb/src/components/admin/AccessManager.tsx", "utf8");

test("Admin Lab workflow groups current states into actionable views", () => {
  assert.match(accessManager, /rental\.state === "payment_pending" \|\| rental\.state === "preparing"\) return "pending"/);
  assert.match(accessManager, /rental\.state === "ready"[\s\S]*expires_at[\s\S]*getTime\(\) > now/);
  assert.match(accessManager, /return isCurrentReady\(rental, now\) \? "active" : "history"/);
  assert.match(accessManager, /Pending Requests \(\{groupedRentals\.pending\.length\}\)/);
  assert.match(accessManager, /Active Labs \(\{groupedRentals\.active\.length\}\)/);
  assert.match(accessManager, /History \(\{groupedRentals\.history\.length\}\)/);
});

test("Admin Lab workflow defaults to pending and keeps manual assignment secondary", () => {
  assert.match(accessManager, /useState<RentalView>\("pending"\)/);
  assert.match(accessManager, /Assign Lab Manually/);
  assert.match(accessManager, /showManualAssignment &&/);
  assert.match(accessManager, /request\("\/api\/admin\/lab-rentals", "POST"/);
});

test("History is view-only while pending retains provisioning controls", () => {
  assert.match(accessManager, /const pending = rentalView === "pending"/);
  assert.match(accessManager, /pending && <><div className="grid/);
  assert.match(accessManager, /Save Guacamole URL/);
  assert.doesNotMatch(accessManager, /rentalView === "history"[^\n]*Save Guacamole URL/);
});

test("Lab rental actions are non-submitting and refresh React state without navigation", () => {
  assert.doesNotMatch(accessManager, /window\.location|location\.reload|reload\(/);
  assert.ok((accessManager.match(/type="button"/g) ?? []).length >= 7);
  assert.match(accessManager, /action: "cancel"/);
  assert.match(accessManager, /action: "update_schedule"/);
  assert.match(accessManager, /saveLaunchUrl\(item\.id\)/);
  assert.match(accessManager, /assignLabManually\(\)/);
  assert.match(accessManager, /if \(!data\) throw new Error\(failureMessage\); await load\(\); return data;/);
});
