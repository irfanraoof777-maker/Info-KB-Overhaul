/**
 * POST /api/admin/upload-team-photo
 *
 * Accepts JSON { fileName, contentType }.
 * Returns { signedUrl, publicUrl } — browser PUTs file bytes directly to Supabase.
 */
import { createClient } from "@supabase/supabase-js";
import { checkBasicAuth, setCors } from "../_utils/auth.js";

export const config = { api: { bodyParser: true } };

const BUCKET = "team-member-photos";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName, contentType } = req.body ?? {};
    if (!fileName || !contentType) {
      return res.status(400).json({ error: "fileName and contentType are required." });
    }
    if (!contentType.startsWith("image/")) {
      return res.status(400).json({ error: "Only image files are allowed for team member photos." });
    }

    const supabase = getSupabase();
    const ext = (fileName.split(".").pop() ?? "jpg").toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
    if (bucketErr && !bucketErr.message.toLowerCase().includes("already exists")) {
      console.error("[upload-team-photo] bucket create error:", bucketErr.message);
    }

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return res.status(200).json({ signedUrl: data.signedUrl, path, publicUrl });
  } catch (err) {
    console.error("[upload-team-photo] error:", err);
    return res.status(500).json({ error: err.message ?? "Upload failed." });
  }
}
