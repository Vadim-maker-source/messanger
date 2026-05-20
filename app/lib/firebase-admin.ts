import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    let raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? "{}";
    // Vercel sometimes wraps the value in extra quotes
    if (raw.startsWith('"') && raw.endsWith('"')) {
      raw = raw.slice(1, -1).replace(/\\"/g, '"');
    }
    const serviceAccount = JSON.parse(raw);
    if (serviceAccount.project_id) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      console.warn("[FCM] FIREBASE_SERVICE_ACCOUNT_KEY is missing or invalid");
    }
  } catch (e) {
    console.error("[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
  }
}

export function getMessaging() {
  if (!admin.apps.length) return null;
  return admin.messaging();
}

export async function sendPushNotification({
  token,
  title,
  body,
  data,
}: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const messaging = getMessaging();
  if (!messaging) return;
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data,
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "calls" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
    });
  } catch (err) {
    console.error("[FCM] send error:", err);
  }
}
