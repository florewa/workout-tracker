# Твой Подход

Мобильное веб-приложение для ведения тренировок в Telegram Mini Apps. Проект
работает на Nuxt 4, Vue 3, PostgreSQL и Drizzle ORM.

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

Быстрые unit-тесты не требуют запущенной базы данных:

```bash
npm run test:unit
```

Сервисные тесты используют PostgreSQL из `DATABASE_URL_TEST`. Перед первым
запуском необходимо применить тестовые миграции:

```bash
npm run db:migrate:test
npm run test:db
```

Полная локальная проверка и production-сборка:

```bash
npm test
npm run build
```

Та же последовательность автоматически выполняется для каждого pull request в
GitHub Actions. Инструкции по production-развёртыванию находятся в
[`DEPLOY.md`](./DEPLOY.md).

## Работа с изменениями

Разработка ведётся в отдельных ветках. Перед объединением с `master` изменение
должно пройти unit-тесты, сервисные тесты, production-сборку и ручную проверку
затронутого сценария в мобильном интерфейсе.
