<template>
  <div class="gifts-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="header-content">
        <div class="back-btn" @click="goBack">
          <van-icon name="arrow-left" size="20" color="#fff" />
        </div>
        <h2 class="page-title">🎁 我的礼物</h2>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="charm-card">
        <div class="charm-icon">✨</div>
        <div class="charm-info">
          <div class="charm-label">魅力值</div>
          <div class="charm-value">{{ charm }}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">礼物统计</div>
        <div class="gift-stats" v-if="giftStats.length > 0">
          <div
            v-for="stat in giftStats"
            :key="stat.gift_key"
            class="stat-item"
          >
            <div class="stat-icon">{{ stat.gift_icon }}</div>
            <div class="stat-name">{{ stat.gift_name }}</div>
            <div class="stat-count">x{{ stat.count }}</div>
          </div>
        </div>
        <div class="empty-mini" v-else>
          还没有收到礼物
        </div>
      </div>

      <div class="section">
        <div class="section-title">收到的礼物</div>
        <div class="gift-list" v-if="receivedGifts.length > 0">
          <div
            v-for="gift in receivedGifts"
            :key="gift.id"
            class="gift-item"
          >
            <div class="gift-icon">{{ gift.gift_icon }}</div>
            <div class="gift-info">
              <div class="gift-name-row">
                <span class="gift-name">{{ gift.gift_name }}</span>
                <span class="gift-charm">+{{ gift.charm_value }}魅力</span>
              </div>
              <div class="gift-sender">
                来自 <span class="sender-name">{{ gift.sender_nickname || '匿名用户' }}</span>
              </div>
              <div class="gift-time">{{ formatTime(gift.created_at) }}</div>
            </div>
          </div>
        </div>
        <div class="empty-state" v-else-if="!loading">
          <div class="empty-icon">🎁</div>
          <div class="empty-text">还没有收到礼物</div>
          <div class="empty-desc">多多互动，收到更多惊喜</div>
        </div>
      </div>

      <van-loading v-if="loading" color="#1989fa" style="margin-top: 40px; display: block; text-align: center;">加载中...</van-loading>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getGiftInfo } from '../api';

const router = useRouter();
const charm = ref(0);
const receivedGifts = ref([]);
const giftStats = ref([]);
const loading = ref(false);

onMounted(() => {
  fetchGiftInfo();
});

async function fetchGiftInfo() {
  loading.value = true;
  try {
    const result = await getGiftInfo();
    charm.value = result.charm;
    receivedGifts.value = result.receivedGifts;
    giftStats.value = result.giftStats;
  } catch (error) {
    console.error('获取礼物信息失败:', error);
  } finally {
    loading.value = false;
  }
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function goBack() {
  router.back();
}
</script>

<style scoped>
.gifts-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 20px;
}

.header {
  position: relative;
  padding-top: 16px;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%);
  border-radius: 0 0 24px 24px;
}

.header-content {
  position: relative;
  z-index: 1;
  padding: 16px 20px 24px;
  color: #fff;
  display: flex;
  align-items: center;
}

.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.page-title {
  font-size: 20px;
  margin: 0;
  font-weight: bold;
}

.content-wrapper {
  padding: 0 16px;
  margin-top: -20px;
  position: relative;
  z-index: 2;
}

.charm-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.charm-icon {
  font-size: 48px;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fff0f5 0%, #ffe0ec 100%);
  border-radius: 50%;
}

.charm-info {
  flex: 1;
}

.charm-label {
  font-size: 14px;
  color: #999;
  margin-bottom: 4px;
}

.charm-value {
  font-size: 32px;
  font-weight: bold;
  background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.section {
  margin-top: 20px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 12px;
  padding-left: 4px;
}

.gift-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stat-item {
  background: #fff;
  border-radius: 12px;
  padding: 14px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 6px;
}

.stat-name {
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
}

.stat-count {
  font-size: 14px;
  font-weight: bold;
  color: #ff6b9d;
}

.empty-mini {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: #999;
  font-size: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

.gift-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gift-item {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

.gift-icon {
  font-size: 36px;
  flex-shrink: 0;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff0f5;
  border-radius: 50%;
}

.gift-info {
  flex: 1;
  min-width: 0;
}

.gift-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.gift-name {
  font-size: 15px;
  font-weight: bold;
  color: #333;
}

.gift-charm {
  font-size: 11px;
  color: #ff6b9d;
  background: #fff0f5;
  padding: 1px 6px;
  border-radius: 6px;
}

.gift-sender {
  font-size: 12px;
  color: #999;
  margin-bottom: 2px;
}

.sender-name {
  color: #667eea;
  font-weight: 500;
}

.gift-time {
  font-size: 11px;
  color: #bbb;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 14px;
  opacity: 0.4;
}

.empty-text {
  font-size: 16px;
  font-weight: bold;
  color: #666;
  margin-bottom: 4px;
}

.empty-desc {
  font-size: 13px;
}
</style>
