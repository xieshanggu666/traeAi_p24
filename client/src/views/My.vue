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
      <div class="section-title">🍾 我发起的瓶子</div>
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <div class="bottle-list">
          <van-swipe-cell
            v-for="bottle in sentBottles"
            :key="bottle.id"
          >
            <div
              class="bottle-item"
              :class="{ 'bottle-item-disabled': bottle.status !== 'replied' }"
              @click="goToChat(bottle)"
            >
              <div class="bottle-item-header">
                <AvatarDisplay :avatar="bottle.other_avatar" :size="44" />
                <div class="bottle-user-info">
                  <div class="bottle-nickname">{{ bottle.other_nickname }}</div>
                  <div class="bottle-type" :class="bottle.status">
                    <van-icon v-if="bottle.status === 'replied'" name="intersection-o" size="12" />
                    <van-icon v-else-if="bottle.status === 'picked'" name="eye-o" size="12" />
                    <van-icon v-else name="clock-o" size="12" />
                    {{ bottle.status === 'replied' ? '已回复' : (bottle.status === 'picked' ? '已被捡起' : '等待被捞取') }}
                  </div>
                </div>
                <div class="bottle-time">{{ formatTime(bottle.created_at) }}</div>
              </div>
              <div class="bottle-content">
                <span class="bottle-label">瓶子内容：</span>
                {{ bottle.content }}
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

          <div class="empty-state" v-if="sentBottles.length === 0 && !loading">
            <div class="empty-icon">🍾</div>
            <div class="empty-text">还没有扔过瓶子</div>
            <div class="empty-desc">快去扔一个瓶子吧</div>
            <van-button
              type="primary"
              size="small"
              style="margin-top: 20px;"
              @click="goToThrow"
            >
              去扔瓶子
            </van-button>
          </div>

          <van-loading v-if="loading" color="#1989fa" style="margin-top: 40px;">
            加载中...
          </van-loading>
        </div>
      </van-pull-refresh>
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast } from 'vant';
import { getUser, clearAuth, setUser } from '../utils/storage';
import { getMyBottles, logout, deleteBottle, getUserInfo } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const route = useRoute();
const user = ref(null);
const activeBottom = ref('my');
const bottles = ref([]);
const loading = ref(false);
const refreshing = ref(false);

const sentBottles = computed(() => {
  return bottles.value.filter(b => b.type === 'sent');
});

onMounted(() => {
  user.value = getUser();
  if (user.value) {
    fetchMyBottles();
    refreshUserInfo();
  }
});

watch(
  () => route.path,
  () => {
    if (route.path === '/my' && user.value) {
      fetchMyBottles();
      refreshUserInfo();
    }
  }
);

async function refreshUserInfo() {
  try {
    const userInfo = await getUserInfo();
    user.value = userInfo;
    setUser(userInfo);
  } catch (error) {
    console.error('刷新用户信息失败:', error);
  }
}

async function fetchMyBottles() {
  loading.value = true;
  try {
    const result = await getMyBottles();
    bottles.value = result;
  } catch (error) {
    console.error('获取我的瓶子失败:', error);
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  try {
    const result = await getMyBottles();
    bottles.value = result;
  } catch (error) {
    console.error('刷新失败:', error);
  } finally {
    refreshing.value = false;
  }
}

async function handleDelete(bottle) {
  try {
    const result = await deleteBottle(bottle.id);
    showToast(result._message || '操作成功');
    bottles.value = bottles.value.filter(b => b.id !== bottle.id);
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
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

function formatTime(time) {
  if (!time) return '';
  const date = new Date(time);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

function goToChat(bottle) {
  if (bottle.status !== 'replied') {
    showToast(bottle.status === 'picked' ? '瓶子已被捡起，等待对方回复' : '瓶子还在海里，等待被捞取');
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

function goToThrow() {
  router.push('/throw');
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
  margin-top: 20px;
  min-height: calc(100vh - 280px);
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  padding: 0 16px;
  margin-bottom: 12px;
}

.bottle-list {
  padding: 0 16px;
}

.bottle-item {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
}

.bottle-item:active {
  transform: scale(0.98);
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.05);
}

.bottle-item-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.bottle-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bottle-nickname {
  font-size: 15px;
  font-weight: bold;
  color: #333;
}

.bottle-type {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
}

.bottle-type.replied {
  color: #1989fa;
}

.bottle-type.picked {
  color: #ff976a;
}

.bottle-type.floating {
  color: #999;
}

.bottle-item-disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.bottle-item-disabled:active {
  transform: none;
}

.bottle-time {
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
}

.bottle-content {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.bottle-label {
  color: #999;
  font-size: 13px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
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
