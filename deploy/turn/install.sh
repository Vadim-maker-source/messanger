#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# coturn one-shot installer для Ubuntu 22.04 / 24.04
# ════════════════════════════════════════════════════════════════
# Что делает:
#   1. Ставит Docker + Docker Compose plugin (если ещё нет)
#   2. Генерирует случайный пароль для TURN-пользователя
#   3. Подставляет публичный IP в turnserver.conf
#   4. Открывает порты в ufw
#   5. Запускает coturn в Docker
#   6. Выводит готовые креды для .env вашего мессенджера
#
# Использование:
#   sudo bash install.sh
#
# Опции через переменные окружения:
#   TURN_USER     — имя пользователя TURN (по умолчанию "messanger")
#   TURN_REALM    — realm (по умолчанию "messanger")
#   PUBLIC_IP     — публичный IP (если автодетект ошибается)

set -euo pipefail

# ─── Цвета для вывода ────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[x]${NC} $*" >&2; exit 1; }

# ─── Проверки ────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || fail "Запусти от root: sudo bash install.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

[[ -f turnserver.conf.template ]] || fail "Не найден turnserver.conf.template рядом со скриптом"
[[ -f docker-compose.yml       ]] || fail "Не найден docker-compose.yml рядом со скриптом"

# ─── Параметры ───────────────────────────────────────────────────
TURN_USER="${TURN_USER:-messanger}"
TURN_REALM="${TURN_REALM:-messanger}"

# Автодетект публичного IP (или из переменной)
if [[ -z "${PUBLIC_IP:-}" ]]; then
    log "Определяю публичный IP..."
    PUBLIC_IP=$(curl -fsS4 --max-time 5 ifconfig.me \
        || curl -fsS4 --max-time 5 ipv4.icanhazip.com \
        || curl -fsS4 --max-time 5 api.ipify.org \
        || true)
    [[ -n "$PUBLIC_IP" ]] || fail "Не смог определить публичный IP. Запусти с PUBLIC_IP=x.x.x.x bash install.sh"
fi

log "Публичный IP: $PUBLIC_IP"
log "TURN user: $TURN_USER"
log "Realm: $TURN_REALM"

# ─── Установка Docker ────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    log "Docker не найден — ставлю..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg ufw

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    UBUNTU_CODENAME=$(. /etc/os-release && echo "${VERSION_CODENAME}")
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $UBUNTU_CODENAME stable" \
        > /etc/apt/sources.list.d/docker.list

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin

    systemctl enable --now docker
    log "Docker поставлен и запущен"
else
    log "Docker уже установлен ($(docker --version))"
fi

# ─── Registry mirrors (обходим Docker Hub anonymous rate limit) ─
if [[ ! -f /etc/docker/daemon.json ]] || ! grep -q registry-mirrors /etc/docker/daemon.json; then
    log "Настраиваю registry-зеркала Docker..."
    cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://huecker.io",
    "https://dockerhub.timeweb.cloud",
    "https://mirror.gcr.io"
  ]
}
EOF
    systemctl restart docker
    sleep 2
    log "Registry-зеркала подключены"
else
    log "registry-mirrors уже настроены — пропускаю"
fi

# ─── Открытие портов в ufw ──────────────────────────────────────
if command -v ufw &>/dev/null; then
    log "Настраиваю ufw..."
    # Не трогаем 22/SSH — предполагаем что уже открыт
    if ! ufw status | grep -q "Status: active"; then
        warn "ufw не активен — НЕ включаю автоматически чтобы не отрезать SSH"
        warn "После проверки SSH сами выполните: sudo ufw allow 22/tcp && sudo ufw enable"
    fi
    ufw allow 3478/tcp     comment 'coturn STUN/TURN' || true
    ufw allow 3478/udp     comment 'coturn STUN/TURN' || true
    ufw allow 5349/tcp     comment 'coturn TLS'        || true
    ufw allow 5349/udp     comment 'coturn TLS'        || true
    ufw allow 49152:65535/udp comment 'coturn relay'   || true
    log "Правила ufw добавлены"
else
    warn "ufw не установлен — пропускаю настройку файрвола"
fi

# ─── Генерация пароля и конфига ─────────────────────────────────
TURN_PASSWORD_FILE="/opt/coturn/.turn_password"
mkdir -p /opt/coturn

if [[ -f "$TURN_PASSWORD_FILE" ]]; then
    log "Найден существующий пароль в $TURN_PASSWORD_FILE — переиспользую"
    TURN_PASSWORD=$(cat "$TURN_PASSWORD_FILE")
else
    log "Генерирую новый случайный пароль..."
    TURN_PASSWORD=$(openssl rand -hex 24)
    echo "$TURN_PASSWORD" > "$TURN_PASSWORD_FILE"
    chmod 600 "$TURN_PASSWORD_FILE"
fi

# Подставляем placeholder'ы в шаблон
log "Генерирую turnserver.conf..."
cp turnserver.conf.template /opt/coturn/turnserver.conf
sed -i "s|__PUBLIC_IP__|$PUBLIC_IP|g"           /opt/coturn/turnserver.conf
sed -i "s|__TURN_USER__|$TURN_USER|g"           /opt/coturn/turnserver.conf
sed -i "s|__TURN_PASSWORD__|$TURN_PASSWORD|g"   /opt/coturn/turnserver.conf
sed -i "s|__REALM__|$TURN_REALM|g"              /opt/coturn/turnserver.conf

# Копируем docker-compose
cp docker-compose.yml /opt/coturn/docker-compose.yml

# ─── Старт контейнера ────────────────────────────────────────────
log "Запускаю coturn..."
cd /opt/coturn
docker compose pull
docker compose up -d

sleep 3

# ─── Проверка ───────────────────────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q '^coturn$'; then
    log "coturn запущен ✓"
else
    fail "coturn не стартовал. Логи: docker logs coturn"
fi

# ─── Финальный вывод ────────────────────────────────────────────
echo
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}TURN-сервер готов!${NC}"
echo "════════════════════════════════════════════════════════════════"
echo
echo "Креды для .env вашего мессенджера:"
echo
echo "TURN_URLS=turn:$PUBLIC_IP:3478,turn:$PUBLIC_IP:3478?transport=tcp"
echo "TURN_USERNAME=$TURN_USER"
echo "TURN_CREDENTIAL=$TURN_PASSWORD"
echo
echo "Пароль также сохранён в: $TURN_PASSWORD_FILE"
echo
echo "Проверить работоспособность:"
echo "  https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
echo
echo "Управление:"
echo "  cd /opt/coturn"
echo "  docker compose logs -f       # логи"
echo "  docker compose restart       # рестарт"
echo "  docker compose down          # остановка"
echo "════════════════════════════════════════════════════════════════"
