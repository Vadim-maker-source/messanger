/**
 * Helpers для стикеров: загрузка в S3, валидация, slug-генерация.
 *
 * Стикеры храним в Yandex Object Storage в отдельной "папке" `stickers/`,
 * чтобы можно было настроить отдельные политики кэширования.
 */

import { randomBytes } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Лимиты под стикеры
const MAX_STICKER_SIZE = 50 * 1024 * 1024; // 50 МБ
const STICKER_MIME = new Set<string>([
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpeg",
]);
const STICKER_EXT = new Set<string>(["png", "webp", "gif", "jpg", "jpeg"]);
const MAX_STICKERS_PER_PACK = 120;

// Лимит обложки — обычное изображение (превью пака)
const MAX_COVER_SIZE = 5 * 1024 * 1024; // 5 МБ

const s3Client = new S3Client({
  endpoint: process.env.YANDEX_ENDPOINT?.trim() || "https://storage.yandexcloud.net",
  region: process.env.YANDEX_REGION || "ru-central1",
  credentials: {
    accessKeyId: process.env.YANDEX_ACCESS!,
    secretAccessKey: process.env.YANDEX_SECRET!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.YANDEX_BUCKET!;

interface ValidateResult {
  ok: boolean;
  error?: string;
}

export function validateStickerFile(file: File): ValidateResult {
  if (!file || file.size === 0) return { ok: false, error: "Пустой файл" };
  if (file.size > MAX_STICKER_SIZE) {
    return { ok: false, error: `Стикер должен быть меньше ${Math.round(MAX_STICKER_SIZE / 1024 / 1024)} МБ` };
  }
  const mime = (file.type || "").toLowerCase();
  if (mime && !STICKER_MIME.has(mime)) {
    return { ok: false, error: `Поддерживаются только PNG, WEBP, GIF, JPG` };
  }
  const dot = file.name.lastIndexOf(".");
  if (dot > 0) {
    const ext = file.name.slice(dot + 1).toLowerCase();
    if (!STICKER_EXT.has(ext)) {
      return { ok: false, error: "Расширение должно быть .png, .webp, .gif или .jpg" };
    }
  }
  return { ok: true };
}

export function validateCoverFile(file: File): ValidateResult {
  if (!file || file.size === 0) return { ok: false, error: "Пустой файл" };
  if (file.size > MAX_COVER_SIZE) {
    return { ok: false, error: `Обложка должна быть меньше ${Math.round(MAX_COVER_SIZE / 1024)} КБ` };
  }
  const mime = (file.type || "").toLowerCase();
  if (mime && !STICKER_MIME.has(mime) && mime !== "image/jpeg") {
    return { ok: false, error: "Поддерживаются только PNG, WEBP, GIF, JPEG" };
  }
  return { ok: true };
}

/** Загружает стикер в S3 и возвращает публичный URL. */
export async function uploadSticker(file: File, packId: string): Promise<string> {
  const v = validateStickerFile(file);
  if (!v.ok) throw new Error(v.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  const dot = file.name.lastIndexOf(".");
  const ext = (dot > 0 ? file.name.slice(dot + 1) : "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";

  const key = `stickers/${packId}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const contentType = STICKER_MIME.has(file.type) ? file.type : `image/${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `https://storage.yandexcloud.net/${BUCKET}/${key}`;
}

/** Загружает обложку пака в S3. */
export async function uploadStickerPackCover(file: File, packId: string): Promise<string> {
  const v = validateCoverFile(file);
  if (!v.ok) throw new Error(v.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  const dot = file.name.lastIndexOf(".");
  const ext = (dot > 0 ? file.name.slice(dot + 1) : "png").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "png";

  const key = `stickers/${packId}/cover-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const contentType = file.type || `image/${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `https://storage.yandexcloud.net/${BUCKET}/${key}`;
}

/** Удаляет файл стикера из S3 (best-effort, не падает если не получилось). */
export async function deleteStickerFile(url: string): Promise<void> {
  try {
    const prefix = `https://storage.yandexcloud.net/${BUCKET}/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // ignore — файл может уже не существовать
  }
}

/** Генерирует slug из имени пака и случайного хвоста. */
export function makePackSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[ёЁ]/g, "е")
    .replace(/[^a-zа-я0-9-_\s]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32) || "pack";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export const STICKER_LIMITS = {
  MAX_STICKER_SIZE,
  MAX_COVER_SIZE,
  MAX_STICKERS_PER_PACK,
};
