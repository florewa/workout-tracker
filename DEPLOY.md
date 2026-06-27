# Деплой «Твой Подход» (Docker, изолированно)

Сервер общий и нагруженный — **ничего чужого не трогаем**. Всё живёт в своём
каталоге и в compose-проекте `workout-tracker`; Postgres наружу не публикуется;
приложение слушает только `127.0.0.1`.

## 0. Предусловия
- Docker + Compose v2: `docker info` и `docker compose version` отрабатывают.
- Свободный localhost-порт (по умолчанию **8793**).
- Поддомен (напр. `podhod.itlabs.top`), указывающий на сервер, с TLS на вашем nginx.

## 1. Код на сервер (в отдельный каталог)
```bash
cd ~
git clone https://github.com/florewa/workout-tracker.git
cd workout-tracker && git checkout master
```

## 2. Проверить, что порт свободен
```bash
ss -ltn | grep -q ':8793 ' && echo "ЗАНЯТ — выбери другой APP_PORT" || echo "8793 свободен"
```

## 3. Заполнить .env
```bash
cp .env.prod.example .env
openssl rand -hex 24      # сгенерировать пароль для POSTGRES_PASSWORD
nano .env                 # вписать POSTGRES_PASSWORD и тот же пароль в DATABASE_URL, проверить APP_PORT
```

## 4. Сборка и запуск
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Compose сам: поднимет `db` → дождётся healthcheck → применит миграции (`migrate`) → запустит `app`.
```bash
docker compose -f docker-compose.prod.yml ps
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8793/   # ожидаем 200
```

## 5. Наполнение данными (рекомендуется)
Программы и упражнения берутся из `data/*.xlsx` — без этого экраны выбора будут пустыми:
```bash
docker compose -f docker-compose.prod.yml run --rm migrate \
  sh -c "npm run import && npm run backfill:weekday && npm run normalize"
```
Импорт заодно перенесёт исторические тренировки из Excel. Если они не нужны — после
импорта можно удалить лишние тренировки или почистить таблицы `workouts/sets/workout_members`.

## 6. nginx — НОВЫЙ vhost (существующие конфиги не редактируем)
Создать отдельный файл (напр. `/etc/nginx/conf.d/podhod.itlabs.top.conf`) по образцу
ваших `*.ssl.conf`, с TLS, и в `location /`:
```nginx
location / {
    proxy_pass http://127.0.0.1:8793;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
}
```
```bash
sudo nginx -t && sudo systemctl reload nginx   # reload не роняет остальные сайты
```

## 7. Telegram-бот (@BotFather)
1. `/newbot` → имя + username → **BOT_TOKEN**. Username без `@` → **BOT_USERNAME**. Вписать в `.env`.
2. Mini App: `/newapp` → выбрать бота → заголовок/описание/фото → **Web App URL = https://podhod.itlabs.top** → короткое имя.
   (Либо `/mybots` → Bot Settings → Menu Button → задать URL.)
3. **ALLOWLIST**: свои Telegram-ID (узнать у `@userinfobot`) через запятую в `.env` — пускать только круг.
4. Перечитать env приложением:
```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate app
```
Инвайт-ссылка друга будет вида `https://t.me/<BOT_USERNAME>?startapp=<token>`.

## Эксплуатация
```bash
# логи
docker compose -f docker-compose.prod.yml logs -f app
# обновление кода (миграции применятся сами)
git pull && docker compose -f docker-compose.prod.yml up -d --build
# бэкап БД
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U workout workout > backup_$(date +%F).sql
# стоп (данные сохраняются)
docker compose -f docker-compose.prod.yml down
# полное удаление вместе с БД
docker compose -f docker-compose.prod.yml down -v
```

## Изоляция / безопасность
- Всё в compose-проекте `workout-tracker`: свои контейнеры (`workout-tracker-*`), своя сеть, том `workout-tracker_pgdata`. `down` чужого не трогает.
- Postgres доступен только внутри сети compose (порт не опубликован).
- Приложение торчит только в `127.0.0.1:8793` — снаружи лишь через ваш nginx по HTTPS.
- В проде dev-обход авторизации выключен (`NODE_ENV=production`), вход только через валидный Telegram initData + ALLOWLIST.
