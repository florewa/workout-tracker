// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import TabBar from '~/components/TabBar.vue'

// useRoute is auto-imported by Nuxt but not available in vitest; stub it as a global
beforeAll(() => { vi.stubGlobal('useRoute', () => ({ path: '/' })) })
afterAll(() => { vi.unstubAllGlobals() })

describe('TabBar', () => {
  it('рендерит 4 вкладки', () => {
    const wrapper = mount(TabBar, {
      // Icon is auto-registered by @nuxt/icon at runtime but not in vitest; stub it
      global: { stubs: { NuxtLink: RouterLinkStub, Icon: true } },
    })
    const links = wrapper.findAllComponents(RouterLinkStub)
    expect(links).toHaveLength(4)
    expect(wrapper.text()).toContain('Тренировка')
    expect(wrapper.text()).toContain('Настройки')
  })
})
