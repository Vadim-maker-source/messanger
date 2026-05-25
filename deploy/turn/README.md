# TURN-сервер (coturn) для мессенджера

Развёртывание coturn на VPS под Ubuntu 22.04 / 24.04 в Docker.

## Что внутри

- `install.sh` — скрипт-установщик (Docker + coturn + ufw, всё за раз)
- `turnserver.conf.template` — конфиг coturn с placeholder'ами
- `docker-compose.yml` — описание контейнера

## Деплой

На VPS (от root):

```bash
# 1. Скопируйте папку deploy/turn на сервер (через scp или git)
# 2. Запустите установщик
cd /opt/coturn-setup    # или куда положили
sudo bash install.sh
```

Скрипт сам:
- Поставит Docker + compose plugin (если ещё нет)
- Сгенерирует случайный пароль (24 байта hex)
- Определит публичный IP
- Откроет порты в ufw
- Запустит coturn в host-network режиме
- Распечатает готовые `TURN_URLS` / `TURN_USERNAME` / `TURN_CREDENTIAL` для `.env` мессенджера

## Опции

```bash
# Свой IP, если автодетект сломан
sudo PUBLIC_IP=1.2.3.4 bash install.sh

# Своё имя пользователя/realm
sudo TURN_USER=myuser TURN_REALM=mychat.ru bash install.sh
```

## Проверка

После запуска зайдите на https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ —
введите ваш TURN URL/username/credential, нажмите **Add Server** → **Gather candidates**.

В таблице должны появиться кандидаты с типом **`relay`**. Если их нет — что-то с портами/файрволом.

## Управление

```bash
cd /opt/coturn

docker compose logs -f       # логи в реальном времени
docker compose ps            # статус
docker compose restart       # рестарт
docker compose down          # остановить
docker compose up -d         # запустить заново
docker compose pull && docker compose up -d   # обновить образ
```

Логи также пишутся в `/opt/coturn/logs/turnserver.log`.

## Безопасность

- Пароль TURN хранится в `/opt/coturn/.turn_password` (600).
- В конфиге запрещён relay в приватные сети (защита от SSRF).
- Отключён telnet-CLI coturn (по дефолту слушал 5766 и брутфорсился).
- Запрещены TLSv1 и TLSv1.1.

Если нужно сменить пароль:
```bash
sudo rm /opt/coturn/.turn_password
sudo bash install.sh         # сгенерит новый, обновит config, перезапустит
```

## TLS (опционально)

По дефолту TURN работает без TLS (`turn:` URL). Если хотите `turns:` (через TLS на 5349):

1. Заведите домен и A-запись на IP сервера: `turn.yourdomain.com → 1.2.3.4`
2. Получите Let's Encrypt сертификат:
   ```bash
   sudo apt install -y certbot
   sudo certbot certonly --standalone -d turn.yourdomain.com
   ```
3. В `/opt/coturn/turnserver.conf` добавьте:
   ```
   cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
   pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
   ```
4. В `docker-compose.yml` добавьте монтирование `/etc/letsencrypt`:
   ```yaml
   volumes:
     - /etc/letsencrypt:/etc/letsencrypt:ro
     - ./turnserver.conf:/etc/coturn/turnserver.conf:ro
     - ./logs:/var/log/coturn
   ```
5. `docker compose restart`

В `.env` мессенджера добавьте `turns:`:
```
TURN_URLS=turn:1.2.3.4:3478,turn:1.2.3.4:3478?transport=tcp,turns:turn.yourdomain.com:5349
```
