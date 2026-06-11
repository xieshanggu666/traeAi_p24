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
          <div class="user-coins">
            <span class="coin-icon">🪙</span>
            <span class="coin-num">{{ user?.coins || 0 }}</span>
            <span class="coin-text">漂流币</span>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <van-tabs v-model:active="activeTab" class="custom-tabs" line-width="30px" color="#667eea">
        <van-tab title="功能菜单">
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
            <div class="action-item" @click="goToFriends">
              <van-icon name="friends-o" size="20" color="#1989fa" />
              <span class="action-text">我的好友</span>
              <van-icon name="arrow" size="14" color="#ccc" />
            </div>
          </div>
        </van-tab>

        <van-tab :title="`我的瓶子 (${bottles.length})`">
          <div class="bottle-list" v-if="bottles.length > 0">
            <div
              v-for="bottle in bottles"
              :key="bottle.id"
              class="bottle-card"
              :class="{ 'bottle-pinned': bottle.is_pinned }"
            >
              <div class="bottle-header">
                <div class="bottle-tag" :class="getTagClass(bottle.tag)">
                  {{ getTagName(bottle.tag) }}
                </div>
                <div class="bottle-badges">
                  <van-tag v-if="bottle.is_pinned" type="warning" size="medium" plain>
                    ⭐ 置顶
                  </van-tag>
                  <van-tag v-if="bottle.pick_count >= 5" type="primary" size="medium" plain>
                    已捞满
                  </van-tag>
                </div>
              </div>

              <div class="bottle-content">{{ bottle.content }}</div>

              <div class="bottle-meta">
                <div class="meta-item">
                  <van-icon name="eye-o" size="12" />
                  <span>被捞 {{ bottle.pick_count || 0 }}/{{ bottle.maxPickCount || 5 }} 次</span>
                </div>
                <div class="meta-item">
                  <van-icon name="clock-o" size="12" />
                  <span>{{ formatTime(bottle.created_at) }}</span>
                </div>
              </div>

              <div class="bottle-actions">
                <van-button
                  size="small"
                  type="danger"
                  plain
                  :disabled="!bottle.canRecall"
                  @click="handleRecall(bottle)"
                >
                  <span v-if="bottle.canRecall">↩️ 撤回 (10币)</span>
                  <span v-else>{{ bottle.canRecallReason }}</span>
                </van-button>

                <van-button
                  size="small"
                  type="warning"
                  plain
                  :disabled="!bottle.canPin"
                  @click="handlePin(bottle)"
                >
                  <span v-if="!bottle.is_pinned">⭐ 置顶 (50币)</span>
                  <span v-else>已置顶</span>
                </van-button>

                <van-button
                  size="small"
                  type="default"
                  plain
                  @click="goToChat(bottle.id)"
                >
                  💬 查看
                </van-button>
              </div>
            </div>
          </div>

          <div class="empty-state" v-else-if="!bottlesLoading">
            <div class="empty-icon">🍾</div>
            <div class="empty-text">还没有扔过瓶子</div>
            <div class="empty-desc">去扔一个瓶子吧</div>
            <van-button type="primary" size="small" style="margin-top: 16px;" @click="goToThrow">
              去扔瓶子
            </van-button>
          </div>

          <van-loading v-if="bottlesLoading" color="#1989fa" style="margin-top: 40px; display: block; text-align: center;">加载中...</van-loading>
        </van-tab>
      </van-tabs>

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
      <van-tabbar-item name="my" icon="user-o" @click="goToMy">我的</van-tabbar-item>
    </van-tabbar>

    <van-popup
      v-model:show="showConfirmDialog"
      round
      position="bottom"
      :style="{ maxWidth: '90%', margin: '0 auto' }"
    >
      <div class="confirm-dialog">
        <div class="dialog-title">{{ confirmTitle }}</div>
        <div class="dialog-message">{{ confirmMessage }}</div>
        <div class="dialog-actions">
          <van-button type="default" @click="showConfirmDialog = false">取消</van-button>
          <van-button type="primary" @click="confirmAction">确认</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { getUser, clearAuth, setUser } from '../utils/storage';
import {
  logout,
  getUserInfo,
  getMyBottles,
  recallBottle,
  pinBottle
} from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const route = useRoute();
const user = ref(null);
const activeBottom = ref('my');
const activeTab = ref(0);
const bottles = ref([]);
const bottlesLoading = ref(false);
const showConfirmDialog = ref(false);
const confirmTitle = ref('');
const confirmMessage = ref('');
let confirmCallback = null;
let currentBottle = null;

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
    fetchMyBottles();
  }
});

watch(
  () => route.path,
  () => {
    if (route.path === '/my' && user.value) {
      refreshUserInfo();
      fetchMyBottles();
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
  bottlesLoading.value = true;
  try {
    const result = await getMyBottles();
    bottles.value = result || [];
  } catch (error) {
    console.error('获取我的瓶子失败:', error);
  } finally {
    bottlesLoading.value = false;
  }
}

function getTagClass(tag) {
  const classes = {
    'emotion': 'tag-emotion',
    'secret': 'tag-secret',
    'hobby': 'tag-hobby',
    'makefriend': 'tag-makefriend',
    'daily': 'tag-daily',
    'other': 'tag-other'
  };
  return classes[tag] || 'tag-other';
}

function getTagName(tag) {
  const names = {
    'emotion': '💭 情感',
    'secret': '🤫 秘密',
    'hobby': '🎮 爱好',
    'makefriend': '👋 交友',
    'daily': '📝 日常',
    'other': '📦 其他'
  };
  return names[tag] || '📦 其他';
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

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function handleRecall(bottle) {
  if (!bottle.canRecall) {
    showToast(bottle.canRecallReason);
    return;
  }

  currentBottle = bottle;
  confirmTitle.value = '确认撤回';
  confirmMessage.value = `确定要撤回这个瓶子吗？\n将消耗 10 漂流币，同时返还 1 次扔瓶子次数。`;
  confirmCallback = doRecall;
  showConfirmDialog.value = true;
}

async function doRecall() {
  if (!currentBottle) return;

  try {
    const result = await recallBottle(currentBottle.id);
    showToast(result._message || '撤回成功');
    await refreshUserInfo();
    await fetchMyBottles();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '撤回失败');
  } finally {
    showConfirmDialog.value = false;
    currentBottle = null;
  }
}

async function handlePin(bottle) {
  if (bottle.is_pinned) {
    showToast('该瓶子已经是置顶状态');
    return;
  }

  if (!bottle.canPin) {
    showToast('该瓶子无法置顶');
    return;
  }

  currentBottle = bottle;
  confirmTitle.value = '确认置顶';
  confirmMessage.value = `确定要置顶这个瓶子吗？\n将消耗 50 漂流币，置顶后瓶子被捞取概率提升至 100%。`;
  confirmCallback = doPin;
  showConfirmDialog.value = true;
}

async function doPin() {
  if (!currentBottle) return;

  try {
    const result = await pinBottle(currentBottle.id);
    showToast(result._message || '置顶成功');
    await refreshUserInfo();
    await fetchMyBottles();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '置顶失败');
  } finally {
    showConfirmDialog.value = false;
    currentBottle = null;
  }
}

function confirmAction() {
  if (confirmCallback) {
    confirmCallback();
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
function goToFriends() { router.push('/friends'); }
function goToMy() { router.push('/my'); }
function goToThrow() { router.push('/throw'); }
function goToChat(bottleId) { router.push(`/chat/${bottleId}`); }
</script>

<style scoped>
.my-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 100px;
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
  margin-bottom: 6px;
}

.user-no-bio {
  font-size: 13px;
  color: #bbb;
  margin-bottom: 6px;
}

.user-coins {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #666;
}

.coin-icon {
  font-size: 14px;
}

.coin-num {
  font-weight: bold;
  color: #ff9800;
  font-size: 15px;
}

.coin-text {
  color: #999;
}

.content {
  margin-top: 20px;
  padding: 0 16px;
}

.custom-tabs {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.action-list {
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

.bottle-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
}

.bottle-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 2px solid transparent;
  transition: all 0.2s;
}

.bottle-card.bottle-pinned {
  border-color: #ff9800;
  background: linear-gradient(135deg, #fff9e6 0%, #fff 100%);
}

.bottle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.bottle-tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 10px;
  font-weight: 500;
}

.tag-emotion {
  background: #ffebee;
  color: #e91e63;
}

.tag-secret {
  background: #f3e5f5;
  color: #9c27b0;
}

.tag-hobby {
  background: #e8f5e9;
  color: #4caf50;
}

.tag-makefriend {
  background: #e3f2fd;
  color: #2196f3;
}

.tag-daily {
  background: #fff3e0;
  color: #ff9800;
}

.tag-other {
  background: #f5f5f5;
  color: #666;
}

.bottle-badges {
  display: flex;
  gap: 6px;
}

.bottle-content {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bottle-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #999;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bottle-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.bottle-actions .van-button {
  flex: 1;
  min-width: 80px;
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

.logout-btn {
  margin-top: 24px;
  border-radius: 12px;
}

.confirm-dialog {
  padding: 24px 20px;
  text-align: center;
}

.dialog-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin-bottom: 12px;
}

.dialog-message {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  white-space: pre-line;
  margin-bottom: 24px;
}

.dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.dialog-actions .van-button {
  flex: 1;
  max-width: 120px;
}
</style>
