const STATUSES = new Set(["draft", "published", "cancelled", "completed"]);
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (value, name, max = 20000, required = false) => { if (value == null) return undefined; if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(`${name} is invalid.`); return value.trim(); };
const jsonList = (value, name) => { if (value == null) return undefined; if (!Array.isArray(value)) throw new Error(`${name} must be a list.`); return value; };
export function normalizeLiveClass(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid live class payload.");
  const result = {};
  for (const [key, max] of [["title", 200], ["slug", 180], ["short_description", 600], ["description", 20000], ["thumbnail_url", 2000], ["instructor", 200], ["instructor_linkedin_url", 2000], ["instructor_bio", 5000], ["duration", 200], ["timezone", 100]]) { const value = text(body[key], key, max, !partial && ["title", "slug"].includes(key)); if (value !== undefined) result[key] = value; }
  if (result.slug && !slug.test(result.slug)) throw new Error("slug is invalid."); if (result.instructor_linkedin_url) { try { const url = new URL(result.instructor_linkedin_url); if (!["https:", "http:"].includes(url.protocol) || !/linkedin\.com$/i.test(url.hostname) && !/\.linkedin\.com$/i.test(url.hostname)) throw new Error(); } catch { throw new Error("instructor_linkedin_url is invalid."); } }
  if (body.price_inr != null) { const value = Number(body.price_inr); if (!Number.isFinite(value) || value <= 0 || value > 10000000) throw new Error("price_inr is invalid."); result.price_inr = value; }
  if (body.status != null) { if (!STATUSES.has(body.status)) throw new Error("status is invalid."); result.status = body.status; }
  if (body.registration_open != null) { if (typeof body.registration_open !== "boolean") throw new Error("registration_open is invalid."); result.registration_open = body.registration_open; }
  if (body.featured != null) { if (typeof body.featured !== "boolean") throw new Error("featured is invalid."); result.featured = body.featured; }
  for (const key of ["prerequisites", "what_you_learn", "curriculum"]) { const value = jsonList(body[key], key); if (value !== undefined) result[key] = value; }
  if (!partial && (!result.title || !result.slug || result.price_inr == null)) throw new Error("title, slug, and price_inr are required.");
  return result;
}
export function normalizeSessions(value) {
  if (value == null) return null; if (!Array.isArray(value)) throw new Error("sessions must be a list.");
  return value.map((session) => { if (!session || typeof session !== "object") throw new Error("Session is invalid."); const startsAt = new Date(session.starts_at); const endsAt = new Date(session.ends_at); if (Number.isNaN(+startsAt) || Number.isNaN(+endsAt) || endsAt <= startsAt) throw new Error("Session dates are invalid."); const timezone = text(session.timezone ?? "Asia/Kolkata", "session timezone", 100, true); const meetingUrl = text(session.meeting_url, "meeting_url", 2000); if (meetingUrl) { try { const url = new URL(meetingUrl); if (!["https:", "http:"].includes(url.protocol)) throw new Error(); } catch { throw new Error("meeting_url is invalid."); } } return { session_title: text(session.session_title ?? "", "session_title", 200) ?? "", starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), timezone, ...(meetingUrl ? { meeting_url: meetingUrl } : {}) }; });
}