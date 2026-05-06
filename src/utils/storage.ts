const TOKEN_KEY = 'hermes_token'

export function getToken(): string | null {
  try {
    const val = uni.getStorageSync(TOKEN_KEY)
    return val || null
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  uni.setStorageSync(TOKEN_KEY, token)
}

export function removeToken(): void {
  uni.removeStorageSync(TOKEN_KEY)
}
