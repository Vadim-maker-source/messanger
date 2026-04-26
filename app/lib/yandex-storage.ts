"use server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";

const s3Client = new S3Client({
  endpoint: process.env.YANDEX_ENDPOINT?.trim() || "https://storage.yandexcloud.net",
  region: process.env.YANDEX_REGION || "ru-central1",
  credentials: {
    accessKeyId: process.env.YANDEX_ACCESS!,
    secretAccessKey: process.env.YANDEX_SECRET!,
  },
  forcePathStyle: true,
});

export async function uploadChatImage(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = `uploads/${Date.now()}-${randomBytes(4).toString('hex')}-${file.name}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.YANDEX_BUCKET!,
    Key: fileKey,
    Body: buffer,
    ContentType: file.type,
  }));

  return `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET}/${fileKey}`;
}