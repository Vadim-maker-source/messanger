"use server";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";

// ─── Конфигурация безопасности ──────────────────────────────────────────────

const MAX_FILE_SIZE = 1000 * 1024 * 1024; // 1000 МБ — для длинных HD-видео

// Whitelist MIME-типов. Всё остальное отвергается.
// Не разрешаем: text/html, image/svg+xml (XSS), application/x-* (исполняемые)
const ALLOWED_MIME = new Set<string>([
  // Изображения (без svg!)
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  // Видео
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
  // Аудио
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/x-wav",
  // Документы
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "text/plain",
  "text/csv",
  // Голосовые с record_*
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set<string>([
  "jpg", "jpeg", "png", "gif", "webp", "heic", "heif",
  "mp4", "mov", "mkv", "webm",
  "mp3", "m4a", "aac", "ogg", "wav",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "rar", "7z",
  "txt", "csv",
]);

// ─── S3 client ───────────────────────────────────────────────────────────────

const s3Client = new S3Client({
  endpoint: process.env.YANDEX_ENDPOINT?.trim() || "https://storage.yandexcloud.net",
  region: process.env.YANDEX_REGION || "ru-central1",
  credentials: {
    accessKeyId: process.env.YANDEX_ACCESS!,
    secretAccessKey: process.env.YANDEX_SECRET!,
  },
  forcePathStyle: true,
});

// ─── Санитизация имени файла ─────────────────────────────────────────────────

/**
 * Очищает имя файла от опасных символов, оставляя только безопасные.
 * Защищает от:
 *  • path traversal (../, абсолютные пути)
 *  • zero-width / control символов
 *  • кириллицы и emoji в S3-ключе (заменяет на _ для совместимости)
 */
function sanitizeFileName(raw: string): { base: string; ext: string } {
  // Убираем любую структуру пути
  const justName = raw.split(/[\\/]/).pop() || "file";

  // Разделяем на base + ext
  const lastDot = justName.lastIndexOf(".");
  let base = lastDot > 0 ? justName.slice(0, lastDot) : justName;
  let ext = lastDot > 0 ? justName.slice(lastDot + 1).toLowerCase() : "";

  // Чистим расширение — только ASCII буквы/цифры
  ext = ext.replace(/[^a-z0-9]/gi, "").slice(0, 10);

  // Чистим имя — оставляем буквы/цифры/дефисы/подчеркивания
  // Кириллица и пробелы → _
  base = base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);

  // Не должно начинаться с точки/пробела/дефиса
  base = base.replace(/^[._\-\s]+/, "");

  if (!base) base = "file";

  return { base, ext };
}

// ─── Проверка типа файла ─────────────────────────────────────────────────────

interface ValidationResult {
  ok: boolean;
  error?: string;
}

function validateFile(file: File): ValidationResult {
  if (file.size === 0) return { ok: false, error: "Пустой файл" };
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `Файл больше ${MAX_FILE_SIZE / (1024 * 1024)} МБ` };
  }

  // Проверка MIME
  const mime = (file.type || "").toLowerCase();
  if (mime && !ALLOWED_MIME.has(mime)) {
    return { ok: false, error: `Тип файла не поддерживается: ${mime}` };
  }

  // Проверка расширения
  const lastDot = file.name.lastIndexOf(".");
  if (lastDot > 0) {
    const ext = file.name.slice(lastDot + 1).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { ok: false, error: `Расширение не поддерживается: .${ext}` };
    }
  }

  return { ok: true };
}

// ─── Загрузка ────────────────────────────────────────────────────────────────

export async function uploadChatImage(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) return null;

  // ВАЛИДАЦИЯ — без неё нельзя
  const v = validateFile(file);
  if (!v.ok) {
    throw new Error(v.error || "Файл не прошёл проверку");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { base, ext } = sanitizeFileName(file.name);

  const safeFileName = ext ? `${base}.${ext}` : base;
  const fileKey = `uploads/${Date.now()}-${randomBytes(8).toString("hex")}-${safeFileName}`;

  // Принудительно подставляем content-type из whitelist (не доверяем клиенту)
  const safeContentType = ALLOWED_MIME.has(file.type || "")
    ? file.type
    : "application/octet-stream";

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.YANDEX_BUCKET!,
      Key: fileKey,
      Body: buffer,
      ContentType: safeContentType,
      // Forces browser to download (вместо inline-рендеринга)
      // — защита от XSS если как-то проскочит .html
      ContentDisposition: `attachment; filename="${safeFileName}"`,
    }),
  );

  return {
    url: `https://storage.yandexcloud.net/${process.env.YANDEX_BUCKET}/${fileKey}`,
    fileName: base,
  };
}
