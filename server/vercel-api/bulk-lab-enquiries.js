import { getSupabaseAdmin } from "./_utils/supabase.js";
export const ORGANIZATION_TYPES = new Set([
  "Company",
  "Educational institution",
  "Government organization",
  "Non-profit organization",
  "Training provider",
  "Other",
]);
export const USER_RANGES = new Set([
  "1-10",
  "11-25",
  "26-50",
  "51-100",
  "101-250",
  "251-500",
  "500+",
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
export async function sendBulkLabEnquiryEmail(enquiry, fetchImpl = fetch) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.BULK_LAB_ENQUIRY_FROM || process.env.FREE_LAB_NOTIFICATION_FROM;
  const to =
    process.env.BULK_LAB_ENQUIRY_TO ||
    process.env.PAID_LAB_NOTIFICATION_TO ||
    "support@infokb.com";
  if (!apiKey || !from)
    throw new Error("Bulk enquiry email configuration is missing.");
  const lines = [
    "Enquiry Type: Corporate / Bulk Lab Rental",
    "",
    `Name: ${enquiry.name}`,
    `Email: ${enquiry.email}`,
    `Phone: ${enquiry.phone || "Not provided"}`,
    `Company / Institution: ${enquiry.companyName}`,
    `Organization Type: ${enquiry.organizationType}`,
    `Number of Users: ${enquiry.userRange}`,
    `Labs Requested: ${enquiry.labTitles.join(", ")}${enquiry.otherSelected ? ", Other" : ""}`,
    ...(enquiry.otherSelected
      ? [`Other Lab Requirement: ${enquiry.otherLabDescription}`]
      : []),
    `Message / Requirements: ${enquiry.message || "Not provided"}`,
  ];
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "infokb-bulk-lab-enquiry/1.0",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: enquiry.email,
      subject: `Corporate / Bulk Lab Rental Enquiry - ${enquiry.companyName}`,
      text: lines.join("\n"),
    }),
  });
  if (!response.ok) throw new Error("Enquiry email could not be delivered.");
}
export function createBulkLabEnquiryHandler({
  getAdmin = getSupabaseAdmin,
  sendEmail = sendBulkLabEnquiryEmail,
} = {}) {
  return async function bulkLabEnquiries(req, res) {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });
    try {
      const body = req.body ?? {};
      if (body.enquiryType !== "bulk_lab")
        throw validationError("Invalid enquiry type.");
      const name = text(body.name);
      const email = text(body.email);
      const phone = text(body.phone);
      const companyName = text(body.companyName);
      const organizationType = text(body.organizationType);
      const userRange = text(body.userRange);
      const message = text(body.message);
      const otherLabDescription = text(body.otherLabDescription);
      if (!name || !email || !companyName || !organizationType || !userRange)
        throw validationError("Please complete all required fields.");
      if (!EMAIL_PATTERN.test(email))
        throw validationError("Enter a valid work email address.");
      if (!ORGANIZATION_TYPES.has(organizationType))
        throw validationError("Select a valid organization type.");
      if (!USER_RANGES.has(userRange))
        throw validationError("Select a valid number of users range.");
      if (
        !Array.isArray(body.labIds) ||
        body.labIds.length === 0 ||
        body.labIds.some((id) => typeof id !== "string")
      )
        throw validationError("Select at least one lab.");
      const labIds = [...new Set(body.labIds.map(text).filter(Boolean))];
      const otherSelected = labIds.includes("other");
      const realLabIds = labIds.filter((id) => id !== "other");
      if (!realLabIds.length && !otherSelected)
        throw validationError("Select at least one lab.");
      if (otherSelected && !otherLabDescription)
        throw validationError("Describe the lab you need.");
      const supabase = getAdmin();
      const { data: enabledLabs, error: labError } = await supabase
        .from("labs")
        .select("id, title")
        .eq("enabled", true);
      if (labError) throw new Error("Enabled labs could not be loaded.");
      const labsById = new Map(
        (enabledLabs ?? []).map((lab) => [lab.id, lab.title]),
      );
      if (realLabIds.some((id) => !labsById.has(id)))
        throw validationError("One or more selected labs are unavailable.");
      const labTitles = realLabIds.map((id) => labsById.get(id));
      await sendEmail({
        name,
        email,
        phone,
        companyName,
        organizationType,
        userRange,
        message,
        otherSelected,
        otherLabDescription,
        labTitles,
      });
      return res.status(201).json({ ok: true });
    } catch (error) {
      const status =
        error.statusCode ||
        (error.message === "Bulk enquiry email configuration is missing."
          ? 503
          : 500);
      if (status >= 500)
        console.error("[bulk-lab-enquiries] request failed", error);
      return res
        .status(status)
        .json({
          error:
            status === 500
              ? "Unable to send your request. Please try again."
              : error.message,
        });
    }
  };
}
export default createBulkLabEnquiryHandler();
