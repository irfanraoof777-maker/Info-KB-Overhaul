export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return res.status(500).json({ error: "Admin credentials not configured on server." });
  }

  const { username, password } = req.body ?? {};

  if (username === expectedUser && password === expectedPass) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: "Invalid admin credentials." });
}
