<template>
  <view class="life-page">
    <!-- Top Bar -->
    <view class="top-bar">
      <view class="top-bar-brand">
        <image class="top-logo" src="/static/icons/life.svg" mode="aspectFit" />
        <view class="top-brand-text">Hermes</view>
      </view>
      <view class="top-bar-title-row">
        <text class="top-title">生活</text>
        <text class="top-subtitle">个人事务与生活管理</text>
      </view>
    </view>

    <!-- Page Body -->
    <view class="page-body">
      <view class="placeholder-card">
        <view class="placeholder-icon">🏠</view>
        <view class="placeholder-title">生活模块</view>
        <view class="placeholder-desc">
          此模块用于管理个人生活事务，如待办事项、日程安排、记账等。<br />
          功能正在规划中，敬请期待。
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 生活 Tab 页面 — 占位框架
// TODO: 后续迭代添加具体功能模块
</script>

<style lang="scss" scoped>
.life-page {
  padding: 0;
  background: #08090a;
  min-height: 100vh;
  overflow-x: hidden;
  touch-action: pan-y;
}

/* Top Bar */
.top-bar {
  padding: 16px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.top-bar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.top-logo {
  width: 28px;
  height: 28px;
}

.top-brand-text {
  font-size: 14px;
  font-weight: 600;
  color: #f7f8f8;
  letter-spacing: -0.02em;
}

.top-bar-title-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 14px;
}

.top-title {
  font-size: 22px;
  font-weight: 700;
  color: #f7f8f8;
  letter-spacing: -0.3px;
  line-height: 1.2;
}

.top-subtitle {
  font-size: 13px;
  color: #8a8f98;
}

/* Page Body */
.page-body {
  padding: 0 16px 20px;
}

/* Placeholder Card */
.placeholder-card {
  background: #0f1011;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-top: 60px;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.placeholder-title {
  font-size: 20px;
  font-weight: 600;
  color: #f7f8f8;
  margin-bottom: 12px;
}

.placeholder-desc {
  font-size: 13px;
  color: #8a8f98;
  line-height: 1.8;
}
</style>
