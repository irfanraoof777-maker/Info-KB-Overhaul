import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accessManager = readFileSync("artifacts/infokb/src/components/admin/AccessManager.tsx", "utf8");
const rentalHandler = readFileSync("server/vercel-api/admin/lab-rentals/[id].js", "utf8");
const launchHandler = readFileSync("server/vercel-api/admin/lab-rentals/launch-configuration.js", "utf8");
const adminRouter = readFileSync("server/vercel-api/admin-router.js", "utf8");

test("Mark Ready sends the explicit authenticated Admin PATCH and shows card-local errors", () => {
  assert.match(accessManager, /`\/api\/admin\/lab-rentals\/\$\{item\.id\}`, "PATCH", \{ action: "mark_ready"/);
  assert.match(accessManager, /rentalErrors\[item\.id\][\s\S]+role="alert"/);
  assert.match(rentalHandler, /supabase\.rpc\("admin_update_lab_rental"/);
  assert.match(rentalHandler, /typeof error\.message === "string"/);
});

test("each active rental can save a credential-free Guacamole test URL", () => {
  assert.match(accessManager, />Guacamole test URL<\/label>/);
  assert.match(accessManager, /http:\/\/192\.168\.20\.128:8080\/guacamole\//);
  assert.match(accessManager, /`\/api\/admin\/lab-rentals\/\$\{rentalId\}\/launch-configuration`, "PUT"/);
  assert.match(accessManager, /Never enter usernames, passwords, tokens, VM credentials, or connection secrets/);
  assert.ok(adminRouter.includes("path.match(/^lab-rentals\\/([^/]+)\\/launch-configuration$/)"));
  assert.match(launchHandler, /admin_set_lab_launch_configuration/);
  assert.match(launchHandler, /p_provider: "guacamole_test", p_launch_url: launchUrl/);
  assert.match(launchHandler, /rentalId: configuration\.rental_id, provider: configuration\.provider/);
  assert.doesNotMatch(launchHandler, /updatedAt: configuration\.updated_at,[\s\S]*p_launch_url/);
});

test("launch URL and Ready validation remain server-side", () => {
  assert.match(launchHandler, /checkBasicAuth\(req, res\)/);
  assert.match(launchHandler, /\^https\?:\\\/\\\/\\S\+\$/i);
  assert.match(rentalHandler, /current\.state !== "preparing"/);
  assert.match(rentalHandler, /new Date\(expiresAt\) <= new Date\(\)/);
  assert.match(rentalHandler, /p_action: action/);
});
