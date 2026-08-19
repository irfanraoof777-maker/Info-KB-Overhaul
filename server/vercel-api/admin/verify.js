import { isValidAdminCredentials, setCors } from "../_utils/auth.js";

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { username, password } = req.body ?? {};
  if (await isValidAdminCredentials(username, password)) return res.status(200).json({ ok: true });
  return res.status(401).json({ error: "Invalid admin credentials." });
}