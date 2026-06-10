<template>
  <div class="my-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="user-card">
        <AvatarDisplay :avatar="user?.avatar" :size="70" class="user-avatar" />
        <div class="user-info">
          <div class="user-nickname-row">
            <span class="user-nickname">{{ user?.nickname }}</span>
            <span class="gender-icon" v-if="user?.gender === '男'">♂</span>
            <span class="gender-icon gender-female" v-else-if="user?.gender === '女'">♀</span>
            <span class="gender-icon gender-secret" v-else-if="user?.gender === '保密'">🔒</span>
            <span class="user-age" v-if="computedAge">{{ computedAge }}</span>
          </div>
          <div class="user-bio" v-if="user?.bio">{{ user.bio }}</div>
          <div class="user-no-bio" v-else>还没有个人介绍</div>
        </div>
      </div>
    </div>

    <div class="content">
      <div class="action-list">
        <div class="action-item" @click="goToEditProfile">
          <van-icon name="edit" size="20" color="#667eea" />
          <span class="action-text">编辑资料</span>
          <van-icon name="arrow" size="14" color="#ccc" />
        </div>
        <div class="action-item" @click="goToWelfare">
          <van-icon name="gift-o" size="20" color="#ff976a" />
          <span class="action-text">每日福利</span>
          <van-icon name="arrow" size="14" color="#ccc" />
        </div>
        <div class="action-item" @click="goToBackpack">
          <van-icon name="bag-o" size="20" color="#07c160" />
          <span class="action-text">我的背包</span>
          <van-icon name="arrow" size="14" color="#ccc" />
        </div>
        <div class="action-item" @click="goToGifts">
          <van-icon name="gift-o" size="20" color="#ff6b9d" />
          <span class="action-text">我的礼物</span>
          <van-icon name="arrow" size="14" color="#ccc" />
        </div>
      </div>

      <van-button
        type="danger"
        plain
        block
        class="logout-btn"
        @click="handleLogout"
      >
        退出登录
      </van-button>
    </div>

    <van-tabbar v-model="activeBottom" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o" @click="goToHome">首页</van-tabbar-item>
      <van-tabbar-item name="messages" icon="chat-o" @click="goToMessages">消息</van-tabbar-item>
      <van-tabbar-item name="welfare" icon="gift-o" @click="goToWelfare">福利</van-tabbar-item>
      <van-tabbar-item name="shop" icon="shop-o" @click="goToShop">商城</van-tabbar-item>
      <van-tabbar-item name="my" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast } from 'vant';
import { getUser, clearAuth, setUser } from '../utils/storage';
import { logout, getUserInfo } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const route = useRoute();
const user = ref(null);
const activeBottom = ref('my');

const computedAge = computed(() => {
  if (!user.value?.birthday) return '';
  const birthday = new Date(user.value.birthday);
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age--;
  }
  return age >= 0 ? `${age}岁` : '';
});

onMounted(() => {
  user.value = getUser();
  if (user.value) {
    refreshUserInfo();
  }
});

watch(
  () => route.path,
  () => {
    if (route.path === '/my' && user.value) {
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

function goToHome() { router.push('/'); }
function goToWelfare() { router.push('/welfare'); }
function goToEditProfile() { router.push('/edit-profile'); }
function goToMessages() { router.push('/messages'); }
function goToShop() { router.push('/shop'); }
function goToBackpack() { router.push('/backpack'); }
function goToGifts() { router.push('/gifts'); }
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
  padding: 24px 20px;
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

.user-nickname-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.user-nickname {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.gender-icon {
  font-size: 16px;
  color: #4a9eff;
  font-weight: bold;
}

.gender-female {
  color: #ff6b9d;
}

.gender-secret {
  font-size: 13px;
  color: #999;
}

.user-age {
  font-size: 12px;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1px 8px;
  border-radius: 10px;
}

.user-bio {
  font-size: 13px;
  color: #666;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.user-no-bio {
  font-size: 13px;
  color: #bbb;
}

.content {
  margin-top: 20px;
  padding: 0 16px;
}

.action-list {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.action-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.2s;
}

.action-item:last-child {
  border-bottom: none;
}

.action-item:active {
  background: #f9f9f9;
}

.action-text {
  flex: 1;
  font-size: 15px;
  color: #333;
  margin-left: 14px;
}

.logout-btn {
  margin-top: 24px;
  border-radius: 12px;
}
</style>
