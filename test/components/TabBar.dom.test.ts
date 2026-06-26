// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import TabBar from '~/components/TabBar.vue'

describe('TabBar', () => {
  it('рендерит 4 вкладки', () => {
    const wrapper = mount(TabBar, {
      global: { stubs: { NuxtLink: RouterLinkStub } },
    })
    const links = wrapper.findAllComponents(RouterLinkStub)
    expect(links).toHaveLength(4)
    expect(wrapper.text()).toContain('Тренировка')
    expect(wrapper.text()).toContain('Настройки')
  })
})
