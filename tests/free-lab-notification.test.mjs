import assert from "node:assert/strict";
import test from "node:test";

import { sendFreeLabNotification } from "../server/vercel-api/_utils/free-lab-notification.js";
import { createStudentLabRouter } from "../server/vercel-api/student-lab-router.js";

function response() {
  return { setHeader() {}, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

const rental = {
  id: "8f6f91a8-2618-4e75-a662-f916fbdb7d4e", user_id: "student-123", lab_id: "0f6f91a8-2618-4e75-a662-f916fbdb7d4e",
  state: "preparing", source: "free_trial", created_at: "2026-08-17T00:00:00.000Z",
};

test("Resend free-lab notification uses a deterministic idempotency key", async () => {
  const previous = [process.env.RESEND_API_KEY, process.env.FREE_LAB_NOTIFICATION_FROM, process.env.FREE_LAB_NOTIFICATION_TO];
  process.env.RESEND_API_KEY = "test-key";
  process.env.FREE_LAB_NOTIFICATION_FROM = "InfoKB <notifications@example.test>";
  process.env.FREE_LAB_NOTIFICATION_TO = "support@example.test";
  let request;
  try {
    await sendFreeLabNotification({
      rental, user: { email: "student@example.test", user_metadata: { full_name: "Student Name" } },
      lab: { title: "Linux Lab", duration: "7 days" },
      fetchImpl: async (...args) => { request = args; return { ok: true, status: 200 }; },
    });
    assert.equal(request[0], "https://api.resend.com/emails");
    assert.equal(request[1].headers["Idempotency-Key"], `free-lab-rental-${rental.id}`);
    assert.match(request[1].body, /New Free Lab Rental - Linux Lab/);
    assert.match(request[1].body, /Requested At: 2026-08-17T00:00:00.000Z/);
  } finally {
    [process.env.RESEND_API_KEY, process.env.FREE_LAB_NOTIFICATION_FROM, process.env.FREE_LAB_NOTIFICATION_TO] = previous;
  }
});
