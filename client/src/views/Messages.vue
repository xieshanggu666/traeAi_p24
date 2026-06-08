<template>
  <div class="messages-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="header-content">
        <h2 class="page-title">💬 消息</h2>
        <p class="page-desc">我的瓶子与对话</p>
      </div>
    </div>

    <div class="filter-tabs">
      <div
        class="filter-tab"
        :class="{ active: activeFilter === 'all' }"
        @click="activeFilter = 'all'"
      >
        全部
        <span class="tab-count" v-if="allBottles.length > 0">{{ allBottles.length }}</span>
      </div>
      <div
        class="filter-tab"
        :class="{ active: activeFilter === 'replied' }"
        @click="activeFilter = 'replied'"
      >
        对话中
        <span class="tab-count" v-if="repliedBottles.length > 0">{{ repliedBottles.length }}</span>
      </div>
      <div
        class="filter-tab"
        :class="{ active: activeFilter === 'waiting' }"
        @click="activeFilter = 'waiting'"
      >
        等待中
        <span class="tab-count" v-if="waitingBottles.length > 0">{{ waitingBottles.length }}</span>
      </div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="message-list">
        <van-swipe-cell
          v-for="bottle in filteredBottles"
          :key="bottle.id"
        >
          <div
            class="message-item"
            :class="{ 'message-item-replied': bottle.status === 'replied' }"
            @click="handleBottleClick(bottle)"
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
                <div class="message-nickname-row">
                  <span class="message-nickname">{{ bottle.other_nickname }}</span>
                  <span class="status-tag" :class="getStatusClass(bottle)">
                    {{ getStatusText(bottle) }}
                  </span>
                </div>
                <div class="message-preview">
                  <template v-if="bottle.latest_message">
                    <span v-if="bottle.latest_sender_id === currentUserId" class="preview-prefix">我: </span>
                    <span>{{ bottle.latest_message }}</span>
                  </template>
                  <template v-else-if="bottle.status === 'picked'">
                    <span class="preview-bottle-content">对方捡到了你的瓶子：</span>{{ bottle.content }}
                  </template>
                  <template v-else-if="bottle.status === 'floating'">
                    <span class="preview-bottle-content">瓶子内容：</span>{{ bottle.content }}
                  </template>
                  <template v-else>
                    <span class="preview-bottle-content">瓶子内容：</span>{{ bottle.content }}
                  </template>
                </div>
              </div>
              <div class="message-meta">
                <div class="message-time">{{ formatTime(bottle.latest_message_time || bottle.created_at) }}</div>
                <div class="unread-badge" v-if="bottle.unread_count > 0 && bottle.latest_sender_id !== currentUserId">
                  {{ bottle.unread_count > 99 ? '99+' : bottle.unread_count }}
                </div>
                <div class="type-badge" v-if="bottle.type === 'sent'">发出</div>
                <div class="type-badge received" v-else>收到</div>
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

        <div class="empty-state" v-if="filteredBottles.length === 0 && !loading && !fetchError">
          <div class="empty-icon">📭</div>
          <div class="empty-text" v-if="activeFilter === 'all'">还没有瓶子</div>
          <div class="empty-text" v-else-if="activeFilter === 'replied'">没有进行中的对话</div>
          <div class="empty-text" v-else>没有等待中的瓶子</div>
          <div class="empty-desc" v-if="activeFilter === 'all'">扔个瓶子或捞个瓶子开始吧</div>
          <div class="empty-desc" v-else>切换到"全部"查看所有瓶子</div>
          <van-button
            type="primary"
            size="small"
            style="margin-top: 20px;"
            @click="goToHome"
            v-if="activeFilter === 'all'"
          >
            去扔瓶子
          </van-button>
        </div>

        <div class="error-state" v-if="fetchError && !loading">
          <div class="error-icon">⚠️</div>
          <div class="error-text">加载失败</div>
          <div class="error-desc">{{ fetchError }}</div>
          <van-button
            type="primary"
            size="small"
            style="margin-top: 16px;"
            @click="fetchBottles"
          >
            重新加载
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
import { showToast, showDialog } from 'vant';
import { getUser } from '../utils/storage';
import { getMyBottles, softDeleteBottle, deleteBottle, getUnreadCount } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const route = useRoute();
const user = ref(null);
const activeBottom = ref('messages');
const activeFilter = ref('all');
const allBottles = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const totalUnread = ref(0);
const fetchError = ref(null);
let timer = null;

const currentUserId = computed(() => user.value?.id);

const repliedBottles = computed(() => {
  return allBottles.value.filter(b => b.status === 'replied');
});

const waitingBottles = computed(() => {
  return allBottles.value.filter(b => b.status !== 'replied');
});

const filteredBottles = computed(() => {
  switch (activeFilter.value) {
    case 'replied':
      return repliedBottles.value;
    case 'waiting':
      return waitingBottles.value;
    default:
      return allBottles.value;
  }
});

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

function sortBottles(bottles) {
  return bottles.sort((a, b) => {
    const aHasUnread = a.unread_count > 0 && a.latest_sender_id !== currentUserId.value;
    const bHasUnread = b.unread_count > 0 && b.latest_sender_id !== currentUserId.value;
    if (aHasUnread && !bHasUnread) return -1;
    if (!aHasUnread && bHasUnread) return 1;
    const aIsReplied = a.status === 'replied';
    const bIsReplied = b.status === 'replied';
    if (aIsReplied && !bIsReplied) return -1;
    if (!aIsReplied && bIsReplied) return 1;
    const aTime = a.latest_message_time ? new Date(a.latest_message_time) : new Date(a.created_at);
    const bTime = b.latest_message_time ? new Date(b.latest_message_time) : new Date(b.created_at);
    return bTime - aTime;
  });
}

async function fetchBottles() {
  loading.value = true;
  fetchError.value = null;
  try {
    const result = await getMyBottles();
    const previousData = [...allBottles.value];
    allBottles.value = sortBottles(result);
  } catch (error) {
    fetchError.value = error.businessMessage || error.httpMessage || '网络异常，请稍后重试';
    console.error('获取消息列表失败:', error);
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  fetchError.value = null;
  try {
    const result = await getMyBottles();
    allBottles.value = sortBottles(result);
    await fetchUnreadCount();
  } catch (error) {
    fetchError.value = error.businessMessage || error.httpMessage || '刷新失败，请重试';
    console.error('刷新失败:', error);
  } finally {
    refreshing.value = false;
  }
}

async function handleDelete(bottle) {
  try {
    await showDialog({
      title: '确认删除',
      message: '删除后将无法恢复，确定要删除吗？',
      showCancelButton: true,
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonColor: '#ff4d4f'
    });

    const previousBottles = [...allBottles.value];

    try {
      if (bottle.type === 'sent') {
        await deleteBottle(bottle.id);
      } else {
        await softDeleteBottle(bottle.id);
      }
      showToast('删除成功');
      allBottles.value = allBottles.value.filter(b => b.id !== bottle.id);
      await fetchUnreadCount();
    } catch (error) {
      allBottles.value = previousBottles;
      showToast(error.businessMessage || error.httpMessage || '删除失败，请重试');
    }
  } catch {
    // User cancelled dialog
  }
}

function getStatusClass(bottle) {
  switch (bottle.status) {
    case 'replied': return 'status-replied';
    case 'picked': return 'status-picked';
    case 'floating': return 'status-floating';
    default: return 'status-floating';
  }
}

function getStatusText(bottle) {
  switch (bottle.status) {
    case 'replied': return '对话中';
    case 'picked': return '已捡起';
    case 'floating': return '漂流中';
    default: return '未知';
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

function handleBottleClick(bottle) {
  if (bottle.status === 'replied') {
    router.push(`/chat/${bottle.id}`);
  } else if (bottle.status === 'picked') {
    showToast('瓶子已被捡起，等待对方回复');
  } else {
    showToast('瓶子还在海里漂流，等待被捞取');
  }
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

.filter-tabs {
  display: flex;
  gap: 0;
  padding: 0 16px;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 12px;
  margin-left: 16px;
  margin-right: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.filter-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 0;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.filter-tab.active {
  color: #667eea;
  font-weight: bold;
  border-bottom-color: #667eea;
}

.tab-count {
  font-size: 11px;
  background: #f0f0f0;
  color: #999;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: normal;
}

.filter-tab.active .tab-count {
  background: #667eea20;
  color: #667eea;
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
  border-left: 3px solid #ddd;
}

.message-item:active {
  transform: scale(0.98);
}

.message-item-replied {
  border-left-color: #667eea;
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

.message-nickname-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.message-nickname {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.status-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: normal;
  flex-shrink: 0;
}

.status-replied {
  background: #667eea20;
  color: #667eea;
}

.status-picked {
  background: #ff976a20;
  color: #ff976a;
}

.status-floating {
  background: #99999920;
  color: #999;
}

.message-preview {
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-prefix {
  color: #bbb;
}

.preview-bottle-content {
  color: #bbb;
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

.type-badge {
  font-size: 10px;
  color: #1989fa;
  background: #1989fa15;
  padding: 1px 6px;
  border-radius: 6px;
}

.type-badge.received {
  color: #07c160;
  background: #07c16015;
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

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.error-text {
  font-size: 16px;
  font-weight: bold;
  color: #ff4d4f;
  margin-bottom: 6px;
}

.error-desc {
  font-size: 13px;
  color: #999;
  text-align: center;
  max-width: 260px;
}

.delete-btn {
  height: 100% !important;
}
</style>
