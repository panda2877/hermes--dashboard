import { defineStore } from 'pinia'
import { getToken, setToken, removeToken } from '@/utils/storage'

interface UserState {
  token: string | null
  isLoggedIn: boolean
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: getToken(),
    isLoggedIn: !!getToken(),
  }),
  actions: {
    async login(key: string): Promise<boolean> {
      // 模拟登录验证
      if (key === 'hermes-secret-key') {
        this.token = key
        this.isLoggedIn = true
        setToken(key)
        return true
      }
      // TODO: 后续对接真实后端接口
      return false
    },
    logout() {
      this.token = null
      this.isLoggedIn = false
      removeToken()
    },
  },
})