import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSupabaseAdmin } from "./supabase.js";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

export async function hashAdminPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyAdminPassword(password, storedHash) {
  const [algorithm, salt, encodedHash] = String(storedHash ?? "").split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, "base64url");
  const actual = Buffer.from(await scrypt(password, salt, expected.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function basicCredentials(req) {
  const authHeader = req.headers?.authorization ?? "";
  if (!authHeader.startsWith("Basic ")) return null;
  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const colonIndex = decoded.indexOf(":");
  if (colonIndex < 0) return null;
  return { username: decoded.slice(0, colonIndex), password: decoded.slice(colonIndex + 1) };
}

export async function isValidAdminCredentials(username, password) {
  const expectedUser = process.env.ADMIN_USERNAME;
  const fallbackPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUser || typeof username !== "string" || typeof password !== "string") return false;
  if (username !== expectedUser) return false;

  // Local/test environments without Supabase retain the legacy environment credential.
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    try {
      const { data, error } = await getSupabaseAdmin().from("admin_auth_settings").select("password_hash").eq("id", true).maybeSingle();
      if (error) {
        // The only safe compatibility case is a deployment where this reviewed migration has not yet been applied.
        if (error.code !== "PGRST205" && error.code !== "42P01") return false;
      } else if (data?.password_hash) {
        return verifyAdminPassword(password, data.password_hash);
      }
    } catch (error) {
      console.error("[admin-auth] unable to read persisted credentials", error);
      return false;
    }
  }

  if (!fallbackPassword) return false;
  const passwordBuffer = Buffer.from(password);
  const fallbackBuffer = Buffer.from(fallbackPassword);
  return passwordBuffer.length === fallbackBuffer.length && timingSafeEqual(passwordBuffer, fallbackBuffer);
}

export async function checkBasicAuth(req, res) {
  const credentials = basicCredentials(req);
  if (!credentials || !(await isValidAdminCredentials(credentials.username, credentials.password))) {
    res.status(401).json({ error: "Invalid admin credentials." });
    return false;
  }
  return true;
}

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}