<template>
  <div class="page-container">
    <div class="wave-bg">
      <div class="water-layer water-layer-1"></div>
      <div class="water-layer water-layer-2"></div>
      <div class="water-layer water-layer-3"></div>
    </div>
    <div class="content-wrapper">
      <div class="nav-bar">
        <van-icon name="arrow-left" size="24" color="#fff" @click="goBack" />
        <span class="nav-title">捞瓶子</span>
        <div class="nav-actions">
          <div class="filter-btn" @click="showFilter = true" :class="{ 'filter-active': hasActiveFilters }">
            <van-icon name="filter" size="20" />
            <span class="filter-count" v-if="hasActiveFilters">●</span>
          </div>
          <div class="limit-badge" :class="{ 'limit-reached': pickRemaining <= 0 }">
            今日剩余: {{ pickRemaining }}次
          </div>
        </div>
      </div>

      <div class="filter-status-bar" v-if="hasActiveFilters && !bottle && !isPicking && pickRemaining > 0">
        <span class="filter-status-text">
          已筛选：{{ filterStatusText }} · 符合条件 {{ filteredCount }} 个
        </span>
        <van-icon name="cross" size="14" @click="clearFilters" class="clear-filter-btn" />
      </div>

      <div class="limit-warning" v-if="pickRemaining <= 0 && !bottle && !isPicking">
        <van-icon name="warning-o" size="16" />
        <span>今日捞瓶子次数已达上限(20次)，明天再来吧</span>
      </div>

      <div class="pick-area" v-if="!bottle && !isPicking && pickRemaining > 0">
        <div class="ocean-container">
          <div class="water-surface">
            <div class="wave wave-1"></div>
            <div class="wave wave-2"></div>
            <div class="wave wave-3"></div>
          </div>
          <div class="deep-ocean">
            <div class="bubble bubble-1"></div>
            <div class="bubble bubble-2"></div>
            <div class="bubble bubble-3"></div>
            <div class="bubble bubble-4"></div>
            <div class="bubble bubble-5"></div>
          </div>
          <div class="net-animation">
            <div class="net" :class="{ 'net-active': isPicking }">
              <span class="net-icon">🥅</span>
              <div class="net-rope"></div>
            </div>
          </div>
        </div>
        <div class="pick-hint">点击下方按钮捞取漂流瓶</div>
      </div>

      <div class="picking-animation" v-else-if="isPicking">
        <div class="picking-ocean">
          <div class="water-ripple"></div>
          <div class="water-ripple ripple-2"></div>
          <div class="water-ripple ripple-3"></div>
          <div class="bottle-emerge" v-if="showBottleEmerging">
            <div class="emerging-bottle">🍾</div>
            <div class="water-splash">
              <div class="splash-drop drop-1"></div>
              <div class="splash-drop drop-2"></div>
              <div class="splash-drop drop-3"></div>
              <div class="splash-drop drop-4"></div>
              <div class="splash-drop drop-5"></div>
              <div class="splash-drop drop-6"></div>
            </div>
          </div>
          <div class="net-pulling" :class="{ 'pulling-up': isPullingUp }">
            <span class="net-icon">🥅</span>
          </div>
        </div>
        <div class="picking-text">{{ pickingText }}</div>
      </div>

      <div class="bottle-detail" v-else-if="bottle && !showReply">
        <div class="bottle-card">
          <div class="bottle-header">
            <div class="sender-info">
              <AvatarDisplay :avatar="bottle.senderAvatar" :size="50" class="sender-avatar" />
              <div class="sender-detail">
                <div class="sender-nickname">{{ bottle.senderNickname }}</div>
                <div class="sender-meta">
                  <span v-if="bottle.senderGender" class="gender-tag">{{ bottle.senderGender === 'male' ? '♂ 男' : '♀ 女' }}</span>
                  <span v-if="getSenderAge(bottle.senderBirthday)" class="age-tag">{{ getSenderAge(bottle.senderBirthday) }}岁</span>
                  <span class="bottle-time">{{ formatTime(bottle.createdAt) }}</span>
                </div>
              </div>
            </div>
            <span class="bottle-tag">🍾 漂流瓶</span>
          </div>

          <div class="bottle-content">
            {{ bottle.content }}
          </div>

          <div class="bottle-actions">
            <van-button 
              type="default" 
              block 
              class="action-btn return-btn"
              :disabled="isReturning"
              :loading="isReturning"
              loading-text="扔回中..."
              @click="returnBottle"
            >
              🌊 扔回海里
            </van-button>
            <van-button 
              type="primary" 
              block 
              class="action-btn reply-btn"
              @click="showReply = true"
            >
              💬 回复TA
            </van-button>
          </div>
        </div>
      </div>

      <div class="reply-card" v-else-if="showReply">
        <div class="reply-header">
          <van-icon name="arrow-left" size="20" @click="showReply = false" />
          <span class="reply-title">回复TA</span>
          <div style="width: 20px;"></div>
        </div>

        <div class="original-content">
          <div class="original-label">对方的瓶子：</div>
          <div class="original-text">{{ bottle.content }}</div>
        </div>

        <div class="quick-reply-toggle">
          <van-icon 
            :name="showQuickReply ? 'arrow-down' : 'chat-o'" 
            size="18" 
            class="toggle-icon"
          />
          <span @click="showQuickReply = !showQuickReply" class="toggle-text">
            {{ showQuickReply ? '收起快捷回复' : '快捷回复' }}
          </span>
        </div>

        <div class="quick-reply-panel" v-if="showQuickReply">
          <div class="quick-reply-tabs">
            <div 
              v-for="(category, index) in quickReplyCategories" 
              :key="index"
              class="quick-tab"
              :class="{ active: activeQuickCategory === index }"
              @click="activeQuickCategory = index"
            >
              {{ category.name }}
            </div>
          </div>
          <div class="quick-reply-list">
            <div 
              v-for="(msg, msgIndex) in quickReplyCategories[activeQuickCategory].messages" 
              :key="msgIndex"
              class="quick-reply-item"
              @click="useQuickReply(msg)"
            >
              {{ msg }}
            </div>
          </div>
        </div>

        <textarea
          v-model="replyContent"
          class="reply-input"
          placeholder="写下你想说的话..."
          maxlength="500"
          :disabled="isReplying"
          @focus="showQuickReply = false"
        ></textarea>
        <div class="char-count">{{ replyContent.length }}/500</div>

        <van-button
          type="primary"
          block
          size="large"
          class="send-btn"
          :disabled="!canReply || isReplying"
          :loading="isReplying"
          loading-text="发送中..."
          @click="replyBottle"
        >
          发送回复
        </van-button>
      </div>

      <div class="empty-state" v-else-if="showEmpty">
        <div class="empty-icon">🌊</div>
        <div class="empty-text">海里暂时没有符合条件的漂流瓶</div>
        <div class="empty-desc">试试调整筛选条件，或过一会儿再来</div>
      </div>

      <div class="pick-button-area" v-if="!bottle && !isPicking && !showEmpty && pickRemaining > 0">
        <van-button
          type="primary"
          size="large"
          block
          class="pick-btn"
          @click="pickBottle"
        >
          🌊 捞一个
        </van-button>
        <div class="pick-tip">今日还可捞 {{ pickRemaining }} 次</div>
      </div>

      <div class="pick-button-area" v-if="showEmpty && !bottle && pickRemaining > 0">
        <van-button
          type="primary"
          size="large"
          block
          class="pick-btn"
          @click="resetAndPick"
        >
          🔄 再捞一次
        </van-button>
      </div>
    </div>

    <van-popup
      v-model:show="showFilter"
      round
      position="bottom"
      :style="{ maxHeight: '80vh' }"
    >
      <div class="filter-panel">
        <div class="popup-header">
          <div class="popup-title">🔍 筛选条件</div>
          <van-icon name="cross" size="20" @click="showFilter = false" />
        </div>

        <div class="filter-section">
          <div class="filter-label">
            <span class="filter-icon">👤</span>
            性别筛选
          </div>
          <div class="filter-options">
            <div 
              v-for="option in genderOptions" 
              :key="option.value"
              class="filter-option"
              :class="{ active: filters.gender === option.value }"
              @click="setFilter('gender', option.value)"
            >
              {{ option.label }}
            </div>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-label">
            <span class="filter-icon">🎂</span>
            年龄范围
            <span class="filter-value">{{ filters.minAge }} - {{ filters.maxAge }}岁</span>
          </div>
          <div class="age-slider">
            <div class="age-track">
              <div 
                class="age-track-active" 
                :style="{ 
                  left: ((filters.minAge - 18) / 42 * 100) + '%', 
                  width: ((filters.maxAge - filters.minAge) / 42 * 100) + '%' 
                }"
              ></div>
            </div>
            <div class="age-inputs">
              <div class="age-input-group">
                <span>最小</span>
                <van-stepper 
                  v-model="filters.minAge" 
                  :min="18" 
                  :max="filters.maxAge - 1" 
                  input-width="60px"
                  button-size="24"
                  @change="updateFilterCount"
                />
              </div>
              <div class="age-divider">~</div>
              <div class="age-input-group">
                <span>最大</span>
                <van-stepper 
                  v-model="filters.maxAge" 
                  :min="filters.minAge + 1" 
                  :max="60" 
                  input-width="60px"
                  button-size="24"
                  @change="updateFilterCount"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="filter-section">
          <div class="filter-label">
            <span class="filter-icon">⏰</span>
            投放时间
          </div>
          <div class="filter-options">
            <div 
              v-for="option in timeOptions" 
              :key="option.value"
              class="filter-option"
              :class="{ active: filters.timeRange === option.value }"
              @click="setFilter('timeRange', option.value)"
            >
              {{ option.label }}
            </div>
          </div>
        </div>

        <div class="filter-count-info">
          <van-icon name="info-o" size="14" color="#1989fa" />
          <span>当前条件下，海里有 <strong class="count-number">{{ filteredCount }}</strong> 个符合条件的瓶子</span>
        </div>

        <div class="filter-footer">
          <van-button plain block class="reset-btn" @click="resetFilters">
            重置
          </van-button>
          <van-button type="primary" block class="confirm-btn" @click="applyFilters">
            应用筛选
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { pickBottle as apiPickBottle, returnBottle as apiReturnBottle, replyBottle as apiReplyBottle, getDailyLimits, getFilteredBottleCount } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const router = useRouter();
const bottle = ref(null);
const isPicking = ref(false);
const isReturning = ref(false);
const isReplying = ref(false);
const showReply = ref(false);
const showEmpty = ref(false);
const replyContent = ref('');
const pickRemaining = ref(20);
const pickLimit = ref(20);
const showQuickReply = ref(false);
const activeQuickCategory = ref(0);
const showFilter = ref(false);
const filteredCount = ref(0);
const isPullingUp = ref(false);
const showBottleEmerging = ref(false);
const pickingText = ref('正在捞取中...');

const filters = ref({
  gender: 'all',
  minAge: 18,
  maxAge: 60,
  timeRange: 'all'
});

const quickReplyCategories = [
  {
    name: '打招呼',
    messages: [
      '你好呀~',
      '嗨，很高兴认识你！',
      '哈喽，在吗？',
      '你好，看到你的瓶子了',
      'Hi~ 缘分让我们相遇',
      '你好呀，想和你聊聊'
    ]
  },
  {
    name: '心情',
    messages: [
      '我今天心情很好！',
      '今天有点累，想找人聊聊',
      '最近压力有点大...',
      '分享一件开心的小事给你',
      '今天遇到了很有趣的事',
      '突然想找个人说说话'
    ]
  },
  {
    name: '兴趣',
    messages: [
      '你平时喜欢做什么？',
      '有什么好看的剧推荐吗？',
      '最近在听什么歌？',
      '你喜欢旅游吗？',
      '平时喜欢看什么类型的电影？',
      '有什么爱好吗？'
    ]
  },
  {
    name: '晚安',
    messages: [
      '晚安，好梦~',
      '早点休息吧，晚安',
      '晚安，明天又是美好的一天',
      '愿你有个好梦，晚安',
      '很晚了，早点睡哦，晚安',
      '晚安，陌生人'
    ]
  }
];

const genderOptions = [
  { label: '不限', value: 'all' },
  { label: '男', value: 'male' },
  { label: '女', value: 'female' }
];

const timeOptions = [
  { label: '不限', value: 'all' },
  { label: '24小时内', value: '24h' },
  { label: '3天内', value: '3d' },
  { label: '7天内', value: '7d' }
];

const hasActiveFilters = computed(() => {
  return filters.value.gender !== 'all' || 
         filters.value.minAge !== 18 || 
         filters.value.maxAge !== 60 || 
         filters.value.timeRange !== 'all';
});

const filterStatusText = computed(() => {
  const parts = [];
  if (filters.value.gender !== 'all') {
    parts.push(filters.value.gender === 'male' ? '男' : '女');
  }
  if (filters.value.minAge !== 18 || filters.value.maxAge !== 60) {
    parts.push(`${filters.value.minAge}-${filters.value.maxAge}岁`);
  }
  if (filters.value.timeRange !== 'all') {
    const timeLabel = timeOptions.find(o => o.value === filters.value.timeRange)?.label;
    if (timeLabel) parts.push(timeLabel);
  }
  return parts.join(' · ');
});

const canReply = computed(() => {
  return replyContent.value.trim().length > 0;
});

onMounted(() => {
  fetchDailyLimits();
  updateFilterCount();
});

watch(showFilter, (val) => {
  if (val) {
    updateFilterCount();
  }
});

async function fetchDailyLimits() {
  try {
    const result = await getDailyLimits();
    pickRemaining.value = result.pickRemaining;
    pickLimit.value = result.pickLimit;
  } catch (error) {
    console.error('获取每日限制失败:', error);
  }
}

async function updateFilterCount() {
  try {
    const result = await getFilteredBottleCount(filters.value);
    filteredCount.value = result.count;
  } catch (error) {
    console.error('获取筛选数量失败:', error);
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

function getSenderAge(birthday) {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 18 && age <= 100 ? age : null;
}

function useQuickReply(msg) {
  replyContent.value = msg;
  showQuickReply.value = false;
}

function setFilter(key, value) {
  filters.value[key] = value;
  updateFilterCount();
}

function resetFilters() {
  filters.value = {
    gender: 'all',
    minAge: 18,
    maxAge: 60,
    timeRange: 'all'
  };
  updateFilterCount();
}

function clearFilters() {
  resetFilters();
}

function applyFilters() {
  showFilter.value = false;
  updateFilterCount();
}

async function pickBottle() {
  if (pickRemaining.value <= 0) {
    showToast('今日捞瓶子次数已达上限');
    return;
  }

  isPicking.value = true;
  isPullingUp.value = false;
  showBottleEmerging.value = false;
  showEmpty.value = false;
  pickingText.value = '正在捞取中...';

  try {
    setTimeout(() => {
      isPullingUp.value = true;
      pickingText.value = '渔网正在收起...';
    }, 800);

    setTimeout(() => {
      showBottleEmerging.value = true;
      pickingText.value = '瓶子浮出水面！';
    }, 1600);

    const result = await apiPickBottle(filters.value);
    bottle.value = result;
    if (result.pickRemaining !== undefined) {
      pickRemaining.value = result.pickRemaining;
    } else {
      pickRemaining.value = Math.max(0, pickRemaining.value - 1);
    }
    updateFilterCount();
  } catch (error) {
    if (error.httpMessage && error.httpMessage.includes('上限')) {
      pickRemaining.value = 0;
      showToast(error.httpMessage);
    } else if (error.businessMessage && error.businessMessage.includes('没有符合条件')) {
      showEmpty.value = true;
    } else {
      showToast(error.businessMessage || error.httpMessage || '出现异常');
    }
  } finally {
    setTimeout(() => {
      isPicking.value = false;
    }, 600);
  }
}

async function returnBottle() {
  if (!bottle.value) return;

  isReturning.value = true;

  try {
    const result = await apiReturnBottle(bottle.value.id);
    showToast(result._message || '操作成功');
    bottle.value = null;
    showReply.value = false;
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    isReturning.value = false;
  }
}

async function replyBottle() {
  if (!canReply.value) {
    showToast('请先写下回复内容');
    return;
  }

  if (!bottle.value) {
    showToast('信息异常，请刷新重试');
    return;
  }

  isReplying.value = true;

  try {
    const result = await apiReplyBottle(bottle.value.id, replyContent.value);
    showToast(result._message || '操作成功');
    router.push(`/chat/${bottle.value.id}`);
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    isReplying.value = false;
  }
}

function resetAndPick() {
  showEmpty.value = false;
  pickBottle();
}

function goBack() {
  router.back();
}
</script>

<style scoped>
.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}

.nav-title {
  color: #fff;
  font-size: 18px;
  font-weight: bold;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-btn {
  position: relative;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s;
}

.filter-btn:active {
  transform: scale(0.95);
}

.filter-btn.filter-active {
  background: rgba(255, 255, 255, 0.4);
}

.filter-count {
  position: absolute;
  top: -2px;
  right: -2px;
  font-size: 8px;
  color: #ff4d4f;
}

.limit-badge {
  color: #fff;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 12px;
}

.limit-badge.limit-reached {
  background: rgba(255, 77, 79, 0.7);
}

.limit-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 77, 79, 0.9);
  color: #fff;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  margin-top: 10px;
}

.filter-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(102, 126, 234, 0.95);
  color: #fff;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  margin-top: 10px;
}

.filter-status-text {
  flex: 1;
}

.clear-filter-btn {
  cursor: pointer;
  opacity: 0.8;
  flex-shrink: 0;
  margin-left: 10px;
}

.pick-area {
  text-align: center;
  padding: 30px 0 20px;
}

.ocean-container {
  position: relative;
  height: 300px;
  margin-bottom: 20px;
  overflow: hidden;
  border-radius: 20px;
  background: linear-gradient(180deg, #4FC3F7 0%, #0288D1 50%, #01579B 100%);
}

.water-surface {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  overflow: hidden;
}

.wave {
  position: absolute;
  left: -100%;
  right: -100%;
  bottom: 0;
  height: 40px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath fill='rgba(255,255,255,0.3)' d='M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z'/%3E%3C/svg%3E") repeat-x;
  background-size: 600px 60px;
  animation: waveMove 4s linear infinite;
}

.wave-1 {
  opacity: 0.6;
  animation-duration: 3s;
}

.wave-2 {
  opacity: 0.4;
  animation-duration: 4s;
  animation-delay: -1s;
}

.wave-3 {
  opacity: 0.2;
  animation-duration: 5s;
  animation-delay: -2s;
}

@keyframes waveMove {
  0% { transform: translateX(0); }
  100% { transform: translateX(50%); }
}

.deep-ocean {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.bubble {
  position: absolute;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(255,255,255,0.1));
  border-radius: 50%;
  animation: bubbleRise 4s ease-in-out infinite;
}

.bubble-1 { width: 8px; height: 8px; left: 20%; bottom: -20px; animation-delay: 0s; }
.bubble-2 { width: 12px; height: 12px; left: 40%; bottom: -20px; animation-delay: 1s; }
.bubble-3 { width: 6px; height: 6px; left: 60%; bottom: -20px; animation-delay: 0.5s; }
.bubble-4 { width: 10px; height: 10px; left: 75%; bottom: -20px; animation-delay: 1.5s; }
.bubble-5 { width: 14px; height: 14px; left: 85%; bottom: -20px; animation-delay: 2s; }

@keyframes bubbleRise {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.4;
  }
  100% {
    transform: translateY(-320px) scale(0.5);
    opacity: 0;
  }
}

.net-animation {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.net {
  position: relative;
  font-size: 100px;
  animation: netFloat 2s ease-in-out infinite;
  transition: all 0.5s;
}

.net-icon {
  display: block;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
}

.net-rope {
  position: absolute;
  top: -100px;
  left: 50%;
  width: 2px;
  height: 100px;
  background: linear-gradient(180deg, rgba(139,90,43,0.8), rgba(139,90,43,0.3));
  transform: translateX(-50%);
}

.net.net-active {
  animation: netSwing 0.8s ease-in-out infinite;
}

@keyframes netFloat {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-15px) rotate(5deg); }
}

@keyframes netSwing {
  0%, 100% { transform: rotate(-20deg) translateY(10px); }
  50% { transform: rotate(20deg) translateY(-10px); }
}

.pick-hint {
  color: #fff;
  font-size: 16px;
  opacity: 0.9;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.picking-animation {
  text-align: center;
  padding: 40px 0;
}

.picking-ocean {
  position: relative;
  height: 280px;
  margin-bottom: 30px;
  border-radius: 20px;
  background: linear-gradient(180deg, #4FC3F7 0%, #0288D1 60%, #01579B 100%);
  overflow: hidden;
}

.water-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.6);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: rippleExpand 2s ease-out infinite;
}

.ripple-2 {
  animation-delay: 0.5s;
}

.ripple-3 {
  animation-delay: 1s;
}

@keyframes rippleExpand {
  0% {
    width: 20px;
    height: 20px;
    opacity: 1;
  }
  100% {
    width: 300px;
    height: 300px;
    opacity: 0;
  }
}

.bottle-emerge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: bottleEmerge 1.2s ease-out forwards;
}

@keyframes bottleEmerge {
  0% {
    transform: translate(-50%, 100%) scale(0.5);
    opacity: 0;
  }
  60% {
    transform: translate(-50%, -70%) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

.emerging-bottle {
  font-size: 80px;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
  animation: bottleBounce 0.5s ease-out 1s;
}

@keyframes bottleBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.water-splash {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
}

.splash-drop {
  position: absolute;
  width: 8px;
  height: 8px;
  background: rgba(255,255,255,0.8);
  border-radius: 50%;
  animation: splashFly 0.8s ease-out 0.2s forwards;
  opacity: 0;
}

.drop-1 { left: 50%; top: 0; animation-delay: 0.2s; }
.drop-2 { left: 80%; top: 20%; animation-delay: 0.3s; }
.drop-3 { left: 90%; top: 50%; animation-delay: 0.25s; }
.drop-4 { left: 80%; top: 80%; animation-delay: 0.35s; }
.drop-5 { left: 20%; top: 80%; animation-delay: 0.28s; }
.drop-6 { left: 10%; top: 50%; animation-delay: 0.32s; }

@keyframes splashFly {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--tx, 0), var(--ty, -50px)) scale(0);
    opacity: 0;
  }
}

.splash-drop:nth-child(1) { --tx: 0px; --ty: -60px; }
.splash-drop:nth-child(2) { --tx: 50px; --ty: -40px; }
.splash-drop:nth-child(3) { --tx: 60px; --ty: 0px; }
.splash-drop:nth-child(4) { --tx: 40px; --ty: 50px; }
.splash-drop:nth-child(5) { --tx: -40px; --ty: 50px; }
.splash-drop:nth-child(6) { --tx: -60px; --ty: 0px; }

.net-pulling {
  position: absolute;
  top: 20%;
  left: 50%;
  transform: translate(-50%, 0);
  font-size: 80px;
  transition: all 0.8s ease-out;
  opacity: 0.8;
}

.net-pulling.pulling-up {
  top: 5%;
  opacity: 0.4;
}

.picking-text {
  color: #fff;
  font-size: 18px;
  margin-top: 20px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.bottle-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.bottle-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.sender-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sender-avatar {
  flex-shrink: 0;
}

.sender-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sender-nickname {
  font-size: 15px;
  font-weight: bold;
  color: #333;
}

.sender-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.gender-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #e6f7ff;
  color: #1890ff;
}

.gender-tag:has(♀) {
  background: #fff0f6;
  color: #eb2f96;
}

.age-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f6ffed;
  color: #52c41a;
}

.bottle-time {
  font-size: 12px;
  color: #999;
}

.bottle-tag {
  font-size: 12px;
  color: #1989fa;
  background: #e8f3ff;
  padding: 4px 10px;
  border-radius: 12px;
}

.bottle-content {
  background: #fafafa;
  border-radius: 12px;
  padding: 20px;
  font-size: 15px;
  line-height: 1.8;
  color: #333;
  min-height: 120px;
}

.bottle-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.action-btn {
  flex: 1;
  border-radius: 10px;
}

.return-btn {
  color: #666;
}

.reply-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.reply-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.reply-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.original-content {
  background: #f0f7ff;
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 15px;
}

.original-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.original-text {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
}

.quick-reply-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 0;
  color: #667eea;
  font-size: 14px;
  cursor: pointer;
  border-bottom: 1px dashed #eee;
}

.toggle-icon {
  font-size: 16px;
}

.toggle-text {
  flex: 1;
}

.quick-reply-panel {
  background: #fafafa;
  border-radius: 10px;
  margin: 12px 0;
  overflow: hidden;
}

.quick-reply-tabs {
  display: flex;
  background: #f0f0f0;
  overflow-x: auto;
}

.quick-tab {
  flex-shrink: 0;
  padding: 10px 16px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.quick-tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
  background: #fff;
  font-weight: 500;
}

.quick-reply-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  max-height: 180px;
  overflow-y: auto;
}

.quick-reply-item {
  flex: 0 0 calc(50% - 4px);
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.quick-reply-item:active {
  background: #667eea;
  color: #fff;
  transform: scale(0.98);
}

.reply-input {
  width: 100%;
  min-height: 100px;
  border: 2px solid #eee;
  border-radius: 12px;
  padding: 15px;
  font-size: 15px;
  resize: none;
  outline: none;
  transition: border-color 0.3s;
  font-family: inherit;
  margin-top: 12px;
}

.reply-input:focus {
  border-color: #1989fa;
}

.char-count {
  text-align: right;
  color: #999;
  font-size: 12px;
  margin-top: 8px;
}

.send-btn {
  margin-top: 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #fff;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
  opacity: 0.8;
}

.empty-text {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  opacity: 0.8;
}

.pick-button-area {
  position: fixed;
  bottom: 30px;
  left: 20px;
  right: 20px;
  max-width: 710px;
  margin: 0 auto;
  z-index: 10;
}

.pick-btn {
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  height: 54px;
  font-size: 17px;
}

.pick-btn:disabled {
  background: #ccc;
}

.pick-tip {
  text-align: center;
  color: #fff;
  font-size: 12px;
  margin-top: 10px;
  opacity: 0.8;
}

.filter-panel {
  padding: 20px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.popup-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.filter-section {
  margin-bottom: 24px;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #333;
  margin-bottom: 12px;
}

.filter-icon {
  font-size: 18px;
}

.filter-value {
  margin-left: auto;
  font-size: 13px;
  color: #667eea;
  font-weight: normal;
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-option {
  flex: 1;
  min-width: 70px;
  padding: 10px 16px;
  background: #f5f5f5;
  border: 2px solid transparent;
  border-radius: 10px;
  font-size: 14px;
  color: #333;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-option:active {
  transform: scale(0.98);
}

.filter-option.active {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-color: #667eea;
  color: #667eea;
  font-weight: 500;
}

.age-slider {
  background: #fafafa;
  border-radius: 12px;
  padding: 16px;
}

.age-track {
  position: relative;
  height: 6px;
  background: #e8e8e8;
  border-radius: 3px;
  margin-bottom: 20px;
}

.age-track-active {
  position: absolute;
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
  transition: all 0.3s;
}

.age-inputs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.age-input-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.age-input-group span {
  font-size: 12px;
  color: #999;
}

.age-divider {
  font-size: 20px;
  color: #ccc;
  font-weight: bold;
  padding-top: 16px;
}

.filter-count-info {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #e6f7ff;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 13px;
  color: #1890ff;
  margin-bottom: 20px;
}

.count-number {
  color: #667eea;
  font-size: 16px;
}

.filter-footer {
  display: flex;
  gap: 12px;
}

.reset-btn {
  flex: 1;
  border-radius: 12px;
  height: 48px;
  color: #666;
}

.confirm-btn {
  flex: 2;
  border-radius: 12px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.wave-bg {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 300px;
  z-index: 0;
  overflow: hidden;
}

.water-layer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
}

.water-layer-1 {
  height: 100%;
  background: linear-gradient(180deg, transparent 0%, #4FC3F7 40%, #29B6F6 100%);
}

.water-layer-2 {
  height: 60%;
  background: linear-gradient(180deg, transparent 0%, rgba(41,182,246,0.5) 100%);
  animation: waterShift 6s ease-in-out infinite;
}

.water-layer-3 {
  height: 40%;
  background: linear-gradient(180deg, transparent 0%, rgba(1,87,155,0.3) 100%);
  animation: waterShift 8s ease-in-out infinite reverse;
}

.water-layer::before {
  content: '';
  position: absolute;
  top: -30px;
  left: 0;
  right: 0;
  height: 60px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath fill='%234FC3F7' d='M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z'/%3E%3C/svg%3E") repeat-x;
  background-size: 600px 60px;
}

.water-layer-2::before {
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath fill='rgba(41,182,246,0.5)' d='M0,60 C200,20 400,100 600,60 C800,20 1000,100 1200,60 L1200,120 L0,120 Z'/%3E%3C/svg%3E") repeat-x;
  background-size: 800px 60px;
  opacity: 0.5;
}

@keyframes waterShift {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.content-wrapper {
  position: relative;
  z-index: 1;
  padding: 20px;
}
</style>
