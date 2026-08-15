import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createStudentLabRouter } from "../server/vercel-api/student-lab-router.js";
import { createAdminRouter } from "../server/vercel-api/admin-router.js";
import { checkBasicAuth } from "../server/vercel-api/_utils/auth.js";
import { requireVerifiedStudent } from "../server/vercel-api/_utils/student-token.js";

function response() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { this.ended = true; return this; },
  };
}

test("Admin Basic authentication accepts valid and rejects invalid credentials", () => {
  const previousUser = process.env.ADMIN_USERNAME;
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_USERNAME = "test-admin";
  process.env.ADMIN_PASSWORD = "test-password";
  try {
    const validResponse = response();
    assert.equal(checkBasicAuth({ headers: { authorization: `Basic ${Buffer.from("test-admin:test-password").toString("base64")}` } }, validResponse), true);

    const invalidResponse = response();
    assert.equal(checkBasicAuth({ headers: { authorization: `Basic ${Buffer.from("test-admin:wrong").toString("base64")}` } }, invalidResponse), false);
    assert.equal(invalidResponse.statusCode, 401);
  } finally {
    if (previousUser === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = previousUser;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previousPassword;
  }
});

test("student bearer authentication accepts a verified token", async () => {
  const user = { id: "student-id" };
  const supabase = { auth: { getUser: async (token) => ({ data: { user }, error: token === "valid-token" ? null : new Error("invalid") }) } };
  const res = response();
  const result = await requireVerifiedStudent({ headers: { authorization: "Bearer valid-token" } }, res, () => supabase);
  assert.deepEqual(result, { supabase, user });
});

test("student bearer authentication rejects an invalid token", async () => {
  const supabase = { auth: { getUser: async () => ({ data: { user: null }, error: new Error("invalid") }) } };
  const res = response();
  assert.equal(await requireVerifiedStudent({ headers: { authorization: "Bearer invalid-token" } }, res, () => supabase), null);
  assert.equal(res.statusCode, 401);
});

test("router matches dynamic IDs and preserves query parameters", async () => {
  let received;
  const router = createAdminRouter([{ pattern: /^lab-rentals\/([^/]+)$/, methods: new Set(["PATCH", "OPTIONS"]), handler: (req, res) => { received = req; return res.status(200).json({ ok: true }); } }]);
  const res = response();
  await router({ method: "PATCH", url: "/api/admin/lab-rentals/rental-1?view=full", query: { path: ["lab-rentals", "rental-1"], view: "full" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(received.query.id, "rental-1");
  assert.equal(received.query.view, "full");
});

test("router rejects unknown paths and unsupported methods", async () => {
  const router = createAdminRouter([]);
  const unknown = response();

  await router({ method: "GET", url: "/api/admin/unknown", query: { path: ["unknown"] } }, unknown);
  assert.equal(unknown.statusCode, 404);

  const methodRouter = createAdminRouter([{ pattern: /^courses$/, methods: new Set(["GET", "OPTIONS"]), handler: () => assert.fail("must not dispatch") }]);
  const unsupported = response();
  await methodRouter({ method: "DELETE", url: "/api/admin/courses", query: { path: ["courses"] } }, unsupported);
  assert.equal(unsupported.statusCode, 405);
});

test("Vercel rewrite and Admin router dispatch a realistic rental UUID PATCH", async () => {
  const rentalId = "8f6f91a8-2618-4e75-a662-f916fbdb7d4e";
  const entrypoint = readFileSync("api/admin/[...path].js", "utf8");
  assert.match(entrypoint, /route\(\/\^lab-rentals\\\/\(\[\^\/\]\+\)\$\/, \["PATCH"\], labRentalById\)/);

  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.ok(config.rewrites.some((rewrite) =>
    rewrite.source === "/api/admin/lab-rentals/:id"
      && rewrite.destination === "/api/admin/lab-rentals?adminPath=lab-rentals/:id"
  ));

  let received;
  const router = createAdminRouter([{
    pattern: /^lab-rentals\/([^/]+)$/,
    methods: new Set(["PATCH", "OPTIONS"]),
    handler: (req, res) => { received = req; return res.status(200).json({ ok: true }); },
  }]);
  const res = response();
  await router({ method: "PATCH", url: `/api/admin/lab-rentals?adminPath=lab-rentals/${rentalId}`, query: { path: ["lab-rentals"], adminPath: `lab-rentals/${rentalId}` } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(received.query.id, rentalId);

});

test("Vercel rewrite and Admin router dispatch a realistic rental UUID launch PUT", async () => {
  const rentalId = "8f6f91a8-2618-4e75-a662-f916fbdb7d4e";
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.ok(config.rewrites.some((rewrite) =>
    rewrite.source === "/api/admin/lab-rentals/:id/launch-configuration"
      && rewrite.destination === "/api/admin/lab-rentals?adminPath=lab-rentals/:id/launch-configuration"
  ));

  const router = createAdminRouter([]);
  const res = response();
  await router({
    method: "PUT",
    url: `/api/admin/lab-rentals?adminPath=lab-rentals/${rentalId}/launch-configuration`,
    headers: {},
    query: { path: ["lab-rentals"], adminPath: `lab-rentals/${rentalId}/launch-configuration` },
  }, res);
  assert.notEqual(res.statusCode, 404);
  assert.notEqual(res.statusCode, 405);
  assert.equal(typeof res.body?.error, "string");
});
test("router dispatches OPTIONS and preserves PATCH CORS", async () => {
  const router = createAdminRouter([{ pattern: /^courses$/, methods: new Set(["GET", "OPTIONS"]), handler: (_req, res) => res.status(200).end() }]);
  const res = response();
  await router({ method: "OPTIONS", url: "/api/admin/courses", query: { path: ["courses"] } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["Access-Control-Allow-Methods"], /PATCH/);
});

test("student access rewrite dispatches POST with the exact realistic rental UUID", async () => {
  const rentalId = "8f6f91a8-2618-4e75-a662-f916fbdb7d4e";
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.ok(config.rewrites.some((rewrite) =>
    rewrite.source === "/api/lab-rentals/:id/access"
      && rewrite.destination === "/api/lab-rentals/free-claim?studentLabPath=:id/access"
  ));

  let rpcCall;
  const router = createStudentLabRouter(async () => ({
    user: { id: "student-123" },
    supabase: {
      rpc: async (name, args) => {
        rpcCall = { name, args };
        return { data: [{ provider: "guacamole_test", launch_url: "https://example.test/guacamole/" }], error: null };
      },
    },
  }));
  const res = response();
  await router({
    method: "POST",
    url: `/api/lab-rentals/free-claim?studentLabPath=${rentalId}/access`,
    headers: { authorization: "Bearer verified-token" },
    query: { path: ["free-claim"], studentLabPath: `${rentalId}/access` },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { launchUrl: "https://example.test/guacamole/" });
  assert.deepEqual(rpcCall, {
    name: "get_authorized_lab_launch",
    args: { p_student_id: "student-123", p_rental_id: rentalId },
  });
});

test("student access route still requires authentication", async () => {
  const rentalId = "8f6f91a8-2618-4e75-a662-f916fbdb7d4e";
  const router = createStudentLabRouter();
  const res = response();
  await router({
    method: "POST",
    url: `/api/lab-rentals/free-claim?studentLabPath=${rentalId}/access`,
    headers: {},
    query: { path: ["free-claim"], studentLabPath: `${rentalId}/access` },
  }, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Unauthorized" });
});

test("student router preserves unknown-route 404 behavior", async () => {
  const router = createStudentLabRouter(async () => ({ user: { id: "student-123" }, supabase: {} }));
  const res = response();
  await router({
    method: "POST",
    url: "/api/lab-rentals/free-claim?studentLabPath=unknown",
    headers: { authorization: "Bearer verified-token" },
    query: { path: ["free-claim"], studentLabPath: "unknown" },
  }, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: "Not found" });
});
