<template>
  <div class="page-container">
    <div class="wave-bg"></div>
    <div class="content-wrapper">
      <div class="header">
        <div class="user-info">
          <AvatarDisplay :avatar="user?.avatar" :size="50" class="avatar" />
          <div class="user-detail">
            <div class="nickname">{{ user?.nickname }}</div>
            <div class="user-title" v-if="userEquippedTitle">
              <TitleBadge :title="userEquippedTitle" size="small" />
            </div>
            <div class="user-id">ID: {{ shortUserId }}</div>
          </div>
        </div>
        <div class="header-icons">
          <div class="rank-icon" @click="goToRank">🏆</div>
          <van-badge :content="unreadNotificationCount" v-if="unreadNotificationCount > 0" :offset="[-5, 5]">
            <van-icon name="bell" size="28" color="#fff" @click="goToNotifications" />
          </van-badge>
          <van-icon v-else name="bell" size="28" color="#fff" @click="goToNotifications" />
          <van-badge :content="unreadCount" v-if="unreadCount > 0" :offset="[-5, 5]">
            <van-icon name="chat-o" size="28" color="#fff" @click="goToMessages" />
          </van-badge>
          <van-icon v-else name="chat-o" size="28" color="#fff" @click="goToMessages" />
        </div>
      </div>

      <div class="special-gift-marquee" v-if="marqueeMessages.length > 0">
        <div class="marquee-icon">✨</div>
        <div class="marquee-content">
          <div
            class="marquee-track"
            :style="{ animationDuration: marqueeDuration + 's' }"
          >
            <span
              v-for="(msg, idx) in [...marqueeMessages, ...marqueeMessages, ...marqueeMessages]"
              :key="idx"
              class="marquee-item"
            >{{ msg.icon }} {{ msg.sender }}赠送{{ msg.receiver }} {{ msg.giftName }}！！</span>
          </div>
        </div>
      </div>

      <div class="main-title">
        <h1>🌊 漂流瓶</h1>
        <p>将心事放入瓶中，与陌生人相遇</p>
      </div>

      <div class="bottle-animation" :style="bottleAnimBg">
        <div class="bottle floating" :style="bottleFloatStyle">
          <span class="bottle-emoji">{{ activeSkinEmoji }}</span>
        </div>
        <div v-if="activeSkin" class="skin-label" :style="skinLabelStyle">
          {{ activeSkin.emoji }} {{ activeSkin.name }}
        </div>
      </div>

      <div class="action-buttons">
        <div class="action-btn throw-btn" @click="goToThrow">
          <div class="btn-icon">📤</div>
          <div class="btn-text">
            <div class="btn-title">扔瓶子</div>
            <div class="btn-desc">写下你的心情</div>
          </div>
        </div>

        <div class="action-btn pick-btn" @click="goToPick">
          <div class="btn-icon">📥</div>
          <div class="btn-text">
            <div class="btn-title">捞瓶子</div>
            <div class="btn-desc">邂逅一段缘分</div>
          </div>
        </div>
      </div>

      <div class="my-bottles" @click="goToMessages">
        <span class="bottle-icon">🍾</span>
        <span>我的瓶子</span>
        <van-icon name="arrow" size="16" />
      </div>
    </div>

    <van-tabbar v-model="active" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o">首页</van-tabbar-item>
      <van-tabbar-item name="messages" icon="chat-o" :badge="unreadCount > 0 ? unreadCount : ''" @click="goToMessages">消息</van-tabbar-item>
      <van-tabbar-item name="welfare" icon="gift-o" @click="goToWelfare">福利</van-tabbar-item>
      <van-tabbar-item name="shop" icon="shop-o" @click="goToShop">商城</van-tabbar-item>
      <van-tabbar-item name="my" icon="user-o" @click="goToMy">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { getUser } from '../utils/storage';
import { getUnreadCount, getMySkins, getEquippedTitle, getUnreadNotificationCount, getSpecialGiftNotifications } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';
import TitleBadge from '../components/TitleBadge.vue';

const router = useRouter();
const user = ref(null);
const unreadCount = ref(0);
const unreadNotificationCount = ref(0);
const active = ref('home');
const activeSkin = ref(null);
const userEquippedTitle = ref(null);
const marqueeMessages = ref([]);
const marqueeDuration = ref(15);
const marqueePaused = ref(false);
let timer = null;
let marqueeTimer = null;
const displayedNotifIds = new Set();
let marqueeEndTimer = null;

const shortUserId = computed(() => {
  return user.value?.id ? user.value.id.slice(0, 8) : '';
});

const activeSkinEmoji = computed(() => {
  return activeSkin.value?.emoji || '🍾';
});

const bottleFloatStyle = computed(() => {
  if (!activeSkin.value) return {};
  return {
    filter: `drop-shadow(0 6px 16px ${activeSkin.value.border_color}88)`
  };
});

const bottleAnimBg = computed(() => {
  if (!activeSkin.value) return {};
  return {
    background: `radial-gradient(ellipse at center, ${activeSkin.value.gradient_from}20 0%, transparent 70%)`
  };
});

const skinLabelStyle = computed(() => {
  if (!activeSkin.value) return {};
  return {
    background: `linear-gradient(135deg, ${activeSkin.value.gradient_from}dd 0%, ${activeSkin.value.gradient_to}dd 100%)`,
    borderColor: activeSkin.value.border_color
  };
});

onMounted(() => {
  user.value = getUser();
  fetchUnreadCount();
  fetchMySkin();
  fetchEquippedTitle();
  fetchUnreadNotificationCount();
  fetchSpecialGiftNotifications();
  timer = setInterval(() => {
    fetchUnreadCount();
    fetchUnreadNotificationCount();
  }, 10000);
  marqueeTimer = setInterval(() => {
    fetchSpecialGiftNotifications();
  }, 15000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  if (marqueeTimer) clearInterval(marqueeTimer);
  if (marqueeEndTimer) clearTimeout(marqueeEndTimer);
});

async function fetchUnreadCount() {
  try {
    const result = await getUnreadCount();
    unreadCount.value = result.unreadCount;
  } catch (error) {
    console.error('获取未读消息数失败:', error);
  }
}

async function fetchMySkin() {
  try {
    const result = await getMySkins();
    activeSkin.value = result.activeSkin;
  } catch (error) {
    console.error('获取用户皮肤失败:', error);
  }
}

async function fetchEquippedTitle() {
  try {
    const result = await getEquippedTitle();
    userEquippedTitle.value = result;
  } catch (error) {
    console.error('获取用户称号失败:', error);
  }
}

async function fetchUnreadNotificationCount() {
  try {
    const result = await getUnreadNotificationCount();
    unreadNotificationCount.value = result?.count || 0;
  } catch (error) {
    console.error('获取未读通知数失败:', error);
  }
}

async function fetchSpecialGiftNotifications() {
  try {
    const result = await getSpecialGiftNotifications();
    const notifications = result.notifications || [];
    if (notifications.length === 0) {
      marqueeMessages.value = [];
      return;
    }

    const newNotifs = notifications.filter(n => !displayedNotifIds.has(n.id));
    if (newNotifs.length === 0 && marqueeMessages.value.length > 0) {
      return;
    }

    const messagesToShow = newNotifs.length > 0 ? newNotifs : notifications;

    const messages = [];
    messagesToShow.forEach(n => {
      displayedNotifIds.add(n.id);
      messages.push({
        icon: n.gift_icon,
        sender: n.sender_nickname,
        receiver: n.receiver_nickname,
        giftName: n.gift_name
      });
    });

    const hasNewContent = newNotifs.length > 0;
    const isFirstTime = marqueeMessages.value.length === 0;
    if (hasNewContent || isFirstTime) {
      marqueeMessages.value = messages;
      const perItemSeconds = 5;
      marqueeDuration.value = Math.max(messages.length * perItemSeconds, 10);
      if (marqueeEndTimer) clearTimeout(marqueeEndTimer);
      marqueeEndTimer = setTimeout(() => {
        marqueeMessages.value = [];
      }, marqueeDuration.value * 3 * 1000);
    }
  } catch (error) {
    console.error('获取特效礼物通知失败:', error);
  }
}

function goToThrow() {
  router.push('/throw');
}

function goToPick() {
  router.push('/pick');
}

function goToMy() {
  router.push('/my');
}

function goToWelfare() {
  router.push('/welfare');
}

function goToShop() {
  router.push('/shop');
}

function goToMessages() {
  router.push('/messages');
}

function goToRank() {
  router.push('/rank');
}

function goToNotifications() {
  router.push('/notifications');
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}

.header-icons {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rank-icon {
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  flex-shrink: 0;
}

.user-detail {
  color: #fff;
}

.nickname {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 2px;
}

.user-title {
  margin-bottom: 2px;
}

.user-id {
  font-size: 12px;
  opacity: 0.8;
}

.special-gift-marquee {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #fff9f0 0%, #ffe0ec 50%, #f0e0ff 100%);
  border-radius: 24px;
  padding: 8px 16px;
  margin-top: 12px;
  box-shadow: 0 2px 12px rgba(255, 107, 157, 0.2);
  border: 1px solid rgba(255, 107, 157, 0.2);
  overflow: hidden;
}

.marquee-icon {
  font-size: 18px;
  flex-shrink: 0;
  animation: marqueeIconSpin 2s linear infinite;
}

@keyframes marqueeIconSpin {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.2); }
  100% { transform: rotate(360deg) scale(1); }
}

.marquee-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  height: 22px;
}

.marquee-track {
  display: flex;
  align-items: center;
  gap: 60px;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  white-space: nowrap;
  animation: marqueeScroll linear infinite;
  animation-duration: 15s;
}

@keyframes marqueeScroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-33.3333%);
  }
}

.marquee-item {
  font-size: 13px;
  font-weight: 500;
  color: #c44569;
  white-space: nowrap;
  flex-shrink: 0;
}

.main-title {
  text-align: center;
  margin: 40px 0;
  color: #fff;
}

.main-title h1 {
  font-size: 36px;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

.main-title p {
  font-size: 14px;
  opacity: 0.9;
}

.bottle-animation {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 30px 0;
  height: 200px;
}

.bottle {
  font-size: 120px;
  animation: float 3s ease-in-out infinite;
}

.bottle-emoji {
  font-size: inherit;
}

.skin-label {
  margin-top: 8px;
  padding: 3px 12px;
  border-radius: 16px;
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) rotate(-5deg);
  }
  50% {
    transform: translateY(-20px) rotate(5deg);
  }
}

.action-buttons {
  display: flex;
  gap: 20px;
  margin-top: 40px;
}

.action-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.action-btn:active {
  transform: scale(0.95);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.btn-icon {
  font-size: 40px;
}

.btn-text {
  text-align: center;
}

.btn-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.btn-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.my-bottles {
  margin-top: 30px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #333;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.my-bottles span {
  flex: 1;
  font-size: 15px;
}

.bottle-icon {
  font-size: 20px;
  line-height: 1;
}
</style>
