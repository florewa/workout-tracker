import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createError, getRouterParam, setHeader } from 'h3'
import { uploadsDir } from '~~/server/utils/uploads'

const TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
}

// Раздача загруженных картинок из тома
export default defineEventHandler((event) => {
  const name = getRouterParam(event, 'name') ?? ''
  // защита от обхода каталога: только безопасное имя файла
  if (!/^[\w.-]+$/.test(name) || name.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'Неверное имя' })
  }
  const path = join(uploadsDir(), name)
  if (!existsSync(path)) throw createError({ statusCode: 404, statusMessage: 'Не найдено' })

  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  setHeader(event, 'content-type', TYPE_BY_EXT[ext] ?? 'application/octet-stream')
  setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
  return createReadStream(path)
})
