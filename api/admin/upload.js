import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { checkBasicAuth, setCors } from "../_utils/auth.js";

export const config = { api: { bodyParser: { sizeLimit: "500mb" } } };

function getR2Client() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY;
  const secretKey = process.env.CLOUDFLARE_R2_SECRET_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  if (!accountId || !accessKey || !secretKey || !bucket) {
    throw new Error("Missing Cloudflare R2 environment variables.");
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
  return { client, bucket };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!checkBasicAuth(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fileName, fileType, fileData } = req.body ?? {};
    if (!fileName || !fileType || !fileData) {
      return res.status(400).json({ error: "fileName, fileType, and fileData are required." });
    }

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const ext = fileName.split(".").pop() ?? "";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { client, bucket } = getR2Client();
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: uniqueName,
      Body: buffer,
      ContentType: fileType,
    }));

    const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "");
    const url = `${publicUrl}/${uniqueName}`;

    return res.status(200).json({ url });
  } catch (err) {
    console.error("[upload] Error:", err);
    return res.status(500).json({ error: err.message ?? "Upload failed." });
  }
}
