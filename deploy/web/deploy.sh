#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# deploy.sh — обновить и перезапустить Next.js на VPS
# ════════════════════════════════════════════════════════════════
# Использование (на VPS, после загрузки нового кода):
#   cd /opt/messanger
#   bash deploy/web/deploy.sh
# ════════════════════════════════════════════════════════════════

set -euo pipefail

cd /opt/messanger

echo "[+] npm ci..."
npm ci --prefer-offline --no-audit --no-fund

echo "[+] Prisma generate..."
npx prisma generate

echo "[+] Prisma migrate deploy..."
npx prisma migrate deploy || echo "[!] Миграция не применилась (возможно, уже применена)"

echo "[+] Build..."
# Поднимаем Node heap до 2 GB чтобы TS check не падал на слабом VPS.
# На машинах с 1 GB RAM это работает за счёт swap'а.
NODE_OPTIONS="--max-old-space-size=2048" npm run build

# ─── nginx конфиг ────────────────────────────────────────────────
# Если в репе изменился nginx.conf — копируем его и делаем reload.
# Сравниваем хеши: если файл идентичен установленному — пропускаем.
NGINX_SRC="/opt/messanger/deploy/web/nginx.conf"
NGINX_DST="/etc/nginx/sites-available/messanger"

if [[ -f "$NGINX_SRC" ]] && command -v nginx &>/dev/null; then
    if [[ ! -f "$NGINX_DST" ]] || ! cmp -s "$NGINX_SRC" "$NGINX_DST"; then
        echo "[+] Обновляю nginx-конфиг..."
        cp "$NGINX_SRC" "$NGINX_DST"
        # Активируем если ещё не активен
        if [[ ! -L "/etc/nginx/sites-enabled/messanger" ]]; then
            ln -sf "$NGINX_DST" /etc/nginx/sites-enabled/messanger
        fi
        # Проверяем синтаксис, потом перезагружаем
        if nginx -t 2>&1; then
            systemctl reload nginx
            echo "[+] nginx перезагружен"
        else
            echo "[!] nginx -t не прошёл, конфиг НЕ применён"
            exit 1
        fi
    else
        echo "[=] nginx-конфиг не изменился"
    fi
fi

echo "[+] PM2 reload (zero-downtime)..."
pm2 reload messanger || pm2 start ecosystem.config.js

pm2 save

echo "[+] Deploy done. Status:"
pm2 status messanger
