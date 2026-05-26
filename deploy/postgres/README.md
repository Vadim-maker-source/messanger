# PostgreSQL на VPS

Перенос PostgreSQL-БД с dev-машины (Windows + локальный PG) на VPS (Ubuntu).

## Архитектура

```
┌─────────────────┐                       ┌──────────────────────┐
│  Local Windows  │                       │  VPS 194.87.201.226  │
│  ───────────────│                       │  ────────────────────│
│  Next.js dev    │                       │  PostgreSQL          │
│       ↓ port    │  SSH-туннель :5433    │  127.0.0.1:5432      │
│   localhost:    │ ───────────────────► │       ↑              │
│       5433      │                       │       │              │
│                 │                       │  /var/backups/       │
│                 │                       │  cron 03:00 ежедневно│
└─────────────────┘                       └──────────────────────┘
```

PostgreSQL на VPS слушает **только 127.0.0.1** — не торчит в интернет, доступ через SSH-туннель. Это безопасно: нет риска брутфорса/SQL-инъекций извне.

## Шаги миграции

### 1. Бэкап локальной БД (Windows)

В PowerShell:

```powershell
$env:PGPASSWORD = "Vadim2011"
$dump = "$env:USERPROFILE\Desktop\webmessanger_$(Get-Date -Format 'yyyyMMdd').sql"
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
    -h localhost -U postgres -d webMessanger `
    --no-owner --no-acl --format=plain `
    -f $dump
Write-Host "Дамп: $dump"
```

Результат: файл `webmessanger_YYYYMMDD.sql` на Рабочем столе.

### 2. Залить deploy-папку и дамп на VPS

```powershell
cd C:\Users\UserAd\Desktop\Krutie_projects\messanger
scp -r deploy\postgres root@194.87.201.226:/opt/pg-setup
scp $env:USERPROFILE\Desktop\webmessanger_*.sql root@194.87.201.226:/tmp/dump.sql
```

### 3. Установить PostgreSQL на VPS

SSH на VPS и запустить:

```bash
ssh root@194.87.201.226

cd /opt/pg-setup
chmod +x install.sh
sudo PG_PASSWORD='ВАШ_СЛОЖНЫЙ_ПАРОЛЬ' bash install.sh
```

Скрипт сам:
- поставит PostgreSQL (нативно, не в Docker)
- создаст БД `webMessanger` и пользователя `messanger` с вашим паролем
- настроит `pg_hba.conf` на listen только localhost
- создаст каталог для бэкапов

### 4. Восстановить дамп

Восстанавливаем **под пользователем `messanger`** (не postgres) — так таблицы сразу получат правильного владельца:

```bash
PGPASSWORD='ВАШ_ПАРОЛЬ_ОТ_БД' psql -h 127.0.0.1 -U messanger -d webMessanger -f /tmp/dump.sql
sudo rm /tmp/dump.sql
```

(`PGPASSWORD` нужен потому что peer-auth работает только для postgres.)

Если дамп уже залит от postgres и таблицы принадлежат ему — переоформление владения:
```bash
sudo -u postgres psql -d webMessanger <<'SQL'
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO messanger', r.tablename);
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO messanger', r.sequence_name);
  END LOOP;
  FOR r IN SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
           WHERE n.nspname='public' AND t.typtype IN ('e','d') LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO messanger', r.typname);
  END LOOP;
END $$;
ALTER SCHEMA public OWNER TO messanger;
SQL
```

Проверка:
```bash
sudo -u postgres psql -d webMessanger -c "SELECT count(*) FROM \"User\";"
```

### 5. Настроить SSH-туннель на dev-машине

В **отдельном** PowerShell-окне (на Windows):

```powershell
ssh -N -L 5433:localhost:5432 root@194.87.201.226
```

Это окно держим открытым — пока работаем с БД. Туннель: `localhost:5433` на вашей машине → `localhost:5432` на VPS.

### 6. Поменять `.env`

```env
# Было:
# DATABASE_URL="postgresql://postgres:Vadim2011@localhost:5432/webMessanger"

# Стало:
DATABASE_URL="postgresql://messanger:ВАШ_СЛОЖНЫЙ_ПАРОЛЬ@localhost:5433/webMessanger?schema=public"
```

Перезапустить Next.js (`Ctrl+C` → `npm run dev`).

### 7. Проверить что приложение работает

Открыть мессенджер, отправить сообщение, прочитать из БД. Если всё работает — миграция успешна.

### 8. Включить ежедневные бэкапы

```bash
# На VPS:
sudo cp /opt/pg-setup/backup.sh /usr/local/bin/pg-backup.sh
sudo chmod +x /usr/local/bin/pg-backup.sh

# Прописать в cron
sudo crontab -e
# Добавить строку:
0 3 * * * /usr/local/bin/pg-backup.sh
```

Бэкап будет запускаться каждый день в 03:00, хранить 30 дней. Логи в `/var/log/pg-backup.log`.

## Проверка бэкапов

Запустить вручную:
```bash
sudo /usr/local/bin/pg-backup.sh
ls -lh /var/backups/postgres/
cat /var/log/pg-backup.log
```

## Откат (если что-то пошло не так)

Локальный PostgreSQL не трогался. Просто верните `DATABASE_URL` на старое значение — приложение продолжит работать с локальной БД.

## После переезда Next.js на VPS (Этап 3)

`DATABASE_URL` в `.env` на VPS станет проще:
```env
DATABASE_URL="postgresql://messanger:ВАШ_ПАРОЛЬ@localhost:5432/webMessanger?schema=public"
```

(без порта 5433 и без SSH-туннеля — Next.js и Postgres на одной машине, ходят через локальный сокет).
