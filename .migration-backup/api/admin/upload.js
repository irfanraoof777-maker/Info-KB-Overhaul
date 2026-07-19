import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { checkBasicAuth, setCors } from "../_utils/auth.js";

export const config = { api: { bodyParser: true } };

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
    const { fileName, fileType } = req.body ?? {};
    if (!fileName || !fileType) {
      return res.status(400).json({ error: "fileName and fileType are required." });
    }

    const ext = fileName.split(".").pop() ?? "bin";
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { client, bucket } = getR2Client();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
    });

    // Presigned URL valid for 60 minutes (large video uploads may take time)
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

    const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "")}/${key}`;

    return res.status(200).json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error("[upload] Error generating presigned URL:", err);
    return res.status(500).json({ error: err.message ?? "Failed to generate upload URL." });
  }
}
