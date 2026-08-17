import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FX_BUFFER_PERCENT, payableUsdPrice, usdToBufferedInrPaise, usdToInrPaise } from "../server/vercel-api/_utils/usd-inr-rate.js";
import { createRazorpayLabOrderHandler, isCurrentRental } from "../server/vercel-api/razorpay-lab-orders.js";

const source = readFileSync("server/vercel-api/razorpay-lab-orders.js", "utf8");
const migration = readFileSync("supabase/migrations/20260825_add_razorpay_fx_snapshots.sql", "utf8");
function response() { return { statusCode: 200, body: undefined, setHeader() {}, status(code) { this.statusCode=code; return this; }, json(body) { this.body=body; return this; } }; }

test("USD pricing selects regular, discounted, and regular for invalid discounts", () => {
  assert.deepEqual(payableUsdPrice({ price_usd:"200.00", discounted_price_usd:null }), { usdAmount:"200.00", usdPriceType:"regular" });
  assert.deepEqual(payableUsdPrice({ price_usd:"200.00", discounted_price_usd:"159.99" }), { usdAmount:"159.99", usdPriceType:"discounted" });
  assert.deepEqual(payableUsdPrice({ price_usd:"200.00", discounted_price_usd:"200.00" }), { usdAmount:"200.00", usdPriceType:"regular" });
});
test("USD-to-INR conversion applies exact 2% buffer and rounds deterministically to paise", () => {
  assert.equal(FX_BUFFER_PERCENT, 2);
  assert.equal(usdToInrPaise("200.00", "95.7219"), 1914438);
  assert.equal(usdToBufferedInrPaise("200.00", "95.7219"), 1952727);
  assert.equal(usdToBufferedInrPaise("0.01", "1.225490196"), 1);
});
test("order endpoint accepts only labId; prices, FX rates, and currencies are never browser inputs", async () => {
  const handler=createRazorpayLabOrderHandler({ authenticate:async(_q,r)=>{r.status(401).json({error:"Unauthorized"});return null;} }); const out=response();
  await handler({method:"POST",body:{labId:"f5507a29-b7fc-4d7a-b027-52921a9d679c",amount:1}},out); assert.equal(out.statusCode,401);
  assert.match(source,/Object\.keys\(body\)\.length !== 1/); assert.match(source,/price_usd, discounted_price_usd/);
  assert.doesNotMatch(source,/price_inr, discounted_price_inr/); assert.doesNotMatch(source,/body\.amount|body\.currency|body\.(fx|exchange)/i);
});
test("free Labs retain the separate flow and current rentals retain their existing behavior", () => {
  assert.deepEqual(payableUsdPrice({price_usd:"0.00",discounted_price_usd:null}),{usdAmount:"0.00",usdPriceType:"regular"});
  assert.equal(isCurrentRental({state:"preparing"}),true); assert.equal(isCurrentRental({state:"cancelled"}),false);
});
test("FX snapshots are persisted without changing applied migrations or verification", () => {
  assert.match(migration,/source_usd_amount/); assert.match(migration,/usd_inr_rate/); assert.match(migration,/fx_buffer_percent/); assert.match(migration,/base_inr_amount/); assert.match(migration,/fx_provider/); assert.match(migration,/conversion_created_at/);
  assert.match(source,/getUsdInrRate/); assert.match(source,/amount_minor: amountMinor/); assert.match(source,/source_usd_amount/);
  const verify=readFileSync("server/vercel-api/razorpay-payment-verification.js","utf8"); assert.match(verify,/payment\.amount === order\.amount_minor/); assert.doesNotMatch(verify,/getUsdInrRate|usdToBufferedInrPaise/);
});
test("open-order reuse comes before FX retrieval and retains its stored snapshot", () => {
  assert.ok(source.indexOf('if (!order) {') < source.indexOf('const fx = await getUsdInrRate'));
  assert.match(source,/if \(!order\.razorpay_order_id\)/);
});