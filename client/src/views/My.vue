<template>
  <div class="my-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="user-card">
        <AvatarDisplay :avatar="user?.avatar" :size="70" class="user-avatar" />
        <div class="user-info">
          <div class="user-nickname">{{ user?.nickname }}</div>
          <div class="user-username">账号: {{ user?.username }}</div>
        </div>
        <van-button
          type="danger"
          size="small"
          plain
          class="logout-btn"
          @click="handleLogout"
        >
          退出登录
        </van-button>
      </div>
      <div class="profile-entry" @click="goToEditProfile">
        <van-icon name="edit" size="14" />
        <span>编辑资料</span>
      </div>
    </div>

    <div class="content">
      <div class="quick-entry" @click="goToMessages">
        <div class="entry-left">
          <span class="entry-icon">💬</span>
          <div class="entry-info">
            <div class="entry-title">我的消息</div>
            <div class="entry-desc">查看所有瓶子与对话</div>
          </div>
        </div>
        <div class="entry-right">
          <van-badge :content="totalUnread" v-if="totalUnread > 0">
            <van-icon name="arrow" size="16" color="#999" />
          </van-badge>
          <van-icon v-else name="arrow" size="16" color="#999" />
        </div>
      </div>

      <div class="function-list">
        <div class="function-item" @click="goToThrow">
          <span class="function-icon">🍾</span>
          <span class="function-text">扔瓶子</span>
          <van-icon name="arrow" size="14" color="#ccc" />
        </div>
        <div class="function-item" @click="goToPick">
          <span class="function-icon">🥅</span>
          <span class="function-text">捞瓶子</span>
          <van-icon name="arrow" size="14" color="#ccc" />
        </div>
        <div class="function-item" @click="goToWelfare">
          <span class="function-icon">🎁</span>
          <span class="function-text">每日福利</span>
          <van-icon name="arrow" size="14" color="#ccc" />
        </div>
      </div>
    </div>

    <van-tabbar v-model="activeBottom" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o" @click="goToHome">首页</van-tabbar-item>
      <van-tabbar-item name="messages" icon="chat-o" @click="goToMessages">消息</van-tabbar-item>
      <van-tabbar-item name="welfare" icon="gift-o" @click="goToWelfare">福利</van-tabbar-item>
      <van-tabbar-item name="my" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast } from 'vant';
import { getUser, clearAuth, setUser } from '../utils/storage';
import { logout, getUserInfo, getUnreadCount } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const route = useRoute();
const user = ref(null);
const activeBottom = ref('my');
const totalUnread = ref(0);
let timer = null;

onMounted(() => {
  user.value = getUser();
  if (user.value) {
    refreshUserInfo();
    fetchUnreadCount();
  }
  timer = setInterval(fetchUnreadCount, 10000);
});

watch(
  () => route.path,
  () => {
    if (route.path === '/my' && user.value) {
      refreshUserInfo();
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

async function refreshUserInfo() {
  try {
    const userInfo = await getUserInfo();
    user.value = userInfo;
    setUser(userInfo);
  } catch (error) {
    console.error('刷新用户信息失败:', error);
  }
}

async function handleLogout() {
  try {
    const result = await logout();
    clearAuth();
    showToast(result._message || '操作成功');
    setTimeout(() => {
      router.replace('/login');
    }, 300);
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  }
}

function goToHome() {
  router.push('/');
}

function goToWelfare() {
  router.push('/welfare');
}

function goToThrow() {
  router.push('/throw');
}

function goToPick() {
  router.push('/pick');
}

function goToEditProfile() {
  router.push('/edit-profile');
}

function goToMessages() {
  router.push('/messages');
}
</script>

<style scoped>
.my-page {
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
  height: 160px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 0 30px 30px;
}

.user-card {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  margin: 0 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.user-avatar {
  font-size: 48px;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-radius: 50%;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
}

.user-nickname {
  font-size: 20px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.user-username {
  font-size: 13px;
  color: #999;
}

.logout-btn {
  border-radius: 16px;
}

.profile-entry {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 12px 16px 0;
  padding: 10px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  color: #1989fa;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  transition: background 0.2s;
}

.profile-entry:active {
  background: #f0f7ff;
}

.content {
  margin-top: 16px;
  padding: 0 16px;
}

.quick-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: transform 0.2s;
}

.quick-entry:active {
  transform: scale(0.98);
}

.entry-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.entry-icon {
  font-size: 36px;
}

.entry-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.entry-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.entry-desc {
  font-size: 12px;
  color: #999;
}

.entry-right {
  display: flex;
  align-items: center;
}

.function-list {
  margin-top: 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.function-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.2s;
}

.function-item:last-child {
  border-bottom: none;
}

.function-item:active {
  background: #f9f9f9;
}

.function-icon {
  font-size: 22px;
  margin-right: 14px;
}

.function-text {
  flex: 1;
  font-size: 15px;
  color: #333;
}
</style>
