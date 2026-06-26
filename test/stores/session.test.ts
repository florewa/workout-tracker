// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '~/stores/session'

beforeEach(() => setActivePinia(createPinia()))

describe('session store members', () => {
  it('toggleMember добавляет и убирает', () => {
    const s = useSessionStore()
    s.toggleMember(5)
    expect(s.selectedMemberIds).toContain(5)
    s.toggleMember(5)
    expect(s.selectedMemberIds).not.toContain(5)
  })
  it('setMembers заменяет список', () => {
    const s = useSessionStore()
    s.setMembers([1, 2])
    expect(s.selectedMemberIds).toEqual([1, 2])
  })
})
