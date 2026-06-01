# Talky — развёртывание через Docker Compose

Альтернативный способ развернуть весь стек **одной командой** в Docker.

## Архитектура

```
                ┌──────────────────────────────────────────────┐
                │ Docker host (новый VPS)                      │
                │                                              │
   Internet ──► │ nginx:80/443 ──► app:3000 ──► postgres:5432 │
                │     (контейнер)   (контейнер)   (контейнер) │
                │                                              │
                │     coturn:3478 (host network)               │
                └──────────────────────────────────────────────┘
                         volumes: postgres_data
```

Все 4 сервиса в одной docker-сети. БД и app не открыты наружу — только nginx и coturn.

## Файлы

| Файл | Что |
|---|---|
| `docker-compose.yml` | Описание всех сервисов |
| `Dockerfile` | Билд образа Next.js приложения |
| `nginx.conf` | Конфиг nginx (proxy_pass на сервис `app`) |
| `.env.example` | Шаблон переменных окружения |
| `install.sh` | One-shot: ставит Docker, генерит coturn.conf, запускает compose |
| `coturn.conf` | (генерится install.sh из шаблона) |

## Развёртывание на чистом VPS

```bash
# 1. Получить код на сервер
ssh root@НОВЫЙ_IP
cd /opt
git clone https://github.com/USER/REPO.git messanger
cd /opt/messanger

# 2. Создать .env
cp deploy/docker/.env.example .env
nano .env   # заполнить пароли и ключи

# 3. Запустить установку
chmod +x deploy/docker/install.sh
sudo bash deploy/docker/install.sh
```

Скрипт:
1. Поставит Docker (если ещё нет)
2. Прочитает `.env`, сгенерит `coturn.conf` с публичным IP
3. Запустит `docker compose up -d --build`

Через 5-10 минут (зависит от мощности VPS) приложение будет доступно на `http://НОВЫЙ_IP`.

## Восстановление БД из дампа

После того как контейнеры подняты, но БД пустая:

```bash
# Загрузить дамп на сервер
scp local-backup/db.sql.gz root@НОВЫЙ_IP:/tmp/

# Восстановить
ssh root@НОВЫЙ_IP
cd /opt/messanger
gunzip < /tmp/db.sql.gz | docker compose -f deploy/docker/docker-compose.yml exec -T postgres psql -U messanger -d webMessanger
rm /tmp/db.sql.gz
```

После этого:
```bash
docker compose -f deploy/docker/docker-compose.yml restart app
```

## Управление

Все команды — из каталога `deploy/docker/` или с флагом `-f`:

```bash
cd /opt/messanger/deploy/docker

# Статус всех контейнеров
docker compose ps

# Логи (живые)
docker compose logs -f app
docker compose logs -f nginx
docker compose logs -f postgres

# Рестарт одного сервиса
docker compose restart app

# Полная остановка (тома сохраняются — БД не теряется)
docker compose down

# Запустить снова после изменений
docker compose up -d --build

# ⚠️ Удалить вообще всё включая БД
docker compose down -v
```

## Обновление кода

```bash
ssh root@НОВЫЙ_IP
cd /opt/messanger
git pull
cd deploy/docker
docker compose up -d --build app
```

Только сервис `app` пересоберётся, остальные не трогаются. ~2-3 минуты на инкрементальный билд.

## Бэкап БД

Через docker-команду — БД не нужно "вытаскивать" наружу:

```bash
docker compose exec postgres pg_dump -U messanger webMessanger \
    --format=plain --no-owner --no-acl \
    | gzip -9 > /var/backups/db_$(date +%Y%m%d).sql.gz
```

Можно прописать в crontab от root:
```cron
0 3 * * * cd /opt/messanger/deploy/docker && docker compose exec -T postgres pg_dump -U messanger webMessanger | gzip -9 > /var/backups/db_$(date +\%Y\%m\%d).sql.gz
```

## Зачем docker compose vs нативная установка

| | Нативно (PM2 + apt) | Docker Compose |
|---|---|---|
| Скорость старта | Быстрее | Чуть медленнее (overhead контейнеров) |
| Изоляция | Все процессы в одной ОС | Каждый сервис изолирован |
| Воспроизводимость | Зависит от версии Ubuntu/apt | Идентично на любой машине с Docker |
| Перенос | Установка с нуля скриптами | `git clone` + `docker compose up` |
| Ресурсы (RAM) | Меньше на ~150-300 MB | Чуть больше |
| Дебаг | Привычные tail/journalctl | `docker logs` |
| Бэкап БД | прямой `pg_dump` | через `docker exec` |
| Лимиты CPU/RAM | nice/systemd | удобнее (`mem_limit`, `cpus`) |

Для **тебя** docker compose выгоднее тем что:
- При смене VPS — `git clone` + `cp .env` + `docker compose up` и всё работает
- Не нужно править pg_hba.conf, nginx-конфиги отдельно — всё в репе
- Откат на старую версию: `git checkout <commit> && docker compose up -d --build`

## Проблемы

**App не стартует** — `docker compose logs app`, скорее всего ошибка в `.env` или `prisma migrate` упал.

**БД не подключается** — проверить `DATABASE_URL` в `.env` должен быть `postgres:5432` (имя сервиса), не `localhost`.

**WebRTC не работает** — coturn в `network_mode: host` нужен открытый файрволл 49152-65535/udp на хосте.

**Out of memory при билде** — Next.js билд потребляет до 2 ГБ. На VPS с 1 ГБ нужен swap:
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
