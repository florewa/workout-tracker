import { defineStore } from 'pinia'

interface UserLite { id: number; name: string }

export const useSessionStore = defineStore('session', {
  state: () => ({
    currentUser: null as UserLite | null,
    selectedMemberIds: [] as number[],
  }),
  actions: {
    async loadMe() {
      const api = useApi()
      this.currentUser = await api.get<UserLite>('/api/me')
      if (this.currentUser && !this.selectedMemberIds.includes(this.currentUser.id)) {
        this.selectedMemberIds = [this.currentUser.id]
      }
    },
    toggleMember(id: number) {
      this.selectedMemberIds = this.selectedMemberIds.includes(id)
        ? this.selectedMemberIds.filter((x) => x !== id)
        : [...this.selectedMemberIds, id]
    },
    setMembers(ids: number[]) {
      this.selectedMemberIds = ids
    },
  },
})
