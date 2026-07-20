// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import TabBar from '~/components/TabBar.vue'

// useRoute is auto-imported by Nuxt but not available in vitest; stub it as a global
const route = { path: '/', query: {} as Record<string, string> }
beforeAll(() => { vi.stubGlobal('useRoute', () => route) })
beforeEach(() => {
  route.path = '/'
  route.query = {}
})
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
    expect(wrapper.text()).toContain('Профиль')
  })

  it('сохраняет активной Историю при открытии тренировки из неё', () => {
    route.path = '/workout/42'
    route.query = { from: 'history' }
    const wrapper = mount(TabBar, {
      global: { stubs: { NuxtLink: RouterLinkStub, Icon: true } },
    })
    const links = wrapper.findAllComponents(RouterLinkStub)
    expect(links[2].classes()).toContain('active')
    expect(links[0].classes()).not.toContain('active')
  })
})
