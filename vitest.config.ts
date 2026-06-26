import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '~': fileURLToPath(new URL('./app/', import.meta.url)),
      '@': fileURLToPath(new URL('./app/', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    passWithNoTests: true,
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.test-db.ts'],
    // Все сервис-тесты используют одну тестовую БД и делают TRUNCATE в beforeEach,
    // поэтому файлы должны идти последовательно, иначе они затирают данные друг друга.
    fileParallelism: false,
  },
})
