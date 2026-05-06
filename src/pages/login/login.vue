<template>
  <view class="login-page">
    <view class="login-card">
      <view class="logo">
        <text class="logo-icon">◆</text>
        <text class="logo-text">Hermes Dashboard</text>
      </view>
      <view class="form">
        <view class="input-wrapper" :class="{ 'input-focus': focused }">
          <input
            class="key-input"
            :type="showKey ? 'text' : 'password'"
            v-model="apiKey"
            placeholder="输入 API 密钥"
            placeholder-class="placeholder"
            @focus="focused = true"
            @blur="focused = false"
            @input="onInput"
          />
          <text class="toggle-visibility" @click="showKey = !showKey">
            {{ showKey ? '👁' : '👁‍🗨' }}
          </text>
        </view>
        <view class="error-msg" v-if="errorMsg">{{ errorMsg }}</view>
        <button
          class="login-btn"
          :class="{ 'btn-loading': loading }"
          :disabled="!apiKey || loading"
          @click="handleLogin"
        >
          <text v-if="loading" class="loading-dots">验证中</text>
          <text v-else>登录</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const apiKey = ref('')
const loading = ref(false)
const errorMsg = ref('')
const showKey = ref(false)
const focused = ref(false)

function onInput() {
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
  padding: 16px;
}

.login-card {
  width: 100%;
  max-width: 360px;
  padding: 40px 32px;
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-sizing: border-box;
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

.input-wrapper {
  display: flex;
  align-items: center;
  background: #191a1b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0 12px;
  transition: border-color 0.2s;

  &.input-focus {
    border-color: rgba(94, 106, 210, 0.6);
  }
}

.key-input {
  flex: 1;
  height: 44px;
  background: transparent;
  color: #f7f8f8;
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 14px;
  border: none;
  outline: none;
  caret-color: #5e6ad2;
}

.placeholder {
  color: rgba(255, 255, 255, 0.3);
  font-family: 'JetBrains Mono', 'Courier New', monospace;
}

.toggle-visibility {
  font-size: 16px;
  padding: 4px;
  opacity: 0.5;
  cursor: pointer;
  user-select: none;
}

.error-msg {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #ef4444;
  font-size: 13px;
  text-align: center;
}

.login-btn {
  height: 44px;
  background: #5e6ad2;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active:not(:disabled) {
    background: #4a57b8;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.btn-loading {
    background: #4a57b8;
  }
}

.loading-dots::after {
  content: '...';
  animation: dots 1.2s infinite;
}

@keyframes dots {
  0% { content: '.'; }
  33% { content: '..'; }
  66% { content: '...'; }
}
</style>
