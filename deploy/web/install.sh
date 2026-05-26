#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# One-shot installer для Next.js + PM2 + nginx на Ubuntu 22.04 / 24.04
# ════════════════════════════════════════════════════════════════
# Что делает:
#   1. Ставит Node.js 20 LTS (через NodeSource)
#   2. Ставит pnpm и pm2 глобально
#   3. Ставит nginx
#   4. Открывает порты 80, 443 в ufw (если активен)
#   5. Создаёт каталог /opt/messanger для проекта
#
# Использование:
#   sudo bash install.sh
# ════════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "\033[0;31m[x]${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Запусти от root: sudo bash install.sh"

# ─── Node.js 20 LTS ─────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
    log "Устанавливаю Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
log "Node.js: $(node -v), npm: $(npm -v)"

# ─── PM2 ────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
    log "Устанавливаю PM2..."
    npm install -g pm2
fi
log "PM2: $(pm2 -v)"

# ─── nginx ──────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
    log "Устанавливаю nginx..."
    apt-get install -y nginx
fi
log "nginx: $(nginx -v 2>&1)"

systemctl enable --now nginx

# ─── ufw порты ──────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
    log "Открываю порты 80, 443 в ufw..."
    ufw allow 80/tcp comment 'HTTP' || true
    ufw allow 443/tcp comment 'HTTPS' || true
fi

# ─── Каталог проекта ────────────────────────────────────────────
mkdir -p /opt/messanger
log "Каталог /opt/messanger создан"

# ─── PM2 при ребуте ─────────────────────────────────────────────
log "Настраиваю PM2 на автозапуск при ребуте..."
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}Готово!${NC} Дальше:"
echo "  1. Залить проект в /opt/messanger (см. README)"
echo "  2. cd /opt/messanger && npm ci && npx prisma generate"
echo "  3. Создать /opt/messanger/.env (см. .env.template)"
echo "  4. npm run build"
echo "  5. pm2 start ecosystem.config.js && pm2 save"
echo "  6. cp /opt/messanger/deploy/web/nginx.conf /etc/nginx/sites-available/messanger"
echo "  7. ln -s /etc/nginx/sites-available/messanger /etc/nginx/sites-enabled/"
echo "  8. nginx -t && systemctl reload nginx"
echo "════════════════════════════════════════════════════════════════"
