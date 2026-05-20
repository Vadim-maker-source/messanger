import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? "{}";
    const serviceAccount = JSON.parse(raw);
    if (serviceAccount.project_id) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
  } catch (e) {
    console.error("[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", e);
  }
}

export const messaging = admin.messaging();

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
  try {
    await messaging.send({
      token,
      notification: { title, body },
      data,
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "messages" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
    });
  } catch (err) {
    // Токен устарел — очищаем
    console.error("[FCM] send error:", err);
  }
}
