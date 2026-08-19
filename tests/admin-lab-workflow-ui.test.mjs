import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accessManager = readFileSync("artifacts/infokb/src/components/admin/AccessManager.tsx", "utf8");

test("Admin Lab workflow groups current states into actionable views", () => {
  assert.match(accessManager, /rental\.state === "payment_pending" \|\| rental\.state === "preparing"\)[\s\S]*return "pending"/);
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
  assert.match(accessManager, /pending && \(/);
  assert.match(accessManager, /Save Guacamole URL/);
  assert.doesNotMatch(accessManager, /rentalView === "history"[^\n]*Save Guacamole URL/);
});
  assert.match(accessManager, /Remove this rental from Admin History\? The rental record will be preserved\./);
  assert.match(accessManager, /method: "DELETE"/);
  assert.match(accessManager, /rentalView === "history" \? \(/);
  assert.match(accessManager, /setRentals\(\(current\) => current\.filter\(\(item\) => item\.id !== rentalId\)\)/);

test("Lab rental actions are non-submitting and refresh React state without navigation", () => {
  assert.doesNotMatch(accessManager, /window\.location|location\.reload|reload\(/);
  assert.ok((accessManager.match(/type="button"/g) ?? []).length >= 7);
  assert.match(accessManager, /action: "cancel"/);
  assert.match(accessManager, /action: "update_schedule"/);
  assert.match(accessManager, /saveLaunchUrl\(item\.id\)/);
  assert.match(accessManager, /assignLabManually\(\)/);
  assert.match(accessManager, /if \(!data\)[\s\S]*throw new Error\(failureMessage\)[\s\S]*await load\(\)[\s\S]*return data/);
});
