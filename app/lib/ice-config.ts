/**
 * Сборка ICE-конфигурации из переменных окружения.
 *
 * Переменные:
 *   TURN_URLS        — список TURN URL через запятую, например:
 *                      "turn:turn.example.com:3478,turn:turn.example.com:443?transport=tcp"
 *   TURN_USERNAME    — логин TURN
 *   TURN_CREDENTIAL  — пароль TURN
 *   STUN_URLS        — список STUN URL через запятую (необязательно)
 *
 * Если TURN_* не заданы — пишем warning в консоль и отдаём только STUN.
 * За симметричным NAT (типичный мобильный/домашний интернет) звонки в этом
 * случае не пойдут — нужен реальный TURN.
 */

type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type IceConfigPayload = {
  iceServers: IceServer[];
  iceCandidatePoolSize: number;
  bundlePolicy: "max-bundle";
  rtcpMuxPolicy: "require";
};

const DEFAULT_STUN = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

let warned = false;

export function buildIceConfig(): IceConfigPayload {
  const stunUrls = parseList(process.env.STUN_URLS);
  const turnUrls = parseList(process.env.TURN_URLS);
  const turnUsername = process.env.TURN_USERNAME?.trim() || "";
  const turnCredential = process.env.TURN_CREDENTIAL?.trim() || "";

  const iceServers: IceServer[] = [];

  // STUN (всегда; либо из env, либо дефолт)
  iceServers.push({
    urls: stunUrls.length > 0 ? stunUrls : DEFAULT_STUN,
  });

  // TURN — только если заданы все три переменные
  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  } else if (!warned) {
    warned = true;
    console.warn(
      "[ICE] TURN_URLS/TURN_USERNAME/TURN_CREDENTIAL не заданы в .env — " +
        "звонки за симметричным NAT работать не будут. " +
        "Настройте свой TURN (например, coturn) или сервис вроде metered.ca.",
    );
  }

  return {
    iceServers,
    iceCandidatePoolSize: 2,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  };
}
