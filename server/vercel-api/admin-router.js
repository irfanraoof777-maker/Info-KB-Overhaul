import { setCors } from "./_utils/auth.js";
import labRentalLaunchConfiguration from "./admin/lab-rentals/launch-configuration.js";

export function normalizedAdminPath(req) {
  const requested = req.query?.path;
  const raw = Array.isArray(requested)
    ? requested.join("/")
    : typeof requested === "string"
      ? requested
      : new URL(req.url ?? "/", "http://localhost").pathname.replace(/^\/api\/admin\/?/, "");
  const path = raw.replace(/^\/+|\/+$/g, "");
  if (!path || path.includes("\\") || path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }
  return path;
}

export function createAdminRouter(routes) {
  return async function adminRouter(req, res) {
    setCors(res);
    const path = normalizedAdminPath(req);
    if (!path) return res.status(404).json({ error: "Not found" });

    const launchConfigurationMatch = path.match(/^lab-rentals\/([^/]+)\/launch-configuration$/);
    if (launchConfigurationMatch) {
      if (req.method !== "PUT" && req.method !== "OPTIONS") return res.status(405).json({ error: "Method not allowed" });
      req.query = { ...(req.query ?? {}), id: launchConfigurationMatch[1] };
      return labRentalLaunchConfiguration(req, res);
    }

    for (const entry of routes) {
      const match = path.match(entry.pattern);
      if (!match) continue;
      if (!entry.methods.has(req.method)) return res.status(405).json({ error: "Method not allowed" });
      if (match[1]) req.query = { ...(req.query ?? {}), id: match[1] };
      return entry.handler(req, res);
    }
    return res.status(404).json({ error: "Not found" });
  };
}
