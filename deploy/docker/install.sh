#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# install.sh — поднимает весь стек одной командой через docker compose
# ════════════════════════════════════════════════════════════════
# Использование (на новом VPS):
#   sudo bash deploy/docker/install.sh
#
# Что делает:
#   1. Ставит Docker + docker compose plugin (если нет)
#   2. Запрашивает публичный IP (или берёт из аргумента)
#   3. Генерирует coturn.conf из шаблона
#   4. Проверяет наличие .env в корне репо
#   5. docker compose up -d (билд app + старт всех сервисов)
# ════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[x]${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Запусти от root: sudo bash deploy/docker/install.sh"

# Корень репо = два уровня выше этого скрипта
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKER_DIR="$REPO_ROOT/deploy/docker"
TURN_TEMPLATE="$REPO_ROOT/deploy/turn/turnserver.conf.template"

# ─── .env ────────────────────────────────────────────────────────
[[ -f "$REPO_ROOT/.env" ]] \
    || fail "Не найден $REPO_ROOT/.env. Скопируйте: cp $DOCKER_DIR/.env.example $REPO_ROOT/.env && nano $REPO_ROOT/.env"

# ─── Docker ──────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    log "Устанавливаю Docker..."
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg

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
    log "Docker поставлен"
fi
log "$(docker --version)"

# Registry-зеркала (обходим Docker Hub лимит для анонимов)
if [[ ! -f /etc/docker/daemon.json ]] || ! grep -q registry-mirrors /etc/docker/daemon.json; then
    log "Настраиваю registry-зеркала..."
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
fi

# ─── Публичный IP ────────────────────────────────────────────────
if [[ -z "${PUBLIC_IP:-}" ]]; then
    PUBLIC_IP=$(curl -fsS4 --max-time 5 ifconfig.me \
        || curl -fsS4 --max-time 5 ipv4.icanhazip.com \
        || true)
    [[ -n "$PUBLIC_IP" ]] || fail "Не определил публичный IP. Запусти: PUBLIC_IP=x.x.x.x bash $0"
fi
log "Публичный IP: $PUBLIC_IP"

# ─── coturn config ───────────────────────────────────────────────
TURN_USERNAME=$(grep ^TURN_USERNAME "$REPO_ROOT/.env" | cut -d= -f2-)
TURN_CREDENTIAL=$(grep ^TURN_CREDENTIAL "$REPO_ROOT/.env" | cut -d= -f2-)
[[ -n "$TURN_USERNAME" && -n "$TURN_CREDENTIAL" ]] \
    || fail "В .env должны быть заполнены TURN_USERNAME и TURN_CREDENTIAL"

log "Генерирую coturn.conf..."
cp "$TURN_TEMPLATE" "$DOCKER_DIR/coturn.conf"
sed -i "s|__PUBLIC_IP__|$PUBLIC_IP|g"           "$DOCKER_DIR/coturn.conf"
sed -i "s|__TURN_USER__|$TURN_USERNAME|g"       "$DOCKER_DIR/coturn.conf"
sed -i "s|__TURN_PASSWORD__|$TURN_CREDENTIAL|g" "$DOCKER_DIR/coturn.conf"
sed -i "s|__REALM__|messanger|g"                "$DOCKER_DIR/coturn.conf"

# ─── ufw ─────────────────────────────────────────────────────────
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
    log "Открываю порты в ufw..."
    ufw allow 80/tcp                comment 'HTTP'              || true
    ufw allow 443/tcp               comment 'HTTPS'             || true
    ufw allow 3478/tcp              comment 'coturn'            || true
    ufw allow 3478/udp              comment 'coturn'            || true
    ufw allow 5349/tcp              comment 'coturn TLS'        || true
    ufw allow 5349/udp              comment 'coturn TLS'        || true
    ufw allow 49152:65535/udp       comment 'coturn relay'      || true
fi

# ─── Старт ───────────────────────────────────────────────────────
cd "$DOCKER_DIR"
log "Запускаю docker compose (это может занять 5-10 минут на билде app)..."
docker compose -f docker-compose.yml up -d --build

sleep 5
docker compose ps

echo
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}Готово!${NC}"
echo "════════════════════════════════════════════════════════════════"
echo
echo "Приложение: http://$PUBLIC_IP"
echo
echo "Команды:"
echo "  cd $DOCKER_DIR"
echo "  docker compose logs -f app    # логи Next.js"
echo "  docker compose ps             # статус всех контейнеров"
echo "  docker compose restart app    # рестарт приложения"
echo "  docker compose down           # остановить всё"
echo "  docker compose up -d --build  # пересобрать и запустить"
echo
echo "Восстановление БД из дампа:"
echo "  gunzip < /path/to/db.sql.gz | docker compose exec -T postgres psql -U messanger -d webMessanger"
echo "════════════════════════════════════════════════════════════════"
