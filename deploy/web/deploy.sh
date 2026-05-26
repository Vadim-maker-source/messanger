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

echo "[+] PM2 reload (zero-downtime)..."
pm2 reload messanger || pm2 start ecosystem.config.js

pm2 save

echo "[+] Deploy done. Status:"
pm2 status messanger
