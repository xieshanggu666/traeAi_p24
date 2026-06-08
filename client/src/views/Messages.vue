<template>
  <div class="messages-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="header-content">
        <h2 class="page-title">💬 消息</h2>
        <p class="page-desc">与陌生人的对话</p>
      </div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="message-list">
        <van-swipe-cell
          v-for="bottle in bottles"
          :key="bottle.id"
        >
          <div
            class="message-item"
            @click="goToChat(bottle)"
          >
            <div class="message-item-header">
              <div class="avatar-wrapper">
                <AvatarDisplay :avatar="bottle.other_avatar" :size="48" />
                <span
                  class="unread-dot"
                  v-if="bottle.unread_count > 0 && bottle.latest_sender_id !== currentUserId"
                ></span>
              </div>
              <div class="message-user-info">
                <div class="message-nickname">{{ bottle.other_nickname }}</div>
                <div class="message-preview">
                  <span v-if="bottle.latest_message">
                    {{ bottle.latest_sender_id === currentUserId ? '我: ' : '' }}{{ bottle.latest_message }}
                  </span>
                  <span v-else class="no-message">对方回复了你的瓶子</span>
                </div>
              </div>
              <div class="message-meta">
                <div class="message-time">{{ formatTime(bottle.latest_message_time || bottle.created_at) }}</div>
                <div class="unread-badge" v-if="bottle.unread_count > 0 && bottle.latest_sender_id !== currentUserId">
                  {{ bottle.unread_count > 99 ? '99+' : bottle.unread_count }}
                </div>
              </div>
            </div>
          </div>
          <template #right>
            <van-button
              square
              type="danger"
              class="delete-btn"
              text="删除"
              @click="handleDelete(bottle)"
            />
          </template>
        </van-swipe-cell>

        <div class="empty-state" v-if="bottles.length === 0 && !loading">
          <div class="empty-icon">📭</div>
          <div class="empty-text">还没有对话</div>
          <div class="empty-desc">扔个瓶子或捞个瓶子开始对话吧</div>
          <van-button
            type="primary"
            size="small"
            style="margin-top: 20px;"
            @click="goToHome"
          >
            去扔瓶子
          </van-button>
        </div>

        <van-loading v-if="loading" color="#1989fa" style="margin-top: 40px; display: block; text-align: center;">
          加载中...
        </van-loading>
      </div>
    </van-pull-refresh>

    <van-tabbar v-model="activeBottom" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o" @click="goToHome">首页</van-tabbar-item>
      <van-tabbar-item name="messages" icon="chat-o" :badge="totalUnread > 0 ? totalUnread : ''">消息</van-tabbar-item>
      <van-tabbar-item name="welfare" icon="gift-o" @click="goToWelfare">福利</van-tabbar-item>
      <van-tabbar-item name="my" icon="user-o" @click="goToMy">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast } from 'vant';
import { getUser } from '../utils/storage';
import { getMyBottles, softDeleteBottle, getUnreadCount } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const route = useRoute();
const user = ref(null);
const activeBottom = ref('messages');
const bottles = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const totalUnread = ref(0);
let timer = null;

const currentUserId = computed(() => user.value?.id);

onMounted(() => {
  user.value = getUser();
  if (user.value) {
    fetchBottles();
  }
  fetchUnreadCount();
  timer = setInterval(fetchUnreadCount, 10000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

watch(
  () => route.path,
  () => {
    if (route.path === '/messages' && user.value) {
      fetchBottles();
      fetchUnreadCount();
    }
  }
);

async function fetchUnreadCount() {
  try {
    const result = await getUnreadCount();
    totalUnread.value = result.unreadCount;
  } catch (error) {
    console.error('获取未读消息数失败:', error);
  }
}

async function fetchBottles() {
  loading.value = true;
  try {
    const result = await getMyBottles();
    bottles.value = result.filter(b => b.status === 'replied').sort((a, b) => {
      const aHasUnread = a.unread_count > 0 && a.latest_sender_id !== currentUserId.value;
      const bHasUnread = b.unread_count > 0 && b.latest_sender_id !== currentUserId.value;
      if (aHasUnread && !bHasUnread) return -1;
      if (!aHasUnread && bHasUnread) return 1;
      const aTime = a.latest_message_time ? new Date(a.latest_message_time) : new Date(a.created_at);
      const bTime = b.latest_message_time ? new Date(b.latest_message_time) : new Date(b.created_at);
      return bTime - aTime;
    });
  } catch (error) {
    console.error('获取消息列表失败:', error);
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  try {
    const result = await getMyBottles();
    bottles.value = result.filter(b => b.status === 'replied').sort((a, b) => {
      const aHasUnread = a.unread_count > 0 && a.latest_sender_id !== currentUserId.value;
      const bHasUnread = b.unread_count > 0 && b.latest_sender_id !== currentUserId.value;
      if (aHasUnread && !bHasUnread) return -1;
      if (!aHasUnread && bHasUnread) return 1;
      const aTime = a.latest_message_time ? new Date(a.latest_message_time) : new Date(a.created_at);
      const bTime = b.latest_message_time ? new Date(b.latest_message_time) : new Date(b.created_at);
      return bTime - aTime;
    });
    await fetchUnreadCount();
  } catch (error) {
    console.error('刷新失败:', error);
  } finally {
    refreshing.value = false;
  }
}

async function handleDelete(bottle) {
  try {
    const isSender = bottle.type === 'sent';
    if (isSender) {
      const { deleteBottle } = await import('../api');
      await deleteBottle(bottle.id);
    } else {
      await softDeleteBottle(bottle.id);
    }
    showToast('操作成功');
    bottles.value = bottles.value.filter(b => b.id !== bottle.id);
    await fetchUnreadCount();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  }
}

function formatTime(time) {
  if (!time) return '';
  const date = new Date(time);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 172800000) return '昨天';
  return `${Math.floor(diff / 86400000)}天前`;
}

function goToChat(bottle) {
  if (bottle.status !== 'replied') {
    showToast('对话尚未建立');
    return;
  }
  router.push(`/chat/${bottle.id}`);
}

function goToHome() {
  router.push('/');
}

function goToWelfare() {
  router.push('/welfare');
}

function goToMy() {
  router.push('/my');
}
</script>

<style scoped>
.messages-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 50px;
}

.header {
  position: relative;
  padding-top: 20px;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 140px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 0 30px 30px;
}

.header-content {
  position: relative;
  z-index: 1;
  padding: 20px 20px 30px;
  color: #fff;
}

.page-title {
  font-size: 24px;
  margin: 0 0 6px;
}

.page-desc {
  font-size: 14px;
  opacity: 0.85;
  margin: 0;
}

.message-list {
  padding: 0 16px;
}

.message-item {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
}

.message-item:active {
  transform: scale(0.98);
}

.message-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.unread-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  background: #ff4d4f;
  border-radius: 50%;
  border: 2px solid #fff;
}

.message-user-info {
  flex: 1;
  min-width: 0;
}

.message-nickname {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.message-preview {
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-message {
  color: #ccc;
  font-style: italic;
}

.message-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.message-time {
  font-size: 12px;
  color: #bbb;
}

.unread-badge {
  min-width: 18px;
  height: 18px;
  background: #ff4d4f;
  color: #fff;
  font-size: 11px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #999;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 16px;
  font-weight: bold;
  color: #666;
  margin-bottom: 6px;
}

.empty-desc {
  font-size: 14px;
}

.delete-btn {
  height: 100% !important;
}
</style>
