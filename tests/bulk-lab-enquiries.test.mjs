import assert from "node:assert/strict";
import test from "node:test";
import {
  createBulkLabEnquiryHandler,
  sendBulkLabEnquiryEmail,
} from "../server/vercel-api/bulk-lab-enquiries.js";
function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
function handler({
  labs = [{ id: "lab-1", title: "Authoritative Cloud Lab" }],
  sendEmail = async () => {},
} = {}) {
  return createBulkLabEnquiryHandler({
    getAdmin: () => ({
      from: () => ({
        select: () => ({ eq: async () => ({ data: labs, error: null }) }),
      }),
    }),
    sendEmail,
  });
}
const valid = {
  enquiryType: "bulk_lab",
  name: "Asha Kumar",
  email: "asha@example.com",
  phone: "+91 12345",
  companyName: "Example Institute",
  organizationType: "Educational institution",
  userRange: "26-50",
  labIds: ["lab-1", "other"],
  otherLabDescription: "A private AI lab",
  message: "Please share pricing.",
};
test("bulk enquiry uses enabled authoritative lab titles and accepts Other alongside labs", async () => {
  let sent;
  const res = response();
  await handler({
    sendEmail: async (enquiry) => {
      sent = enquiry;
    },
  })({ method: "POST", body: { ...valid, labTitle: "Untrusted title" } }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(sent.labTitles, ["Authoritative Cloud Lab"]);
  assert.equal(sent.otherSelected, true);
  assert.equal(sent.otherLabDescription, "A private AI lab");
});
test("bulk enquiry rejects invalid selections and missing Other description", async () => {
  const missingOther = response();
  await handler()(
    { method: "POST", body: { ...valid, otherLabDescription: "" } },
    missingOther,
  );
  assert.equal(missingOther.statusCode, 400);
  assert.match(missingOther.body.error, /Describe/);
  const disabledLab = response();
  await handler()(
    { method: "POST", body: { ...valid, labIds: ["disabled-lab"] } },
    disabledLab,
  );
  assert.equal(disabledLab.statusCode, 400);
  assert.match(disabledLab.body.error, /unavailable/);
});
test("bulk enquiry validates enum fields and request method", async () => {
  const enumRes = response();
  await handler()(
    { method: "POST", body: { ...valid, organizationType: "Anything" } },
    enumRes,
  );
  assert.equal(enumRes.statusCode, 400);
  const methodRes = response();
  await handler()({ method: "GET", body: valid }, methodRes);
  assert.equal(methodRes.statusCode, 405);
});
test("bulk enquiry email uses customer reply-to and contains no duration", async () => {
  const previous = [
    process.env.RESEND_API_KEY,
    process.env.BULK_LAB_ENQUIRY_FROM,
    process.env.BULK_LAB_ENQUIRY_TO,
  ];
  process.env.RESEND_API_KEY = "test";
  process.env.BULK_LAB_ENQUIRY_FROM = "InfoKB <test@example.test>";
  process.env.BULK_LAB_ENQUIRY_TO = "team@example.test";
  let request;
  try {
    await sendBulkLabEnquiryEmail(
      {
        name: "Asha",
        email: "asha@example.com",
        phone: "",
        companyName: "Example",
        organizationType: "Company",
        userRange: "11-25",
        labTitles: ["Cloud Lab"],
        otherSelected: false,
        message: "Need access",
      },
      async (...args) => {
        request = args;
        return { ok: true };
      },
    );
    const body = JSON.parse(request[1].body);
    assert.equal(body.reply_to, "asha@example.com");
    assert.match(body.text, /Enquiry Type: Corporate \/ Bulk Lab Rental/);
    assert.doesNotMatch(body.text, /duration/i);
  } finally {
    [
      process.env.RESEND_API_KEY,
      process.env.BULK_LAB_ENQUIRY_FROM,
      process.env.BULK_LAB_ENQUIRY_TO,
    ] = previous;
  }
});
