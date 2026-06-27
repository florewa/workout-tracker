# syntax=docker/dockerfile:1

# ── deps: установка зависимостей (без postinstall — nuxt prepare сделает build) ──
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (а не ci): лок собран на Windows, на Linux-musl нужны другие
# платформенные опциональные сборки (esbuild/@emnapi/rollup) — install их доустановит
RUN npm install --ignore-scripts --no-audit --no-fund

# ── build: прод-сборка Nitro (.output самодостаточен) ──
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runner: рантайм приложения, только .output ──
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]

# ── tools: миграции и сидинг (полные зависимости + исходники + data/*.xlsx) ──
FROM node:24-alpine AS tools
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npx", "drizzle-kit", "migrate"]
