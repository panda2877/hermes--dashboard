<template>
  <view>
    <router-view />
  </view>
</template>

<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'

onLaunch(() => {
  console.log('Hermes Dashboard Launched')
  const userStore = useUserStore()
  // 未登录则跳转到登录页
  if (!userStore.isLoggedIn) {
    uni.reLaunch({ url: '/pages/login/login' })
  }
})

onShow(() => {})
onHide(() => {})
</script>

<style lang="scss">
/* 全局样式 */
page {
  background-color: #08090a;
  color: #f7f8f8;
}
</style>
