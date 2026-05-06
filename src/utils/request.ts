import { useUserStore } from '@/store/user'

const BASE_URL = '/api'

export function request<T>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const userStore = useUserStore()
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Authorization': `Bearer ${userStore.token}`,
        'Content-Type': 'application/json',
      },
      success: (res) => {
        if (res.statusCode === 401) {
          userStore.logout()
          uni.reLaunch({ url: '/pages/login/login' })
          reject(res.data)
        } else {
          resolve(res.data as T)
        }
      },
      fail: reject,
    })
  })
}
