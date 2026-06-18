<template>
  <div class="rank-page">
    <div class="header-bg"></div>
    <div class="content-wrapper">
      <div class="page-header">
        <van-icon name="arrow-left" size="22" color="#fff" @click="goBack" />
        <div class="page-title">🏆 排行榜</div>
        <div style="width: 22px"></div>
      </div>

      <van-tabs v-model:active="activeTab" color="#fff" title-active-color="#fff" title-inactive-color="rgba(255,255,255,0.6)" line-width="40px" line-height="3px" background="transparent" class="rank-tabs">
        <van-tab title="财富榜" name="wealth">
          <div class="my-rank-card">
            <div class="my-rank-info">
              <AvatarDisplay :avatar="user?.avatar" :size="46" :avatarFrame="userAvatarFrame" class="my-avatar" />
              <div class="my-rank-detail">
                <div class="my-nickname">{{ user?.nickname || wealthRank.myInfo?.nickname }}</div>
                <div class="my-rank-label">我的排名</div>
              </div>
            </div>
            <div class="my-rank-value">
              <div class="my-rank-num" :class="{ 'no-rank': wealthRank.myRank == null }">{{ wealthRank.myRank ?? '未上榜' }}</div>
              <div class="my-coins">🪙 {{ user?.coins ?? wealthRank.myInfo?.coins ?? 0 }}</div>
            </div>
          </div>

          <div class="rank-list">
            <div v-for="(user, index) in wealthRank.list" :key="user.id" class="rank-item">
              <div class="rank-num" :class="getRankClass(index)">
                <span v-if="index < 3" class="rank-medal">{{ getMedal(index) }}</span>
                <span v-else>{{ index + 1 }}</span>
              </div>
              <AvatarDisplay :avatar="user.avatar" :size="44" class="rank-avatar" />
              <div class="rank-info">
                <div class="rank-nickname">{{ user.nickname }}</div>
                <div class="rank-value">🪙 {{ user.coins }}</div>
              </div>
            </div>
            <div class="empty-tip" v-if="wealthRank.list.length === 0">
              暂无数据
            </div>
          </div>
        </van-tab>

        <van-tab title="魅力榜" name="charm">
          <div class="my-rank-card">
            <div class="my-rank-info">
              <AvatarDisplay :avatar="user?.avatar" :size="46" :avatarFrame="userAvatarFrame" class="my-avatar" />
              <div class="my-rank-detail">
                <div class="my-nickname">{{ user?.nickname || charmRank.myInfo?.nickname }}</div>
                <div class="my-rank-label">我的排名</div>
              </div>
            </div>
            <div class="my-rank-value">
              <div class="my-rank-num" :class="{ 'no-rank': charmRank.myRank == null }">{{ charmRank.myRank ?? '未上榜' }}</div>
              <div class="my-charm">✨ {{ user?.charm ?? charmRank.myInfo?.charm ?? 0 }}</div>
            </div>
          </div>

          <div class="rank-list">
            <div v-for="(user, index) in charmRank.list" :key="user.id" class="rank-item">
              <div class="rank-num" :class="getRankClass(index)">
                <span v-if="index < 3" class="rank-medal">{{ getMedal(index) }}</span>
                <span v-else>{{ index + 1 }}</span>
              </div>
              <AvatarDisplay :avatar="user.avatar" :size="44" class="rank-avatar" />
              <div class="rank-info">
                <div class="rank-nickname">{{ user.nickname }}</div>
                <div class="rank-value charm">✨ {{ user.charm }}</div>
              </div>
            </div>
            <div class="empty-tip" v-if="charmRank.list.length === 0">
              暂无数据
            </div>
          </div>
        </van-tab>
      </van-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getWealthRank, getCharmRank, getUserInfo, getMyAvatarFrames } from '../api';
import { getUser, setUser } from '../utils/storage';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const activeTab = ref('wealth');
const loading = ref(false);
const user = ref(null);
const userAvatarFrame = ref(null);

const wealthRank = ref({
  list: [],
  myRank: 0,
  myInfo: null
});

const charmRank = ref({
  list: [],
  myRank: 0,
  myInfo: null
});

onMounted(() => {
  user.value = getUser();
  fetchUserInfo();
  fetchWealthRank();
});

async function fetchUserInfo() {
  try {
    const userInfo = await getUserInfo();
    user.value = userInfo;
    setUser(userInfo);
    fetchAvatarFrame();
  } catch (error) {
    console.error('刷新用户信息失败:', error);
  }
}

async function fetchAvatarFrame() {
  try {
    const result = await getMyAvatarFrames();
    userAvatarFrame.value = result.activeFrame || null;
  } catch (error) {
    console.error('获取头像框失败:', error);
  }
}

watch(activeTab, (val) => {
  if (val === 'wealth' && wealthRank.value.list.length === 0) {
    fetchWealthRank();
  } else if (val === 'charm' && charmRank.value.list.length === 0) {
    fetchCharmRank();
  }
});

async function fetchWealthRank() {
  if (loading.value) return;
  loading.value = true;
  try {
    const result = await getWealthRank();
    wealthRank.value = result;
    if (result.myInfo && user.value) {
      user.value.coins = result.myInfo.coins;
    }
  } catch (error) {
    console.error('获取财富排行榜失败:', error);
  } finally {
    loading.value = false;
  }
}

async function fetchCharmRank() {
  if (loading.value) return;
  loading.value = true;
  try {
    const result = await getCharmRank();
    charmRank.value = result;
    if (result.myInfo && user.value) {
      user.value.charm = result.myInfo.charm;
    }
  } catch (error) {
    console.error('获取魅力排行榜失败:', error);
  } finally {
    loading.value = false;
  }
}

function getMedal(index) {
  const medals = ['🥇', '🥈', '🥉'];
  return medals[index] || '';
}

function getRankClass(index) {
  if (index === 0) return 'rank-1';
  if (index === 1) return 'rank-2';
  if (index === 2) return 'rank-3';
  return '';
}

function goBack() {
  router.back();
}
</script>

<style scoped>
.rank-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 220px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0 0 30px 30px;
}

.content-wrapper {
  position: relative;
  z-index: 1;
  padding: 0 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
}

.page-title {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.rank-tabs {
  margin-top: 8px;
}

.rank-tabs :deep(.van-tabs__nav) {
  background: transparent !important;
}

.rank-tabs :deep(.van-tab) {
  color: rgba(255, 255, 255, 0.6) !important;
  font-weight: 500;
}

.rank-tabs :deep(.van-tab--active) {
  color: #fff !important;
  font-weight: bold;
}

.rank-tabs :deep(.van-tabs__line) {
  background: #fff !important;
  border-radius: 2px;
}

.my-rank-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.my-rank-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.my-rank-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.my-nickname {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.my-rank-label {
  font-size: 12px;
  color: #999;
}

.my-rank-value {
  text-align: right;
}

.my-rank-num {
  font-size: 28px;
  font-weight: bold;
  color: #667eea;
  line-height: 1;
}

.my-rank-num.no-rank {
  font-size: 18px;
  color: #999;
  font-weight: 500;
}

.my-coins,
.my-charm {
  font-size: 13px;
  color: #ff9800;
  margin-top: 4px;
  font-weight: 500;
}

.rank-list {
  margin-top: 16px;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-item:active {
  background: #f8f8f8;
}

.rank-num {
  width: 36px;
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  color: #999;
  flex-shrink: 0;
}

.rank-num.rank-1 {
  color: #ff6b6b;
}

.rank-num.rank-2 {
  color: #ffa94d;
}

.rank-num.rank-3 {
  color: #ffd43b;
}

.rank-medal {
  font-size: 26px;
}

.rank-avatar {
  margin: 0 12px;
  flex-shrink: 0;
}

.rank-info {
  flex: 1;
  min-width: 0;
}

.rank-nickname {
  font-size: 15px;
  color: #333;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-value {
  font-size: 14px;
  color: #ff9800;
  font-weight: bold;
  margin-top: 2px;
}

.rank-value.charm {
  color: #ff6b9d;
}

.empty-tip {
  text-align: center;
  padding: 40px 0;
  color: #999;
  font-size: 14px;
}
</style>
