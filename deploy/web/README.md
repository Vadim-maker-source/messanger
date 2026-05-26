# Next.js + nginx на VPS

Развёртывание мессенджера на VPS под управлением PM2 + nginx.

## Архитектура

```
Интернет ──► nginx :80/:443 ──► Next.js+Socket.io :3000 ──► PostgreSQL :5432
                  │                       │                       │
                  │                       └─► coturn :3478         │
                  └─► статика _next/static (кеш)                   │
                                                                    │
                  /var/backups/postgres ◄────────── cron 03:00 ─────┘
```

Всё на одном VPS:
- **nginx** — TLS termination, static caching, reverse proxy.
- **Next.js (server.js)** — приложение + Socket.io на порту 3000 (доступен только из nginx).
- **PostgreSQL** — `127.0.0.1:5432` (не торчит наружу).
- **coturn** — `0.0.0.0:3478` (TURN для WebRTC).

## Шаги первого деплоя

### 1. Залить проект

С локальной машины (PowerShell, исключаем тяжёлые папки):

```powershell
cd C:\Users\UserAd\Desktop\Krutie_projects\messanger

# rsync был бы лучше, но на Windows нет — используем scp.
# Создаём временный архив без node_modules / .next / .git
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$archive = "$env:TEMP\messanger_$ts.tar"
tar -cf $archive --exclude=node_modules --exclude=.next --exclude=.git --exclude=.env *
scp $archive root@194.87.201.226:/tmp/messanger.tar
Remove-Item $archive
```

На VPS распаковываем:
```bash
ssh root@194.87.201.226
mkdir -p /opt/messanger
tar -xf /tmp/messanger.tar -C /opt/messanger
rm /tmp/messanger.tar
```

### 2. Установить Node.js + PM2 + nginx

```bash
cd /opt/messanger/deploy/web
chmod +x install.sh deploy.sh
sudo bash install.sh
```

### 3. Создать `.env` на VPS

```bash
cp /opt/messanger/deploy/web/.env.template /opt/messanger/.env
nano /opt/messanger/.env
```

В `.env` подставьте:
- `DATABASE_URL` — со своим паролем `messanger` (тем что задавали при `pg-setup install.sh`)
- `FIREBASE_SERVICE_ACCOUNT_KEY` — скопируйте из локального `.env` (с одинарными кавычками!)
- `NEXTAUTH_URL` — пока `http://194.87.201.226`, потом смените на домен
- TURN_* уже подставлены под ваш coturn

### 4. Первый билд + старт

```bash
cd /opt/messanger
bash deploy/web/deploy.sh
```

Скрипт сам:
- npm ci
- prisma generate
- prisma migrate deploy
- npm run build
- pm2 start ecosystem.config.js

Проверка: `pm2 status` — `messanger` должен быть `online`. Логи: `pm2 logs messanger`.

### 5. Подключить nginx

```bash
sudo cp /opt/messanger/deploy/web/nginx.conf /etc/nginx/sites-available/messanger
sudo ln -sf /etc/nginx/sites-available/messanger /etc/nginx/sites-enabled/messanger
# Удалить дефолтный сайт (если мешает)
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Тест

Откройте в браузере: **http://194.87.201.226**

Должна загрузиться страница мессенджера. Залогиньтесь (учётки те же что в локальной БД — данные мы перенесли).

## Дальнейшие обновления кода

После того как поправили код локально:

```powershell
# Локально — заново архив + scp
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$archive = "$env:TEMP\messanger_$ts.tar"
tar -cf $archive --exclude=node_modules --exclude=.next --exclude=.git --exclude=.env *
scp $archive root@194.87.201.226:/tmp/messanger.tar
```

```bash
# На VPS
ssh root@194.87.201.226
tar -xf /tmp/messanger.tar -C /opt/messanger
rm /tmp/messanger.tar
cd /opt/messanger
bash deploy/web/deploy.sh
```

Лучше всего: завести git-репо на GitHub/GitLab, тогда `cd /opt/messanger && git pull && bash deploy/web/deploy.sh`. Проще и безопаснее.

## SSL (Let's Encrypt)

Когда привяжете домен (A-запись `your-domain.ru → 194.87.201.226`):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.ru
```

Certbot автоматически:
- получит сертификат
- модифицирует `/etc/nginx/sites-available/messanger`
- настроит редирект HTTP → HTTPS
- настроит auto-renewal через systemd timer

Не забудьте поменять `NEXTAUTH_URL` в `.env` на `https://your-domain.ru`, потом `pm2 restart messanger`.

## Управление PM2

```bash
pm2 status                  # список процессов
pm2 logs messanger          # логи в реальном времени
pm2 logs messanger --lines 200  # последние 200 строк
pm2 restart messanger       # рестарт
pm2 reload messanger        # zero-downtime рестарт
pm2 stop messanger          # остановить
pm2 monit                   # dashboard в терминале
```

## Логи

- PM2: `/var/log/pm2/messanger-out.log`, `/var/log/pm2/messanger-error.log`
- nginx: `/var/log/nginx/messanger-access.log`, `/var/log/nginx/messanger-error.log`
- coturn: `docker logs coturn`
- PostgreSQL: `/var/log/postgresql/postgresql-16-main.log`
- Бэкапы БД: `/var/log/pg-backup.log`

## Откат

Если деплой сломался — откат к предыдущей версии:
```bash
cd /opt/messanger
git log --oneline -5  # если используете git
git checkout <предыдущий-commit>
bash deploy/web/deploy.sh
```

Без git — просто перелейте старый архив через scp и rebuild.

## Часто упоминаемые проблемы

- **502 Bad Gateway** — Next.js упал. `pm2 logs messanger`, скорее всего — ошибка в .env или сборке.
- **WebSocket не подключается** — проверьте что `proxy_set_header Connection $connection_upgrade;` в nginx.conf на месте, и что `map $http_upgrade $connection_upgrade {…}` определён в начале конфига.
- **Prisma errors** — `cd /opt/messanger && npx prisma generate && pm2 restart messanger`.
- **Изменили .env, не подхватилось** — `pm2 restart messanger` (env читается только при старте).
