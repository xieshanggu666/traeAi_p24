<template>
  <div class="blacklist-page">
    <div class="page-header">
      <van-icon name="arrow-left" size="24" @click="goBack" />
      <div class="page-title">黑名单</div>
      <div class="header-placeholder"></div>
    </div>

    <div class="content">
      <van-loading v-if="loading" color="#1989fa" style="margin-top: 60px;">
        加载中...
      </van-loading>

      <div v-else-if="blacklist.length === 0" class="empty-state">
        <div class="empty-icon">🛡️</div>
        <div class="empty-title">黑名单为空</div>
        <div class="empty-desc">您还没有拉黑任何人</div>
      </div>

      <div v-else class="blacklist-list">
        <div
          class="blacklist-item"
          v-for="item in blacklist"
          :key="item.id"
        >
          <AvatarDisplay :avatar="item.avatar" :size="52" class="item-avatar" />
          <div class="item-info">
            <div class="item-nickname-row">
              <span class="item-nickname">{{ item.nickname }}</span>
              <span class="gender-icon" v-if="item.gender === '男'">♂</span>
              <span class="gender-icon gender-female" v-else-if="item.gender === '女'">♀</span>
            </div>
            <div class="item-username" v-if="item.username">@{{ item.username }}</div>
            <div class="item-blocked-at">
              <van-icon name="clock-o" size="11" />
              <span>拉黑于 {{ formatBlockedTime(item.blocked_at) }}</span>
            </div>
          </div>
          <van-button
            type="success"
            plain
            size="small"
            round
            :loading="unblockingId === item.id"
            @click="handleUnblock(item)"
          >
            解除拉黑
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { getBlacklist, unblockUser } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const blacklist = ref([]);
const loading = ref(false);
const unblockingId = ref(null);

onMounted(() => {
  fetchBlacklist();
});

async function fetchBlacklist() {
  loading.value = true;
  try {
    const result = await getBlacklist();
    blacklist.value = result || [];
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '获取黑名单失败');
  } finally {
    loading.value = false;
  }
}

async function handleUnblock(item) {
  try {
    await showDialog({
      title: '确认解除',
      message: `确定要解除对「${item.nickname}」的拉黑吗？`,
      showCancelButton: true,
      confirmButtonText: '解除',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }
  try {
    unblockingId.value = item.id;
    await unblockUser(item.id);
    blacklist.value = blacklist.value.filter(b => b.id !== item.id);
    showToast('已解除拉黑');
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '解除拉黑失败');
  } finally {
    unblockingId.value = null;
  }
}

function formatBlockedTime(time) {
  if (!time) return '';
  const date = new Date(time);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 30) return `${diffDays}天前`;
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function goBack() {
  router.back();
}
</script>

<style scoped>
.blacklist-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 100;
}

.page-title {
  font-size: 17px;
  font-weight: bold;
  color: #333;
}

.header-placeholder {
  width: 24px;
}

.content {
  padding: 12px 16px;
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
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-title {
  font-size: 17px;
  font-weight: bold;
  color: #666;
  margin-bottom: 6px;
}

.empty-desc {
  font-size: 13px;
}

.blacklist-list {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

.blacklist-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid #f5f5f5;
}

.blacklist-item:last-child {
  border-bottom: none;
}

.item-avatar {
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-nickname-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.item-nickname {
  font-size: 15px;
  font-weight: bold;
  color: #333;
}

.gender-icon {
  font-size: 14px;
  color: #4a9eff;
  font-weight: bold;
}

.gender-female {
  color: #ff6b9d;
}

.item-username {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.item-blocked-at {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #bbb;
}
</style>
