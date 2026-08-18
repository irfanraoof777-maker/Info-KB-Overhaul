import { requireStudent } from "./_utils/student-auth.js";
import { getUsdInrRate, inrAmountFromPaise, payableUsdPrice, usdToInrPaise } from "./_utils/usd-inr-rate.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPEN_ORDER_STATUSES = ["creating", "created", "provider_error"];

export function isCurrentRental(rental, now = new Date()) {
  return rental.state === "payment_pending" || rental.state === "preparing"
    || (rental.state === "ready" && Boolean(rental.expires_at) && new Date(rental.expires_at) > now);
}

function safeOrderResponse(order, labTitle, keyId) {
  return {
    keyId,
    razorpayOrderId: order.razorpay_order_id,
    orderId: order.id,
    amount: order.amount_minor,
    currency: order.currency,
    labTitle,
  };
}

function razorpayAuthHeader(keyId, keySecret) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function providerRequest(request, keyId, keySecret, path, options = {}) {
  const response = await request(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: { Authorization: razorpayAuthHeader(keyId, keySecret), "Content-Type": "application/json", ...(options.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Razorpay order request failed.");
  return data;
}

async function findProviderOrder(request, keyId, keySecret, receipt) {
  const data = await providerRequest(request, keyId, keySecret, `/orders?receipt=${encodeURIComponent(receipt)}&count=1`, { method: "GET" });
  return Array.isArray(data.items) ? data.items.find((item) => item.receipt === receipt) ?? null : null;
}

export function createRazorpayLabOrderHandler({ authenticate = requireStudent, request = fetch, getFxRate = getUsdInrRate, now = () => new Date(), randomUuid = () => crypto.randomUUID() } = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const auth = await authenticate(req, res);
    if (!auth) return;

    const body = req.body ?? {};
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.labId !== "string" || !UUID_PATTERN.test(body.labId)) {
      return res.status(400).json({ error: "A valid Lab ID is required." });
    }
    const labId = body.labId;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(503).json({ error: "India payments are not configured." });

    try {
      const { data: lab, error: labError } = await auth.supabase
        .from("labs")
        .select("id, title, enabled, price_usd, discounted_price_usd")
        .eq("id", labId)
        .eq("enabled", true)
        .maybeSingle();
      if (labError) throw labError;
      if (!lab) return res.status(404).json({ error: "Lab is unavailable." });
      const { data: rentals, error: rentalError } = await auth.supabase
        .from("lab_rentals")
        .select("state, expires_at")
        .eq("user_id", auth.user.id)
        .eq("lab_id", labId)
        .in("state", ["payment_pending", "preparing", "ready"]);
      if (rentalError) throw rentalError;
      if ((rentals ?? []).some((rental) => isCurrentRental(rental, now()))) {
        return res.status(409).json({ error: "You already have a current Lab rental." });
      }

      let { data: order, error: existingError } = await auth.supabase
        .from("lab_payment_orders")
        .select("id, receipt, amount_minor, currency, razorpay_order_id, status")
        .eq("student_id", auth.user.id)
        .eq("lab_id", labId)
        .in("status", OPEN_ORDER_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;

      if (!order) {
        const pricing = payableUsdPrice(lab);
        if (pricing.usdAmount === "0" || pricing.usdAmount === "0.0" || pricing.usdAmount === "0.00") return res.status(400).json({ error: "Free Labs must use the separate free-Lab flow." });
        const fx = await getFxRate();
        const amountMinor = usdToInrPaise(pricing.usdAmount, fx.rate);
        const id = randomUuid();
        const receipt = `lpo_${id.replaceAll("-", "")}`;
        const { data, error } = await auth.supabase.from("lab_payment_orders").insert([{
          id, student_id: auth.user.id, lab_id: labId, provider: "razorpay", market: "IN", currency: "INR",
          amount_minor: amountMinor, regular_price_inr: null, discounted_price_inr: null, source_usd_amount: pricing.usdAmount, usd_price_type: pricing.usdPriceType, usd_inr_rate: fx.rate, base_inr_amount: inrAmountFromPaise(amountMinor), fx_provider: fx.provider, fx_rate_timestamp: fx.rateTimestamp, conversion_created_at: fx.fetchedAt,
          status: "creating", receipt,
        }]).select("id, receipt, amount_minor, currency, razorpay_order_id, status").single();
        if (error) {
          if (error.code !== "23505") throw error;
          const retry = await auth.supabase.from("lab_payment_orders").select("id, receipt, amount_minor, currency, razorpay_order_id, status").eq("student_id", auth.user.id).eq("lab_id", labId).in("status", OPEN_ORDER_STATUSES).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (retry.error || !retry.data) throw retry.error ?? new Error("Order creation is already in progress.");
          order = retry.data;
        } else order = data;
      }

      if (!order.razorpay_order_id) {
        const recovered = await findProviderOrder(request, keyId, keySecret, order.receipt);
        let providerOrder = recovered;
        if (!providerOrder) {
          try {
            providerOrder = await providerRequest(request, keyId, keySecret, "/orders", {
              method: "POST",
              body: JSON.stringify({ amount: order.amount_minor, currency: "INR", receipt: order.receipt, notes: { internal_order_id: order.id, lab_id: labId } }),
            });
          } catch (providerError) {
            await auth.supabase.from("lab_payment_orders").update({ status: "provider_error", last_provider_error: "order_create_failed", updated_at: new Date().toISOString() }).eq("id", order.id);
            throw providerError;
          }
        }
        const { data: updated, error: updateError } = await auth.supabase.from("lab_payment_orders")
          .update({ razorpay_order_id: providerOrder.id, status: "created", last_provider_error: null, updated_at: new Date().toISOString() })
          .eq("id", order.id)
          .select("id, receipt, amount_minor, currency, razorpay_order_id, status")
          .single();
        if (updateError) throw new Error("Order is being reconciled. Please retry shortly.");
        order = updated;
      }
      return res.status(200).json({ order: safeOrderResponse(order, lab.title, keyId) });
    } catch (error) {
      console.error("[razorpay-lab-order] failed", error instanceof Error ? error.message : "unknown error");
      return res.status(500).json({ error: error instanceof Error ? error.message : "Unable to create payment order." });
    }
  };
}

export default createRazorpayLabOrderHandler();