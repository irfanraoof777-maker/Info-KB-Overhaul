import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("artifacts/infokb/src/pages/LabDetail.tsx", "utf8");

test("paid Lab purchase requests a server-authoritative Razorpay order", () => {
  assert.match(page, /fetch\("\/api\/lab-payments\/razorpay\/order"/);
  assert.match(page, /Authorization: `Bearer \$\{session\.access_token\}`/);
  assert.match(page, /body: JSON\.stringify\(\{ labId: lab\.id \}\)/);
  assert.doesNotMatch(page, /JSON\.stringify\(\{[^}]*amount|JSON\.stringify\(\{[^}]*currency/);
});

test("Checkout uses only safe returned order fields and the official script", () => {
  assert.match(page, /https:\/\/checkout\.razorpay\.com\/v1\/checkout\.js/);
  assert.match(page, /if \(razorpayScriptPromise\) return razorpayScriptPromise/);
  assert.match(page, /key: order\.keyId/);
  assert.match(page, /order_id: order\.razorpayOrderId/);
  assert.match(page, /amount: order\.amount/);
  assert.match(page, /currency: order\.currency/);
  assert.match(page, /description: order\.labTitle/);
  assert.doesNotMatch(page, /RAZORPAY_KEY_SECRET|VITE_.*RAZORPAY/);
});

test("terms gate, USD catalog display, and free-Lab behavior remain intact", () => {
  assert.match(page, /disabled=\{claiming \|\| purchasing \|\| !hasAcceptedTerms\}/);
  assert.match(page, /if \(!supabase \|\| purchasing \|\| !hasAcceptedTerms\) return/);
  assert.match(page, /formatUSDPrice\(effectivePrice\)/);
  assert.match(page, /isFree \? void claimFreeLab\(\) : void purchaseLab\(\)/);
  assert.match(page, /\/api\/lab-rentals\/free-claim/);
});

test("client checkout callback is temporary and never fulfills payment or access", () => {
  assert.match(page, /setCheckoutResult\(checkoutResponse\)/);
  assert.match(page, /Test payment received\. Verification pending\./);
  assert.match(page, /ondismiss: \(\) => setCheckoutStatus\("Checkout dismissed\./);
  assert.match(page, /script\.onerror/);
  assert.doesNotMatch(page, /lab_rentals|lab_payment_orders|dashboard-access|payment.*paid/i);
});