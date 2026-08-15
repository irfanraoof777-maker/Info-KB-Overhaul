export function parseOptionalDate(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${fieldName} must be an ISO date string or null.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${fieldName} must be a valid ISO date string.`);
  return date.toISOString();
}

export function validateWindow(startsAt, expiresAt) {
  if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
    throw new Error("Expiry must be later than the start time.");
  }
}

export function effectiveLabStatus(rental, now = new Date()) {
  if (rental.state === "cancelled") return "cancelled";
  if (rental.expires_at && new Date(rental.expires_at) <= now) return "expired";
  return rental.state;
}

export function canAccessLab(rental, now = new Date()) {
  return rental.state === "ready"
    && (!rental.starts_at || new Date(rental.starts_at) <= now)
    && Boolean(rental.expires_at && new Date(rental.expires_at) > now)
    && !rental.cancelled_at;
}

export async function requireExistingUser(supabase, userId) {
  if (typeof userId !== "string" || !userId) throw new Error("A valid student is required.");
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error("Student not found.");
  return data.user;
}

export async function requireExistingRow(supabase, table, id, label) {
  if (typeof id !== "string" || !id) throw new Error(`A valid ${label} is required.`);
  const { data, error } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  if (error || !data) throw new Error(`${label[0].toUpperCase()}${label.slice(1)} not found.`);
  return data;
}
