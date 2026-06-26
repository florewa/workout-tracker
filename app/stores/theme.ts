import { defineStore } from 'pinia'

type Mode = 'system' | 'light' | 'dark'

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ mode: 'system' as Mode }),
  getters: {
    resolved(state): 'light' | 'dark' {
      if (state.mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
      return state.mode
    },
  },
  actions: {
    apply() {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', this.resolved)
      }
    },
    setMode(mode: Mode) {
      this.mode = mode
      if (typeof localStorage !== 'undefined') localStorage.setItem('theme-mode', mode)
      this.apply()
    },
    init() {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('theme-mode') : null
      if (saved === 'light' || saved === 'dark' || saved === 'system') this.mode = saved
      this.apply()
    },
  },
})
