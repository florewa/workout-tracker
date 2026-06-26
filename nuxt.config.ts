export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  // SPA-режим: Telegram initData доступен только на клиенте, поэтому все
  // запросы к API (с auth-заголовком) должны идти из браузера, не из SSR.
  ssr: false,
  devtools: { enabled: true },
  typescript: { strict: true },
  modules: ['@pinia/nuxt', '@nuxt/fonts', '@nuxt/icon'],
  icon: {
    clientBundle: { scan: true, includeCustomCollections: true },
  },
  css: ['~/assets/styles/main.scss'],
  app: {
    head: {
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }],
      script: [{ src: 'https://telegram.org/js/telegram-web-app.js' }],
    },
  },
})
