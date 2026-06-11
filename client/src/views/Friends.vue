<template>
  <div class="friends-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="header-content">
        <van-icon name="arrow-left" size="22" color="#fff" @click="goBack" class="back-icon" />
        <h2 class="page-title">👥 好友</h2>
        <van-icon name="search" size="22" color="#fff" @click="showSearch = true" class="search-icon" />
      </div>
    </div>

    <van-tabs v-model:active="activeTab" sticky offset-top="84" lazy-render>
      <van-tab :title="`好友 (${friends.length})`">
        <div class="section" v-if="friends.length > 0 || loadingFriends">
          <div class="section-list">
            <van-swipe-cell v-for="friend in friends" :key="friend.id">
              <div class="friend-card" @click="showUserProfile(friend.id)">
                <div class="friend-avatar">
                  <AvatarDisplay :avatar="friend.avatar" :size="46" />
                </div>
                <div class="friend-body">
                  <div class="friend-top-row">
                    <span class="friend-name">{{ friend.nickname }}</span>
                    <span class="friend-time">添加于 {{ formatDate(friend.added_at) }}</span>
                  </div>
                  <div class="friend-bottom-row">
                    <span class="friend-bio" v-if="friend.bio">{{ friend.bio }}</span>
                    <span class="friend-no-bio" v-else>这个人很懒，什么都没写</span>
                  </div>
                </div>
              </div>
              <template #right>
                <van-button square type="danger" class="swipe-delete" text="删除" @click="handleDeleteFriend(friend)" />
              </template>
            </van-swipe-cell>
          </div>
        </div>
        <div class="empty-state" v-if="friends.length === 0 && !loadingFriends">
          <div class="empty-icon">👥</div>
          <div class="empty-text">还没有好友</div>
          <div class="empty-desc">搜索用户ID添加好友吧</div>
          <van-button type="primary" size="small" style="margin-top: 12px;" @click="showSearch = true">
            搜索添加
          </van-button>
        </div>
        <van-loading v-if="loadingFriends" color="#1989fa" style="margin-top: 40px; display: block; text-align: center;">加载中...</van-loading>
      </van-tab>

      <van-tab :title="pendingRequestsCount > 0 ? `申请 (${pendingRequestsCount})` : '申请'">
        <div class="requests-section">
          <div class="requests-title" v-if="receivedRequests.length > 0">
            <span>收到的申请</span>
          </div>
          <div class="section-list" v-if="receivedRequests.length > 0">
            <div class="request-card" v-for="req in receivedRequests" :key="req.id">
              <div class="friend-avatar">
                <AvatarDisplay :avatar="req.avatar" :size="46" />
              </div>
              <div class="friend-body">
                <div class="friend-top-row">
                  <span class="friend-name">{{ req.nickname }}</span>
                  <span class="request-status" :class="'status-' + req.status">
                    {{ getRequestStatusText(req.status) }}
                  </span>
                </div>
                <div class="friend-bottom-row">
                  <span class="request-message" v-if="req.message">{{ req.message }}</span>
                  <span class="request-no-message" v-else>想添加你为好友</span>
                </div>
              </div>
              <div class="request-actions" v-if="req.status === 'pending'">
                <van-button size="small" type="primary" @click="handleAccept(req)">接受</van-button>
                <van-button size="small" plain @click="handleReject(req)">拒绝</van-button>
              </div>
            </div>
          </div>
          <div class="empty-sub-state" v-if="receivedRequests.length === 0">
            <div class="empty-sub-text">暂无收到的申请</div>
          </div>

          <div class="requests-title" v-if="sentRequests.length > 0">
            <span>发出的申请</span>
          </div>
          <div class="section-list" v-if="sentRequests.length > 0">
            <div class="request-card" v-for="req in sentRequests" :key="req.id">
              <div class="friend-avatar">
                <AvatarDisplay :avatar="req.avatar" :size="46" />
              </div>
              <div class="friend-body">
                <div class="friend-top-row">
                  <span class="friend-name">{{ req.nickname }}</span>
                  <span class="request-status" :class="'status-' + req.status">
                    {{ getRequestStatusText(req.status) }}
                  </span>
                </div>
                <div class="friend-bottom-row">
                  <span class="request-message" v-if="req.message">{{ req.message }}</span>
                  <span class="request-no-message" v-else>申请添加好友</span>
                </div>
              </div>
            </div>
          </div>
          <div class="empty-sub-state" v-if="sentRequests.length === 0 && receivedRequests.length === 0">
            <div class="empty-sub-text">暂无发出的申请</div>
          </div>
        </div>
      </van-tab>
    </van-tabs>

    <van-popup v-model:show="showSearch" round position="bottom" :style="{ maxHeight: '85vh' }">
      <div class="search-panel">
        <div class="popup-header">
          <div class="popup-title">🔍 搜索用户</div>
          <van-icon name="cross" size="20" @click="closeSearch" />
        </div>
        <div class="search-tip">输入用户ID、用户名或昵称进行搜索</div>
        <div class="search-input-row">
          <van-field
            v-model="searchKeyword"
            placeholder="输入搜索关键词"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #button>
              <van-button size="small" type="primary" :loading="searching" @click="handleSearch">搜索</van-button>
            </template>
          </van-field>
        </div>
        <div class="search-results" v-if="searchResults.length > 0">
          <div class="search-result-item" v-for="user in searchResults" :key="user.id">
            <div class="friend-avatar" @click="showUserProfile(user.id)">
              <AvatarDisplay :avatar="user.avatar" :size="44" />
            </div>
            <div class="friend-body" @click="showUserProfile(user.id)">
              <div class="friend-top-row">
                <span class="friend-name">{{ user.nickname }}</span>
                <span class="user-username">@{{ user.username }}</span>
              </div>
              <div class="friend-bottom-row">
                <span class="friend-bio" v-if="user.bio">{{ user.bio }}</span>
                <span class="friend-no-bio" v-else>这个人很懒，什么都没写</span>
              </div>
            </div>
            <van-button
              size="small"
              type="primary"
              :disabled="user.isFriend || user.hasPendingRequest"
              @click="handleSendRequest(user)"
            >
              {{ user.isFriend ? '已是好友' : user.hasPendingRequest ? '已申请' : '添加好友' }}
            </van-button>
          </div>
        </div>
        <div class="empty-search" v-else-if="hasSearched && searchResults.length === 0">
          <div class="empty-icon">🔍</div>
          <div class="empty-text">没有找到相关用户</div>
        </div>
        <div class="search-hint" v-else>
          <div class="hint-icon">💡</div>
          <div class="hint-text">输入关键词开始搜索</div>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="showProfilePopup" round position="bottom" :style="{ maxHeight: '80vh' }">
      <div class="profile-panel" v-if="profileUser">
        <div class="popup-header">
          <div class="popup-title">👤 用户信息</div>
          <van-icon name="cross" size="20" @click="showProfilePopup = false" />
        </div>
        <div class="profile-header">
          <AvatarDisplay :avatar="profileUser.avatar" :size="72" class="profile-avatar" />
          <div class="profile-info">
            <div class="profile-nickname-row">
              <span class="profile-nickname">{{ profileUser.nickname }}</span>
              <span class="gender-icon" v-if="profileUser.gender === '男'">♂</span>
              <span class="gender-icon gender-female" v-else-if="profileUser.gender === '女'">♀</span>
            </div>
            <div class="profile-username">@{{ profileUser.username }}</div>
            <div class="profile-user-id">ID: {{ profileUser.id }}</div>
          </div>
        </div>
        <div class="profile-section">
          <div class="profile-section-title">个人介绍</div>
          <div class="profile-bio" v-if="profileUser.bio">{{ profileUser.bio }}</div>
          <div class="profile-no-bio" v-else>这个人很懒，什么都没写</div>
        </div>
        <div class="profile-section">
          <div class="profile-section-title">注册时间</div>
          <div class="profile-value">{{ formatDate(profileUser.created_at) }}</div>
        </div>
        <div class="profile-footer" v-if="!isSelf(profileUser.id)">
          <van-button
            type="primary"
            block
            round
            :disabled="profileUser.isFriend || profileUser.hasPendingRequest"
            :loading="addingFriend"
            @click="handleSendRequestFromProfile"
          >
            {{ profileUser.isFriend ? '已是好友' : profileUser.hasPendingRequest ? '已发送申请' : '添加好友' }}
          </van-button>
        </div>
        <div class="profile-footer" v-else>
          <div class="self-hint">这是你自己</div>
        </div>
      </div>
    </van-popup>

    <van-dialog
      v-model:show="showRequestDialog"
      title="添加好友"
      show-cancel-button
      confirm-button-text="发送"
      cancel-button-text="取消"
      @confirm="confirmSendRequest"
    >
      <div style="padding: 12px 0;">
        <div class="dialog-tip">给 <strong>{{ requestTarget?.nickname }}</strong> 发送好友申请</div>
        <van-field
          v-model="requestMessage"
          type="textarea"
          rows="3"
          placeholder="可以写点什么（选填）"
          maxlength="200"
          show-word-limit
          autosize
        />
      </div>
    </van-dialog>

    <van-tabbar v-model="activeBottom" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o" @click="goToHome">首页</van-tabbar-item>
      <van-tabbar-item name="messages" icon="chat-o" @click="goToMessages">消息</van-tabbar-item>
      <van-tabbar-item name="friends" icon="friends-o">好友</van-tabbar-item>
      <van-tabbar-item name="shop" icon="shop-o" @click="goToShop">商城</van-tabbar-item>
      <van-tabbar-item name="my" icon="user-o" @click="goToMy">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { getUser } from '../utils/storage';
import {
  searchFriendUsers,
  getUserProfile,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  getFriendRequests,
  deleteFriend
} from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const user = ref(null);
const activeBottom = ref('friends');
const activeTab = ref(0);

const friends = ref([]);
const loadingFriends = ref(false);
const receivedRequests = ref([]);
const sentRequests = ref([]);

const showSearch = ref(false);
const searchKeyword = ref('');
const searching = ref(false);
const searchResults = ref([]);
const hasSearched = ref(false);

const showProfilePopup = ref(false);
const profileUser = ref(null);
const loadingProfile = ref(false);

const showRequestDialog = ref(false);
const requestTarget = ref(null);
const requestMessage = ref('');
const addingFriend = ref(false);

const pendingRequestsCount = computed(() => {
  return receivedRequests.value.filter(r => r.status === 'pending').length;
});

onMounted(() => {
  user.value = getUser();
  if (user.value) {
    loadFriends();
    loadRequests();
  }
});

async function loadFriends() {
  loadingFriends.value = true;
  try {
    friends.value = await getFriends();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '加载好友列表失败');
  } finally {
    loadingFriends.value = false;
  }
}

async function loadRequests() {
  try {
    const result = await getFriendRequests();
    receivedRequests.value = result.received || [];
    sentRequests.value = result.sent || [];
  } catch (error) {
    console.error('加载好友申请失败:', error);
  }
}

async function handleSearch() {
  if (!searchKeyword.value.trim()) {
    showToast('请输入搜索关键词');
    return;
  }
  searching.value = true;
  hasSearched.value = true;
  try {
    searchResults.value = await searchFriendUsers(searchKeyword.value.trim());
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '搜索失败');
  } finally {
    searching.value = false;
  }
}

function closeSearch() {
  showSearch.value = false;
  searchKeyword.value = '';
  searchResults.value = [];
  hasSearched.value = false;
}

async function showUserProfile(userId) {
  showProfilePopup.value = true;
  profileUser.value = null;
  loadingProfile.value = true;
  try {
    profileUser.value = await getUserProfile(userId);
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '获取用户信息失败');
    showProfilePopup.value = false;
  } finally {
    loadingProfile.value = false;
  }
}

function handleSendRequest(userData) {
  if (userData.isFriend) {
    showToast('对方已经是你的好友了');
    return;
  }
  if (userData.hasPendingRequest) {
    showToast('已发送过好友申请');
    return;
  }
  requestTarget.value = userData;
  requestMessage.value = '';
  showRequestDialog.value = true;
}

function handleSendRequestFromProfile() {
  if (!profileUser.value) return;
  if (profileUser.value.isFriend) {
    showToast('对方已经是你的好友了');
    return;
  }
  if (profileUser.value.hasPendingRequest) {
    showToast('已发送过好友申请');
    return;
  }
  requestTarget.value = profileUser.value;
  requestMessage.value = '';
  showRequestDialog.value = true;
}

async function confirmSendRequest() {
  if (!requestTarget.value) return;
  addingFriend.value = true;
  try {
    await sendFriendRequest(requestTarget.value.id, requestMessage.value.trim() || undefined);
    showToast('好友申请已发送');
    showRequestDialog.value = false;
    if (profileUser.value && profileUser.value.id === requestTarget.value.id) {
      profileUser.value.hasPendingRequest = true;
    }
    const idx = searchResults.value.findIndex(u => u.id === requestTarget.value.id);
    if (idx !== -1) {
      searchResults.value[idx].hasPendingRequest = true;
    }
    loadRequests();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '发送失败');
  } finally {
    addingFriend.value = false;
  }
}

async function handleAccept(req) {
  try {
    await acceptFriendRequest(req.id);
    showToast('已接受好友申请');
    loadFriends();
    loadRequests();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '操作失败');
  }
}

async function handleReject(req) {
  try {
    await showDialog({
      title: '确认拒绝',
      message: `确定要拒绝「${req.nickname}」的好友申请吗？`,
      showCancelButton: true,
      confirmButtonText: '拒绝',
      cancelButtonText: '取消',
      confirmButtonColor: '#ff4d4f'
    });
    await rejectFriendRequest(req.id);
    showToast('已拒绝好友申请');
    loadRequests();
  } catch (e) {
    if (e !== 'cancel') {
      showToast(e.businessMessage || e.httpMessage || '操作失败');
    }
  }
}

async function handleDeleteFriend(friend) {
  try {
    await showDialog({
      title: '确认删除',
      message: `确定要删除好友「${friend.nickname}」吗？删除后将无法恢复。`,
      showCancelButton: true,
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonColor: '#ff4d4f'
    });
    await deleteFriend(friend.id);
    showToast('已删除好友');
    loadFriends();
  } catch (e) {
    if (e !== 'cancel') {
      showToast(e.businessMessage || e.httpMessage || '删除失败');
    }
  }
}

function isSelf(userId) {
  return user.value?.id === userId;
}

function getRequestStatusText(status) {
  switch (status) {
    case 'pending': return '待处理';
    case 'accepted': return '已接受';
    case 'rejected': return '已拒绝';
    default: return status;
  }
}

function formatDate(time) {
  if (!time) return '';
  const date = new Date(time);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function goBack() { router.back(); }
function goToHome() { router.push('/'); }
function goToMessages() { router.push('/messages'); }
function goToShop() { router.push('/shop'); }
function goToMy() { router.push('/my'); }
</script>

<style scoped>
.friends-page {
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

.back-icon, .search-icon {
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-title {
  font-size: 20px;
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

.friend-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s;
}

.friend-card:active {
  transform: scale(0.98);
}

.friend-avatar {
  flex-shrink: 0;
}

.friend-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.friend-top-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.friend-name {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
}

.user-username {
  font-size: 12px;
  color: #999;
}

.friend-time {
  font-size: 11px;
  color: #bbb;
  margin-left: auto;
  flex-shrink: 0;
}

.friend-bottom-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.friend-bio {
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.friend-no-bio {
  font-size: 12px;
  color: #bbb;
}

.swipe-delete {
  height: 100% !important;
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

.requests-section {
  padding: 8px 16px 16px;
}

.requests-title {
  font-size: 13px;
  color: #999;
  padding: 12px 4px 8px;
  font-weight: 500;
}

.request-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.request-status {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 8px;
  flex-shrink: 0;
}

.status-pending {
  background: #ff976a20;
  color: #ff976a;
}

.status-accepted {
  background: #07c16020;
  color: #07c160;
}

.status-rejected {
  background: #99999920;
  color: #999;
}

.request-message {
  font-size: 13px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.request-no-message {
  font-size: 12px;
  color: #bbb;
}

.request-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.empty-sub-state {
  text-align: center;
  padding: 20px;
  color: #bbb;
  font-size: 13px;
}

.search-panel, .profile-panel {
  padding: 20px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.popup-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.search-tip {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  color: #667eea;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 16px;
  text-align: center;
}

.search-input-row {
  margin-bottom: 16px;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 40vh;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f9f9f9;
  border-radius: 12px;
  padding: 12px 14px;
}

.empty-search {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #999;
}

.search-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #999;
}

.hint-icon {
  font-size: 40px;
  margin-bottom: 10px;
  opacity: 0.5;
}

.hint-text {
  font-size: 13px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0 20px;
  border-bottom: 1px solid #f0f0f0;
}

.profile-avatar {
  font-size: 48px;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-radius: 50%;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-nickname-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.profile-nickname {
  font-size: 18px;
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

.profile-username {
  font-size: 13px;
  color: #999;
  margin-bottom: 2px;
}

.profile-user-id {
  font-size: 11px;
  color: #bbb;
  word-break: break-all;
}

.profile-section {
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
}

.profile-section:last-of-type {
  border-bottom: none;
}

.profile-section-title {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.profile-bio {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.profile-no-bio {
  font-size: 13px;
  color: #bbb;
}

.profile-value {
  font-size: 14px;
  color: #333;
}

.profile-footer {
  padding-top: 20px;
}

.self-hint {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 10px;
}

.dialog-tip {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
  text-align: center;
}
</style>
