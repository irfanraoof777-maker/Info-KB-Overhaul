import { requireStudent } from "./_utils/student-auth.js";
import { sendFreeLabNotification } from "./_utils/free-lab-notification.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizedPath(req) {
  const requested = req.query?.studentLabPath ?? req.query?.path;
  const raw = Array.isArray(requested)
    ? requested.join("/")
    : typeof requested === "string"
      ? requested
      : new URL(req.url ?? "/", "http://localhost").pathname.replace(/^\/api\/lab-rentals\/?/, "");
  return raw.replace(/^\/+|\/+$/g, "");
}

function safeRental(row) {
  return {
    id: row.id, userId: row.user_id, labId: row.lab_id, state: row.state,
    source: row.source, startsAt: row.starts_at, expiresAt: row.expires_at,
    readyAt: row.ready_at, cancelledAt: row.cancelled_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function createStudentLabRouter(authenticate = requireStudent) {
  return async function studentLabRouter(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const path = normalizedPath(req);
  const auth = await authenticate(req, res);
  if (!auth) return;

  try {
    if (path === "free-claim") {
      const labId = req.body?.labId;
      if (typeof labId !== "string" || !UUID_PATTERN.test(labId)) {
        return res.status(400).json({ error: "A valid Lab ID is required." });
      }
      const { data, error } = await auth.supabase.rpc("claim_free_lab_rental", {
        p_student_id: auth.user.id, p_lab_id: labId,
      });
      if (error) {
        const message = error.message?.toLowerCase() ?? "";
        if (message.includes("unavailable")) return res.status(404).json({ error: "Lab is unavailable." });
        if (message.includes("not available for free claim")) return res.status(409).json({ error: "This Lab is not available for free claim." });
        throw error;
      }
      const rental = Array.isArray(data) ? data[0] : data;
      if (!rental) throw new Error("Free claim returned no rental.");
      if (rental.newly_created === true) {
        try {
          const { data: lab, error: labError } = await auth.supabase.from("labs")
            .select("title, duration").eq("id", rental.lab_id).maybeSingle();
          if (labError || !lab) throw new Error("Lab notification details are unavailable.");
          const result = await sendFreeLabNotification({ rental, user: auth.user, lab });
          if (!result.sent) console.warn("[free-lab-notification] notification skipped for rental", rental.id, result.reason);
        } catch (notificationError) {
          console.error("[free-lab-notification] notification failed for rental", rental.id,
            notificationError instanceof Error ? notificationError.message : "unknown error");
        }
      }
      return res.status(200).json({ rental: safeRental(rental) });
    }

    const accessMatch = path.match(/^([0-9a-f-]+)\/access$/i);
    if (accessMatch && UUID_PATTERN.test(accessMatch[1])) {
      const { data, error } = await auth.supabase.rpc("get_authorized_lab_launch", {
        p_student_id: auth.user.id, p_rental_id: accessMatch[1],
      });
      if (error) {
        if (error.message?.toLowerCase().includes("unavailable")) return res.status(403).json({ error: "Lab launch is unavailable." });
        throw error;
      }
      const launch = Array.isArray(data) ? data[0] : data;
      if (!launch?.launch_url) return res.status(403).json({ error: "Lab launch is unavailable." });
      return res.status(200).json({ launchUrl: launch.launch_url });
    }
    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    console.error("[student-labs] request failed", error);
    return res.status(500).json({ error: "Unable to complete the Lab request." });
  }
  };
}

export default createStudentLabRouter();
