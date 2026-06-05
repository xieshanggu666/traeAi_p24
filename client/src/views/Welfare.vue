<template>
  <div class="welfare-page">
    <div class="header-bg"></div>
    <div class="content-wrapper">
      <div class="coin-card" @click="showRecords = true">
        <div class="coin-left">
          <div class="coin-icon">🪙</div>
          <div class="coin-info">
            <div class="coin-label">漂流币总额</div>
            <div class="coin-value">{{ welfareInfo.totalCoins }}</div>
          </div>
        </div>
        <div class="coin-right">
          <div class="today-coin">
            <span class="today-label">今日获取</span>
            <span class="today-value">+{{ welfareInfo.todayCoins }}</span>
          </div>
          <van-icon name="arrow" size="14" color="#fff" />
        </div>
      </div>

      <div class="checkin-section">
        <div class="section-header">
          <div class="section-title">📅 每日签到</div>
        </div>
        <van-button
          type="primary"
          round
          block
          class="checkin-btn"
          @click="handleCheckin"
        >
          {{ todayCheckedIn ? '✅ 今日已签到' : '📝 点击签到' }}
        </van-button>

        <div class="gift-row">
          <div
            v-for="gift in gifts"
            :key="gift.days"
            class="gift-item"
            :class="{
              'gift-claimable': gift.canClaim && !gift.claimed,
              'gift-claimed': gift.claimed,
              'gift-locked': !gift.canClaim
            }"
            @click="handleClaimGift(gift)"
          >
            <div class="gift-icon">{{ gift.claimed ? '🎁' : (gift.canClaim ? '🎊' : '🔒') }}</div>
            <div class="gift-days">{{ gift.days }}天礼包</div>
            <div class="gift-range">{{ gift.min }}-{{ gift.max }}</div>
          </div>
        </div>
      </div>

      <div class="task-section">
        <div class="section-header">
          <div class="section-title">🏆 任务中心</div>
        </div>

        <div class="task-group" v-if="tasks.onceTasks && tasks.onceTasks.length">
          <div class="task-group-title">一次性任务</div>
          <div
            v-for="task in tasks.onceTasks"
            :key="task.key"
            class="task-item"
          >
            <div class="task-info">
              <div class="task-name">{{ task.name }}</div>
              <div class="task-reward">🪙 {{ task.reward }}</div>
            </div>
            <van-button
              size="small"
              round
              :type="task.claimed ? 'default' : (task.completed ? 'primary' : 'default')"
              :disabled="task.claimed || !task.completed"
              @click="handleClaimTask(task)"
            >
              {{ task.claimed ? '已领取' : (task.completed ? '领取' : '未完成') }}
            </van-button>
          </div>
        </div>

        <div class="task-group" v-if="tasks.dailyTasks && tasks.dailyTasks.length">
          <div class="task-group-title">每日任务</div>
          <div
            v-for="task in tasks.dailyTasks"
            :key="task.key"
            class="task-item"
          >
            <div class="task-info">
              <div class="task-name">{{ task.name }}</div>
              <div class="task-detail">
                <span class="task-reward">🪙 {{ task.reward }}</span>
                <span class="task-progress" v-if="task.progress !== undefined">
                  {{ formatProgress(task) }}
                </span>
              </div>
            </div>
            <van-button
              size="small"
              round
              :type="task.claimed ? 'default' : (task.completed ? 'primary' : 'default')"
              :disabled="task.claimed || !task.completed"
              @click="handleClaimTask(task)"
            >
              {{ task.claimed ? '已领取' : (task.completed ? '领取' : '进行中') }}
            </van-button>
          </div>
        </div>
      </div>
    </div>

    <van-popup
      v-model:show="showCheckinPopup"
      round
      position="bottom"
      :style="{ maxHeight: '80vh' }"
    >
      <div class="checkin-popup">
        <div class="popup-header">
          <div class="popup-title">📅 签到日历</div>
          <van-icon name="cross" size="20" @click="showCheckinPopup = false" />
        </div>
        <div class="calendar-nav">
          <van-icon name="arrow-left" size="20" @click="prevMonth" />
          <span class="calendar-month">{{ calYear }}年{{ calMonth }}月</span>
          <van-icon name="arrow-right" size="20" @click="nextMonth" />
        </div>
        <div class="calendar-weekdays">
          <span v-for="d in weekdays" :key="d">{{ d }}</span>
        </div>
        <div class="calendar-days">
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            class="calendar-day"
            :class="{
              'empty': !day,
              'checked': day && checkinDates.includes(day.fullDate),
              'unchecked': day && !checkinDates.includes(day.fullDate) && isPastDate(day.fullDate),
              'today': day && day.fullDate === todayStr
            }"
          >
            <span v-if="day" class="day-num">{{ day.day }}</span>
            <span v-if="day && checkinDates.includes(day.fullDate)" class="day-mark check-mark">✓</span>
            <span v-if="day && !checkinDates.includes(day.fullDate) && isPastDate(day.fullDate)" class="day-mark cross-mark">✗</span>
          </div>
        </div>
      </div>
    </van-popup>

    <van-popup
      v-model:show="showRecords"
      round
      position="bottom"
      :style="{ maxHeight: '80vh' }"
    >
      <div class="records-popup">
        <div class="popup-header">
          <div class="popup-title">🪙 漂流币明细</div>
          <van-icon name="cross" size="20" @click="showRecords = false" />
        </div>
        <div class="records-list">
          <div
            v-for="record in coinRecords"
            :key="record.id"
            class="record-item"
          >
            <div class="record-info">
              <div class="record-source">{{ record.source }}</div>
              <div class="record-time">{{ formatRecordTime(record.created_at) }}</div>
            </div>
            <div class="record-amount">+{{ record.amount }}</div>
          </div>
          <div class="empty-records" v-if="coinRecords.length === 0">
            暂无记录
          </div>
        </div>
      </div>
    </van-popup>

    <van-tabbar v-model="active" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o" @click="goToHome">首页</van-tabbar-item>
      <van-tabbar-item name="welfare" icon="gift-o">福利</van-tabbar-item>
      <van-tabbar-item name="my" icon="user-o" @click="goToMy">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import {
  getWelfareInfo,
  getCoinRecords,
  checkin,
  getCheckinStatus,
  claimGift,
  getTasks,
  claimTask,
  reportUsage
} from '../api';

const router = useRouter();
const active = ref('welfare');
const welfareInfo = ref({ totalCoins: 0, todayCoins: 0 });
const tasks = ref({ onceTasks: [], dailyTasks: [] });
const showCheckinPopup = ref(false);
const showRecords = ref(false);
const coinRecords = ref([]);
const calYear = ref(new Date().getFullYear());
const calMonth = ref(new Date().getMonth() + 1);
const checkinDates = ref([]);
const claimedGifts = ref([]);

const todayStr = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

const todayCheckedIn = computed(() => {
  return checkinDates.value.includes(todayStr.value);
});

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

const gifts = computed(() => {
  const giftConfigs = [
    { days: 7, min: 70, max: 210 },
    { days: 14, min: 140, max: 420 },
    { days: 21, min: 280, max: 840 }
  ];
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = calYear.value === now.getFullYear() && calMonth.value === now.getMonth() + 1;

  return giftConfigs.map(g => {
    const checkinCount = checkinDates.value.length;
    const canClaim = isCurrentMonth && checkinCount >= g.days;
    const claimed = isCurrentMonth && claimedGifts.value.includes(g.days);
    return { ...g, canClaim, claimed };
  });
});

const calendarDays = computed(() => {
  const year = calYear.value;
  const month = calMonth.value;
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const fullDate = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ day: d, fullDate });
  }

  return days;
});

let usageTimer = null;
let usageAccumulator = 0;

onMounted(() => {
  fetchWelfareInfo();
  fetchTasks();
  fetchCheckinStatus();

  usageTimer = setInterval(() => {
    usageAccumulator += 60;
    if (usageAccumulator >= 60) {
      reportUsage(usageAccumulator).catch(() => {});
      usageAccumulator = 0;
    }
  }, 60000);
});

onUnmounted(() => {
  if (usageTimer) {
    clearInterval(usageTimer);
    if (usageAccumulator > 0) {
      reportUsage(usageAccumulator).catch(() => {});
    }
  }
});

watch(showRecords, (val) => {
  if (val) fetchCoinRecords();
});

async function fetchWelfareInfo() {
  try {
    welfareInfo.value = await getWelfareInfo();
  } catch (error) {
    console.error('获取福利信息失败:', error);
  }
}

async function fetchTasks() {
  try {
    tasks.value = await getTasks();
  } catch (error) {
    console.error('获取任务列表失败:', error);
  }
}

async function fetchCheckinStatus() {
  try {
    const result = await getCheckinStatus(calYear.value, calMonth.value);
    checkinDates.value = result.checkinDates;
    claimedGifts.value = result.claimedGifts;
  } catch (error) {
    console.error('获取签到状态失败:', error);
  }
}

async function fetchCoinRecords() {
  try {
    const result = await getCoinRecords(1, 50);
    coinRecords.value = result.records;
  } catch (error) {
    console.error('获取漂流币记录失败:', error);
  }
}

async function handleCheckin() {
  if (todayCheckedIn.value) {
    showCheckinPopup.value = true;
    return;
  }
  try {
    const result = await checkin();
    showToast(result._message || '操作成功');
    await fetchCheckinStatus();
    await fetchWelfareInfo();
    showCheckinPopup.value = true;
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  }
}

async function handleClaimGift(gift) {
  if (gift.claimed) {
    showToast('该礼包已领取');
    return;
  }
  if (!gift.canClaim) {
    showToast(`本月签到不足${gift.days}天`);
    return;
  }
  try {
    const result = await claimGift(gift.days);
    showToast(result._message || '操作成功');
    await fetchCheckinStatus();
    await fetchWelfareInfo();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  }
}

async function handleClaimTask(task) {
  if (task.claimed) return;
  if (!task.completed) return;
  try {
    const result = await claimTask(task.key);
    showToast(result._message || '操作成功');
    await fetchTasks();
    await fetchWelfareInfo();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  }
}

function prevMonth() {
  if (calMonth.value === 1) {
    calMonth.value = 12;
    calYear.value--;
  } else {
    calMonth.value--;
  }
  fetchCheckinStatus();
}

function nextMonth() {
  if (calMonth.value === 12) {
    calMonth.value = 1;
    calYear.value++;
  } else {
    calMonth.value++;
  }
  fetchCheckinStatus();
}

function isPastDate(dateStr) {
  return dateStr < todayStr.value;
}

function formatProgress(task) {
  if (task.requireSeconds) {
    const mins = Math.floor(task.progress / 60);
    const requireMins = Math.floor(task.requireSeconds / 60);
    return `${mins}/${requireMins}分钟`;
  }
  if (task.requireCount) {
    return `${task.progress}/${task.requireCount}次`;
  }
  return '';
}

function formatRecordTime(time) {
  if (!time) return '';
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function goToHome() {
  router.push('/');
}

function goToMy() {
  router.push('/my');
}
</script>

<style scoped>
.welfare-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 50px;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 160px;
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%);
  border-radius: 0 0 30px 30px;
}

.content-wrapper {
  position: relative;
  z-index: 1;
  padding: 20px;
}

.coin-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: #fff;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
  cursor: pointer;
  transition: transform 0.2s;
}

.coin-card:active {
  transform: scale(0.98);
}

.coin-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.coin-icon {
  font-size: 36px;
}

.coin-label {
  font-size: 13px;
  opacity: 0.85;
}

.coin-value {
  font-size: 32px;
  font-weight: bold;
  margin-top: 2px;
}

.coin-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.today-coin {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.today-label {
  font-size: 12px;
  opacity: 0.8;
}

.today-value {
  font-size: 18px;
  font-weight: bold;
  color: #ffd700;
}

.checkin-section,
.task-section {
  margin-top: 20px;
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.section-header {
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.checkin-btn {
  margin-bottom: 16px;
}

.gift-row {
  display: flex;
  gap: 10px;
}

.gift-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 8px;
  border-radius: 12px;
  background: #f8f8f8;
  cursor: pointer;
  transition: all 0.2s;
}

.gift-item:active {
  transform: scale(0.96);
}

.gift-claimable {
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  border: 2px solid #ff9800;
}

.gift-claimed {
  background: #f0f0f0;
  opacity: 0.6;
}

.gift-locked {
  opacity: 0.7;
}

.gift-icon {
  font-size: 28px;
  margin-bottom: 6px;
}

.gift-days {
  font-size: 13px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.gift-range {
  font-size: 11px;
  color: #ff9800;
}

.task-group {
  margin-top: 16px;
}

.task-group-title {
  font-size: 14px;
  font-weight: bold;
  color: #666;
  margin-bottom: 10px;
  padding-left: 4px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
}

.task-item:last-child {
  border-bottom: none;
}

.task-info {
  flex: 1;
}

.task-name {
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.task-detail {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.task-reward {
  font-size: 13px;
  color: #ff9800;
  font-weight: bold;
}

.task-progress {
  font-size: 12px;
  color: #999;
}

.checkin-popup,
.records-popup {
  padding: 20px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.popup-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.calendar-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
  padding: 8px 0;
}

.calendar-month {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  min-width: 120px;
  text-align: center;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 8px;
}

.calendar-weekdays span {
  font-size: 13px;
  color: #999;
  padding: 6px 0;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 48px;
  border-radius: 8px;
  font-size: 14px;
}

.calendar-day.empty {
  height: 48px;
}

.calendar-day.today {
  background: #e3f2fd;
}

.calendar-day.checked {
  background: #e8f5e9;
}

.day-num {
  font-weight: 500;
  color: #333;
}

.day-mark {
  font-size: 11px;
  position: absolute;
  bottom: 2px;
}

.check-mark {
  color: #4caf50;
  font-weight: bold;
}

.cross-mark {
  color: #f44336;
  font-weight: bold;
}

.calendar-day.unchecked {
  background: #ffebee;
}

.records-list {
  max-height: 50vh;
  overflow-y: auto;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
}

.record-item:last-child {
  border-bottom: none;
}

.record-source {
  font-size: 14px;
  color: #333;
}

.record-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.record-amount {
  font-size: 16px;
  font-weight: bold;
  color: #ff9800;
}

.empty-records {
  text-align: center;
  padding: 40px 0;
  color: #999;
  font-size: 14px;
}
</style>
