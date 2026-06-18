<template>
  <div class="notifications-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="header-content">
        <div class="back-btn" @click="goBack">
          <van-icon name="arrow-left" size="20" color="#fff" />
        </div>
        <h2 class="page-title">🔔 消息通知</h2>
        <div class="header-right" @click="handleMarkAllRead" v-if="unreadCount > 0">
          <span class="mark-all-btn">全部已读</span>
        </div>
        <div class="header-right" v-else></div>
      </div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="content" v-if="notifications.length > 0 || loading">
        <div class="notification-list">
          <div 
            v-for="item in notifications" 
            :key="item.id"
            class="notification-item"
            :class="{ 'is-unread': !item.is_read }"
            @click="handleNotificationClick(item)"
          >
            <div class="notification-icon" :class="getIconClass(item.type)">
              {{ getNotificationIcon(item.type) }}
            </div>
            <div class="notification-content">
              <div class="notification-header">
                <span class="notification-title">{{ item.title }}</span>
                <span class="notification-time">{{ formatTime(item.created_at) }}</span>
              </div>
              <div class="notification-desc">{{ item.content }}</div>
            </div>
            <div class="unread-dot" v-if="!item.is_read"></div>
          </div>
        </div>
        
        <van-loading v-if="loading" color="#1989fa" style="margin-top: 20px; display: block; text-align: center;">
          加载中...
        </van-loading>
        
        <div class="load-more" v-if="!loading && hasMore" @click="loadMore">
          <span>加载更多</span>
        </div>
        <div class="no-more" v-else-if="!loading && notifications.length > 0">
          没有更多了
        </div>
      </div>

      <div class="empty-state" v-if="notifications.length === 0 && !loading">
        <div class="empty-icon">🔕</div>
        <div class="empty-text">暂无通知</div>
        <div class="empty-desc">新的通知会在这里显示哦</div>
      </div>
    </van-pull-refresh>

    <van-tabbar v-model="activeBottom" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o" @click="goToHome">首页</van-tabbar-item>
      <van-tabbar-item name="messages" icon="chat-o" @click="goToMessages">消息</van-tabbar-item>
      <van-tabbar-item name="welfare" icon="gift-o" @click="goToWelfare">福利</van-tabbar-item>
      <van-tabbar-item name="shop" icon="shop-o" @click="goToShop">商城</van-tabbar-item>
      <van-tabbar-item name="my" icon="user-o" @click="goToMy">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '../api';

const router = useRouter();
const activeBottom = ref('my');
const notifications = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const page = ref(1);
const pageSize = ref(20);
const hasMore = ref(true);
const unreadCount = ref(0);

function getNotificationIcon(type) {
  const iconMap = {
    title_obtained: '🏆',
    title_expired: '⏰',
    system: '📢',
    gift: '🎁',
    friend: '👋',
    default: '🔔'
  };
  return iconMap[type] || iconMap.default;
}

function getIconClass(type) {
  return `icon-${type || 'default'}`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 172800000) return '昨天';
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}-${day}`;
}

async function fetchNotifications(isRefresh = false) {
  if (isRefresh) {
    page.value = 1;
    hasMore.value = true;
  }
  
  if (!hasMore.value && !isRefresh) return;
  
  loading.value = true;
  try {
    const result = await getNotifications(page.value, pageSize.value);
    
    if (isRefresh) {
      notifications.value = result.list || [];
    } else {
      notifications.value = [...notifications.value, ...(result.list || [])];
    }
    
    hasMore.value = notifications.value.length < result.total;
    page.value++;
    
    fetchUnreadCount();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function fetchUnreadCount() {
  try {
    const result = await getUnreadNotificationCount();
    unreadCount.value = result?.count || 0;
  } catch (error) {
    console.error('获取未读通知数失败:', error);
  }
}

async function onRefresh() {
  try {
    await fetchNotifications(true);
  } finally {
    refreshing.value = false;
  }
}

function loadMore() {
  fetchNotifications(false);
}

async function handleNotificationClick(item) {
  if (!item.is_read) {
    try {
      await markNotificationRead(item.id);
      item.is_read = 1;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  }
  
  if (item.type === 'title_obtained') {
    router.push('/titles');
  }
}

async function handleMarkAllRead() {
  try {
    await markAllNotificationsRead();
    notifications.value.forEach(item => {
      item.is_read = 1;
    });
    unreadCount.value = 0;
    showToast('已全部标记为已读');
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '操作失败');
  }
}

function goBack() {
  router.back();
}

function goToHome() { router.push('/'); }
function goToMessages() { router.push('/messages'); }
function goToWelfare() { router.push('/welfare'); }
function goToShop() { router.push('/shop'); }
function goToMy() { router.push('/my'); }

onMounted(() => {
  fetchNotifications(true);
});
</script>

<style scoped>
.notifications-page {
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 20px;
  color: #fff;
}

.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.header-right {
  width: auto;
  cursor: pointer;
}

.mark-all-btn {
  font-size: 13px;
  opacity: 0.9;
  padding: 4px 8px;
}

.page-title {
  font-size: 20px;
  margin: 0;
}

.content {
  padding: 16px;
}

.notification-list {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:active {
  background: #f9f9f9;
}

.notification-item.is-unread {
  background: #f0f7ff;
}

.notification-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 20px;
  flex-shrink: 0;
  background: #f0f0f0;
}

.icon-title_obtained {
  background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
}

.icon-title_expired {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
}

.icon-system {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.icon-gift {
  background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%);
}

.icon-friend {
  background: linear-gradient(135deg, #07c160 0%, #00a870 100%);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
}

.notification-desc {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.unread-dot {
  position: absolute;
  top: 20px;
  right: 16px;
  width: 8px;
  height: 8px;
  background: #ff4d4f;
  border-radius: 50%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  color: #999;
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 14px;
  opacity: 0.5;
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

.load-more {
  text-align: center;
  padding: 20px;
  color: #1989fa;
  font-size: 13px;
  cursor: pointer;
}

.no-more {
  text-align: center;
  padding: 20px;
  color: #ccc;
  font-size: 12px;
}
</style>
