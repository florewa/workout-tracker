import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

// Каталог загрузок: в проде — смонтированный том (UPLOADS_DIR), в dev — ./.uploads
export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || resolve(process.cwd(), '.uploads')
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function isAllowedImageType(type: string | undefined): boolean {
  return !!type && type in EXT_BY_TYPE
}

// Сохраняет картинку, возвращает публичный путь /uploads/<file>
export async function saveImage(data: Buffer, contentType: string): Promise<string> {
  const ext = EXT_BY_TYPE[contentType]
  const name = `${randomUUID()}.${ext}`
  const dir = uploadsDir()
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, name), data)
  return `/uploads/${name}`
}
