<template>
  <div class="messages-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="header-content">
        <h2 class="page-title">💬 消息</h2>
      </div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-tabs v-model:active="activeTab" sticky offset-top="84" lazy-render>
        <van-tab title="待回复" :badge="unreadRepliedCount > 0 ? unreadRepliedCount : ''">
          <div class="section" v-if="repliedBottles.length > 0 || loading">
            <div class="section-list">
              <van-swipe-cell v-for="bottle in repliedBottles" :key="bottle.id">
                <div class="msg-card msg-card-active" @click="goToChat(bottle)">
                  <div class="msg-avatar">
                    <AvatarDisplay :avatar="bottle.other_avatar" :size="46" />
                    <span class="unread-dot" v-if="bottle.unread_count > 0 && bottle.latest_sender_id !== currentUserId"></span>
                  </div>
                  <div class="msg-body">
                    <div class="msg-top-row">
                      <span class="msg-name">{{ bottle.other_nickname }}</span>
                      <span class="msg-time">{{ formatTime(bottle.latest_message_time || bottle.created_at) }}</span>
                    </div>
                    <div class="msg-bottom-row">
                      <span class="msg-preview">
                        <span v-if="bottle.latest_sender_id === currentUserId" class="prefix-self">我: </span>
                        {{ bottle.latest_message || bottle.content }}
                      </span>
                      <span class="msg-unread" v-if="bottle.unread_count > 0 && bottle.latest_sender_id !== currentUserId">
                        {{ bottle.unread_count > 99 ? '99+' : bottle.unread_count }}
                      </span>
                    </div>
                  </div>
                </div>
                <template #right>
                  <van-button square type="danger" class="swipe-delete" text="删除" @click="handleDelete(bottle)" />
                </template>
              </van-swipe-cell>
            </div>
          </div>
          <div class="empty-state" v-if="repliedBottles.length === 0 && !loading && !fetchError">
            <div class="empty-icon">📭</div>
            <div class="empty-text">暂无待回复消息</div>
            <div class="empty-desc">捞个瓶子开始聊天吧</div>
          </div>
        </van-tab>

        <van-tab title="我的发起">
          <div class="section" v-if="sentBottles.length > 0 || loading">
            <div class="section-list">
              <van-swipe-cell v-for="bottle in sentBottles" :key="bottle.id">
                <div class="msg-card" @click="handleSentClick(bottle)">
                  <div class="msg-avatar">
                    <AvatarDisplay :avatar="bottle.other_avatar" :size="46" />
                  </div>
                  <div class="msg-body">
                    <div class="msg-top-row">
                      <span class="msg-name">{{ bottle.other_nickname }}</span>
                      <span class="msg-badge" :class="'badge-' + bottle.status">{{ getStatusText(bottle) }}</span>
                      <span class="msg-time">{{ formatTime(bottle.created_at) }}</span>
                    </div>
                    <div class="msg-bottom-row">
                      <span class="msg-preview">{{ bottle.content }}</span>
                    </div>
                  </div>
                </div>
                <template #right>
                  <van-button square type="danger" class="swipe-delete" text="删除" @click="handleDelete(bottle)" />
                </template>
              </van-swipe-cell>
            </div>
          </div>
          <div class="empty-state" v-if="sentBottles.length === 0 && !loading && !fetchError">
            <div class="empty-icon">🍾</div>
            <div class="empty-text">还没有发起过瓶子</div>
            <div class="empty-desc">扔个瓶子开始吧</div>
          </div>
        </van-tab>
      </van-tabs>

      <div class="error-state" v-if="fetchError && !loading">
        <div class="error-icon">⚠️</div>
        <div class="error-text">加载失败</div>
        <div class="error-desc">{{ fetchError }}</div>
        <van-button type="primary" size="small" style="margin-top: 16px;" @click="fetchBottles">重新加载</van-button>
      </div>

      <van-loading v-if="loading" color="#1989fa" style="margin-top: 40px; display: block; text-align: center;">加载中...</van-loading>
    </van-pull-refresh>

    <van-tabbar v-model="activeBottom" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o" @click="goToHome">首页</van-tabbar-item>
      <van-tabbar-item name="messages" icon="chat-o" :badge="totalUnread > 0 ? totalUnread : ''">消息</van-tabbar-item>
      <van-tabbar-item name="welfare" icon="gift-o" @click="goToWelfare">福利</van-tabbar-item>
      <van-tabbar-item name="shop" icon="shop-o" @click="goToShop">商城</van-tabbar-item>
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
const activeTab = ref(0);
const allBottles = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const totalUnread = ref(0);
const fetchError = ref(null);
let timer = null;

const currentUserId = computed(() => user.value?.id);

const repliedBottles = computed(() => {
  return allBottles.value
    .filter(b => b.status === 'replied')
    .sort((a, b) => {
      const aHasUnread = a.unread_count > 0 && a.latest_sender_id !== currentUserId.value;
      const bHasUnread = b.unread_count > 0 && b.latest_sender_id !== currentUserId.value;
      if (aHasUnread && !bHasUnread) return -1;
      if (!aHasUnread && bHasUnread) return 1;
      const aTime = a.latest_message_time ? new Date(a.latest_message_time) : new Date(a.created_at);
      const bTime = b.latest_message_time ? new Date(b.latest_message_time) : new Date(b.created_at);
      return bTime - aTime;
    });
});

const unreadRepliedCount = computed(() => {
  let count = 0;
  for (const b of repliedBottles.value) {
    if (b.unread_count > 0 && b.latest_sender_id !== currentUserId.value) {
      count += b.unread_count;
    }
  }
  return count;
});

const sentBottles = computed(() => {
  return allBottles.value
    .filter(b => b.type === 'sent')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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

async function fetchBottles() {
  loading.value = true;
  fetchError.value = null;
  try {
    const result = await getMyBottles();
    allBottles.value = result;
  } catch (error) {
    fetchError.value = error.businessMessage || error.httpMessage || '网络异常，请稍后重试';
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  fetchError.value = null;
  try {
    const result = await getMyBottles();
    allBottles.value = result;
    await fetchUnreadCount();
  } catch (error) {
    fetchError.value = error.businessMessage || error.httpMessage || '刷新失败，请重试';
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
    // cancelled
  }
}

function getStatusText(bottle) {
  switch (bottle.status) {
    case 'replied': return '对话中';
    case 'picked': return '已捡起';
    case 'floating': return '漂流中';
    default: return '';
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
  router.push(`/chat/${bottle.id}`);
}

function handleSentClick(bottle) {
  if (bottle.status === 'replied') {
    router.push(`/chat/${bottle.id}`);
  } else if (bottle.status === 'picked') {
    showToast('瓶子已被捡起，等待对方回复');
  } else {
    showToast('瓶子还在海里漂流，等待被捞取');
  }
}

function goToHome() { router.push('/'); }
function goToWelfare() { router.push('/welfare'); }
function goToShop() { router.push('/shop'); }
function goToMy() { router.push('/my'); }
</script>

<style scoped>
.messages-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 50px;
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
  height: 100px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 0 24px 24px;
}

.header-content {
  position: relative;
  z-index: 1;
  padding: 16px 20px 20px;
  color: #fff;
}

.page-title {
  font-size: 22px;
  margin: 0;
}

.section {
  margin: 8px 16px 16px;
}

.section-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.msg-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s;
}

.msg-card:active {
  transform: scale(0.98);
}

.msg-card-active {
  border-left: 3px solid #667eea;
}

.msg-avatar {
  position: relative;
  flex-shrink: 0;
}

.unread-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  background: #ff4d4f;
  border-radius: 50%;
  border: 2px solid #fff;
}

.msg-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.msg-top-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.msg-name {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
  flex-shrink: 0;
}

.msg-time {
  font-size: 12px;
  color: #bbb;
  margin-left: auto;
  flex-shrink: 0;
}

.msg-badge {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 8px;
  flex-shrink: 0;
}

.badge-replied {
  background: #667eea20;
  color: #667eea;
}

.badge-picked {
  background: #ff976a20;
  color: #ff976a;
}

.badge-floating {
  background: #99999920;
  color: #999;
}

.msg-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.msg-preview {
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.prefix-self {
  color: #bbb;
}

.msg-unread {
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
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
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

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: #999;
}

.error-icon {
  font-size: 44px;
  margin-bottom: 10px;
}

.error-text {
  font-size: 16px;
  font-weight: bold;
  color: #ff4d4f;
  margin-bottom: 4px;
}

.error-desc {
  font-size: 13px;
  color: #999;
}

.swipe-delete {
  height: 100% !important;
}
</style>
