// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '~/stores/theme'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('theme store', () => {
  it('по умолчанию режим system', () => {
    const t = useThemeStore()
    expect(t.mode).toBe('system')
  })

  it('setMode сохраняет режим и ставит data-theme', () => {
    const t = useThemeStore()
    t.setMode('dark')
    expect(t.mode).toBe('dark')
    expect(t.resolved).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('theme-mode')).toBe('dark')
  })

  it('init читает сохранённый режим', () => {
    localStorage.setItem('theme-mode', 'light')
    const t = useThemeStore()
    t.init()
    expect(t.mode).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
