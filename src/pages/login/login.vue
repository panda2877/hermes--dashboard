<template>
  <view class="login-page">
    <view class="login-card">
      <view class="logo">
        <text class="logo-icon">◆</text>
        <text class="logo-text">Hermes Dashboard</text>
      </view>
      <view class="form">
        <u-input
          v-model="apiKey"
          type="password"
          placeholder="输入 API 密钥"
          :border="true"
          :custom-style="inputStyle"
          class="key-input"
          @input="onInput"
        />
        <u-button
          type="primary"
          :loading="loading"
          :disabled="!apiKey"
          @click="handleLogin"
          class="login-btn"
        >
          {{ loading ? '验证中...' : '登录' }}
        </u-button>
      </view>
      <view v-if="errorMsg" class="error-msg">{{ errorMsg }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const apiKey = ref('')
const loading = ref(false)
const errorMsg = ref('')

const inputStyle = reactive({
  backgroundColor: '#191a1b',
  color: '#f7f8f8',
  borderColor: 'rgba(255,255,255,0.08)',
})

function onInput(val: string) {
  errorMsg.value = ''
}

async function handleLogin() {
  loading.value = true
  errorMsg.value = ''
  try {
    const ok = await userStore.login(apiKey.value)
    if (ok) {
      uni.reLaunch({ url: '/pages/dashboard/dashboard' })
    } else {
      errorMsg.value = '密钥错误，请重试'
    }
  } catch {
    errorMsg.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #08090a;
}

.login-card {
  width: 360px;
  padding: 40px 32px;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.logo {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}

.logo-icon {
  font-size: 36px;
  color: #5e6ad2;
  margin-bottom: 8px;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #f7f8f8;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.key-input {
  :deep(.u-input__input) {
    font-family: 'JetBrains Mono', monospace;
  }
}

.login-btn {
  margin-top: 8px;
}

.error-msg {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #ef4444;
  font-size: 13px;
  text-align: center;
}
</style>