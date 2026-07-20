import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '~': fileURLToPath(new URL('./app/', import.meta.url)),
      '@': fileURLToPath(new URL('./app/', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'test/*.test.ts',
      'test/components/**/*.test.ts',
      'test/stores/**/*.test.ts',
    ],
    // A few pure script tests import modules that also expose a DB-backed CLI.
    // postgres-js connects lazily, so a placeholder prevents import-time config
    // errors without opening a connection during unit tests.
    env: {
      DATABASE_URL: 'postgres://unused:unused@127.0.0.1:1/unused',
    },
  },
})
