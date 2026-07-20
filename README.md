# Твой Подход

Мобильное веб-приложение для ведения тренировок в Telegram Mini Apps. Проект
работает на Nuxt 4, Vue 3, PostgreSQL и Drizzle ORM.

## Архитектура

Приложение является модульным монолитом: Vue-клиент обращается только к
серверным маршрутам `/api/*`, которые выполняются в Nitro. Обращения к
PostgreSQL находятся в `server/services` и `server/db`; подключение к базе и
секреты не попадают в браузерный bundle. Для текущего масштаба проекта
отдельный backend-сервис не требуется — Nitro здесь и является backend-слоем.

Realtime-обновления тренировок пока хранят подключения WebSocket в памяти
одного процесса. Перед горизонтальным масштабированием приложения потребуется
общий брокер сообщений (например, Redis Pub/Sub), чтобы синхронизировать
несколько экземпляров.

## Требования

- Node.js 22
- npm
- PostgreSQL 16 или Docker с Compose v2

## Локальный запуск

1. Установить зависимости:

   ```bash
   npm ci
   ```

2. Скопировать настройки и при необходимости изменить подключения к БД:

   ```bash
   cp .env.example .env
   ```

3. Поднять PostgreSQL через Docker и применить миграции:

   ```bash
   npm run db:up
   npm run db:migrate
   npm run db:migrate:test
   ```

4. Для входа вне Telegram указать в `.env` существующий `AUTH_DEV_USER_ID`,
   затем запустить приложение:

   ```bash
   npm run dev
   ```

## Проверки

Статические проверки и быстрые unit-тесты не требуют запущенной базы данных:

```bash
npm run lint
npm run typecheck
npm run test:unit
```

Сервисные тесты используют PostgreSQL из `DATABASE_URL_TEST`. Перед первым
запуском необходимо применить тестовые миграции:

```bash
npm run db:migrate:test
npm run test:db
```

Мобильные browser smoke-тесты запускают production-подобный dev-сервер и также
используют PostgreSQL с пользователем из `AUTH_DEV_USER_ID`:

```bash
npx playwright install chromium
npm run test:e2e
```

Полная локальная проверка и production-сборка:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Та же последовательность автоматически выполняется для каждого pull request в
GitHub Actions. Инструкции по production-развёртыванию находятся в
[`DEPLOY.md`](./DEPLOY.md).

## Работа с изменениями

Разработка ведётся в отдельных ветках. Перед объединением с `master` изменение
должно пройти unit-тесты, сервисные тесты, production-сборку и ручную проверку
затронутого сценария в мобильном интерфейсе.
