import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canAccessLab, parseOptionalDate, validateWindow } from "../server/vercel-api/_utils/access.js";

const accessManager = readFileSync("artifacts/infokb/src/components/admin/AccessManager.tsx", "utf8");

test("authoritative rental timestamps require an explicit timezone", () => {
  assert.throws(
    () => parseOptionalDate("2026-08-24T12:00", "startsAt"),
    /explicit timezone/,
  );
  assert.throws(
    () => parseOptionalDate("2026-08-24 12:00:00", "expiresAt"),
    /explicit timezone/,
  );
});

test("timezone-aware timestamps are accepted and normalized to UTC", () => {
  assert.equal(
    parseOptionalDate("2026-08-24T12:00:00Z", "startsAt"),
    "2026-08-24T12:00:00.000Z",
  );
  assert.equal(
    parseOptionalDate("2026-08-24T17:30:00+05:30", "expiresAt"),
    "2026-08-24T12:00:00.000Z",
  );
});

test("valid rental windows and access checks continue to use absolute instants", () => {
  const startsAt = parseOptionalDate("2026-08-24T11:00:00Z", "startsAt");
  const expiresAt = parseOptionalDate("2026-08-24T17:30:00+05:30", "expiresAt");
  assert.doesNotThrow(() => validateWindow(startsAt, expiresAt));
  assert.equal(
    canAccessLab(
      { state: "ready", starts_at: startsAt, expires_at: expiresAt, cancelled_at: null },
      new Date("2026-08-24T11:30:00Z"),
    ),
    true,
  );
});

test("admin scheduling converts local datetime input to UTC and exposes its timezone semantics", () => {
  assert.match(accessManager, /const toUtcIso = \(value: string\) =>\s*value \? new Date\(value\)\.toISOString\(\) : null/);
  assert.match(accessManager, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.match(accessManager, /timeZone: "UTC"/);
  assert.match(accessManager, /Stored as: \{formatted\} UTC/);
  assert.match(accessManager, /Schedule times are entered in your local timezone \(\{adminTimeZone\}\) and stored as UTC\./);
});
