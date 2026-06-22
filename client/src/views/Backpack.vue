<template>
  <div class="backpack-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="header-content">
        <h2 class="page-title">🎒 我的背包</h2>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="item-list" v-if="items.length > 0">
        <div
          v-for="item in items"
          :key="item.key"
          class="item-card"
        >
          <div class="item-icon">{{ item.icon }}</div>
          <div class="item-info">
            <div class="item-name">{{ item.name }}</div>
            <div class="item-desc">{{ item.description }}</div>
            <div class="item-quantity">拥有: <span class="quantity-num">{{ item.quantity }}</span></div>
          </div>
          <van-button
            v-if="item.category === 'gift' || item.category === 'special_gift'"
            size="small"
            round
            type="warning"
            :disabled="item.quantity <= 0"
            @click="handleSendGift(item)"
          >
            赠送
          </van-button>
          <van-button
            v-else
            size="small"
            round
            type="primary"
            :disabled="item.quantity <= 0"
            @click="handleUse(item)"
          >
            使用
          </van-button>
        </div>
      </div>

      <div class="empty-state" v-else-if="!loading">
        <div class="empty-icon">🎒</div>
        <div class="empty-text">背包空空如也</div>
        <div class="empty-desc">去商城购买道具吧</div>
        <van-button type="primary" size="small" style="margin-top: 16px;" @click="goToShop">
          前往商城
        </van-button>
      </div>

      <van-loading v-if="loading" color="#1989fa" style="margin-top: 40px; display: block; text-align: center;">加载中...</van-loading>
    </div>

    <van-popup
      v-model:show="showRetroPopup"
      round
      position="bottom"
      :style="{ maxHeight: '80vh' }"
    >
      <div class="retro-popup">
        <div class="popup-header">
          <div class="popup-title">📅 选择补签日期</div>
          <van-icon name="cross" size="20" @click="showRetroPopup = false" />
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
              'can-retro': day && !checkinDates.includes(day.fullDate) && isPastDate(day.fullDate),
              'future': day && !isPastDate(day.fullDate) && day.fullDate !== todayStr,
              'today': day && day.fullDate === todayStr
            }"
            @click="handleRetroDay(day)"
          >
            <span v-if="day" class="day-num">{{ day.day }}</span>
            <span v-if="day && checkinDates.includes(day.fullDate)" class="day-mark check-mark">✓</span>
            <span v-if="day && !checkinDates.includes(day.fullDate) && isPastDate(day.fullDate)" class="day-mark retro-mark">补</span>
          </div>
        </div>
      </div>
    </van-popup>

    <van-popup
      v-model:show="showGiftPopup"
      round
      position="bottom"
      :style="{ maxHeight: '80vh' }"
    >
      <div class="gift-popup">
        <div class="popup-header">
          <div class="popup-title">
            <span v-if="currentGift">{{ currentGift.icon }} 赠送「{{ currentGift.name }}」</span>
          </div>
          <van-icon name="cross" size="20" @click="showGiftPopup = false" />
        </div>

        <div class="gift-tip" v-if="currentGift">
          赠送后对方魅力值 +{{ currentGift.charmValue }}
        </div>

        <van-search
          v-model="searchKeyword"
          placeholder="输入昵称搜索用户"
          shape="round"
          show-action
          action-text="搜索"
          @search="handleSearchUser"
          @action-click="handleSearchUser"
        />

        <div class="search-results">
          <van-loading v-if="searchLoading" color="#1989fa" style="display: block; text-align: center; padding: 30px 0;">搜索中...</van-loading>
          <div v-else-if="searchResults.length > 0" class="user-list">
            <div
              v-for="user in searchResults"
              :key="user.id"
              class="user-item"
              @click="confirmSendGift(user)"
            >
              <div class="user-avatar">{{ user.avatar }}</div>
              <div class="user-info">
                <div class="user-nickname">{{ user.nickname }}</div>
                <div class="user-meta">
                  <span v-if="user.gender" class="user-gender">{{ user.gender }}</span>
                  <span class="user-charm">魅力 {{ user.charm || 0 }}</span>
                </div>
              </div>
              <van-icon name="arrow" size="16" color="#ccc" />
            </div>
          </div>
          <div v-else-if="searchKeyword && !searchLoading" class="empty-search">
            未找到匹配的用户
          </div>
          <div v-else class="empty-search">
            请输入昵称搜索要赠送的用户
          </div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import {
  getBackpackItems,
  useRetroCard,
  useThrowCard,
  usePickCard,
  getCheckinStatus,
  sendGift,
  searchUsers
} from '../api';

const router = useRouter();
const items = ref([]);
const loading = ref(false);
const showRetroPopup = ref(false);
const showGiftPopup = ref(false);
const currentGift = ref(null);
const searchKeyword = ref('');
const searchResults = ref([]);
const searchLoading = ref(false);
const calYear = ref(new Date().getFullYear());
const calMonth = ref(new Date().getMonth() + 1);
const checkinDates = ref([]);
const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

const todayStr = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

onMounted(() => {
  fetchItems();
});

async function fetchItems() {
  loading.value = true;
  try {
    items.value = await getBackpackItems();
  } catch (error) {
    console.error('获取背包失败:', error);
  } finally {
    loading.value = false;
  }
}

async function fetchCheckinStatus() {
  try {
    const result = await getCheckinStatus(calYear.value, calMonth.value);
    checkinDates.value = result.checkinDates;
  } catch (error) {
    console.error('获取签到状态失败:', error);
  }
}

async function handleUse(item) {
  if (item.quantity <= 0) return;

  if (item.key === 'retro_card') {
    await fetchCheckinStatus();
    showRetroPopup.value = true;
    return;
  }

  try {
    let actionFn;
    let actionName;
    switch (item.key) {
      case 'throw_card':
        actionFn = useThrowCard;
        actionName = '扔瓶卡';
        break;
      case 'pick_card':
        actionFn = usePickCard;
        actionName = '捞瓶卡';
        break;
    }

    await showDialog({
      title: '确认使用',
      message: `确定使用「${actionName}」吗？`,
      showCancelButton: true,
      confirmButtonText: '使用',
      cancelButtonText: '取消'
    });

    const result = await actionFn();
    showToast(result._message || '使用成功');
    await fetchItems();
  } catch (error) {
    if (error.isBusinessError || error.httpMessage) {
      showToast(error.businessMessage || error.httpMessage || '使用失败');
    }
  }
}

async function handleRetroDay(day) {
  if (!day) return;
  if (checkinDates.value.includes(day.fullDate)) {
    showToast('该日期已签到');
    return;
  }
  if (!isPastDate(day.fullDate)) {
    showToast('只能补签过去的日期');
    return;
  }

  try {
    const result = await useRetroCard(day.fullDate);
    showToast(result._message || '补签成功');
    showRetroPopup.value = false;
    await fetchItems();
    await fetchCheckinStatus();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '补签失败');
  }
}

function isPastDate(dateStr) {
  return dateStr < todayStr.value;
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

function goToShop() {
  router.push('/shop');
}

async function handleSendGift(item) {
  currentGift.value = item;
  searchKeyword.value = '';
  searchResults.value = [];
  showGiftPopup.value = true;
}

async function handleSearchUser() {
  if (!searchKeyword.value.trim()) {
    searchResults.value = [];
    return;
  }
  searchLoading.value = true;
  try {
    searchResults.value = await searchUsers(searchKeyword.value.trim());
  } catch (error) {
    console.error('搜索用户失败:', error);
    showToast('搜索失败');
  } finally {
    searchLoading.value = false;
  }
}

async function confirmSendGift(user) {
  if (!currentGift.value) return;
  try {
    await showDialog({
      title: '确认赠送',
      message: `确定将「${currentGift.value.name}」赠送给「${user.nickname}」吗？\n对方将获得魅力值+${currentGift.value.charmValue}`,
      showCancelButton: true,
      confirmButtonText: '赠送',
      cancelButtonText: '取消'
    });

    const result = await sendGift(user.id, currentGift.value.key);
    showToast(result._message || '赠送成功');
    showGiftPopup.value = false;
    await fetchItems();
  } catch (error) {
    if (error.isBusinessError || error.httpMessage) {
      showToast(error.businessMessage || error.httpMessage || '赠送失败');
    }
  }
}
</script>

<style scoped>
.backpack-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 20px;
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
  padding: 16px 20px 20px;
  color: #fff;
}

.page-title {
  font-size: 22px;
  margin: 0;
}

.content-wrapper {
  padding: 0 16px;
  margin-top: 12px;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.item-icon {
  font-size: 40px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.item-desc {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  margin-bottom: 6px;
}

.item-quantity {
  font-size: 13px;
  color: #666;
}

.quantity-num {
  font-weight: bold;
  color: #667eea;
  font-size: 16px;
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

.retro-popup {
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
  cursor: pointer;
}

.calendar-day.empty {
  cursor: default;
}

.calendar-day.today {
  background: #e3f2fd;
}

.calendar-day.checked {
  background: #e8f5e9;
}

.calendar-day.can-retro {
  background: #fff3e0;
}

.calendar-day.can-retro:active {
  background: #ffe0b2;
}

.calendar-day.future {
  opacity: 0.4;
  cursor: default;
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

.retro-mark {
  color: #ff9800;
  font-weight: bold;
  font-size: 10px;
}

.gift-popup {
  padding: 20px;
}

.gift-tip {
  background: #fff0f5;
  color: #ff6b9d;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 16px;
  text-align: center;
}

.search-results {
  max-height: 50vh;
  overflow-y: auto;
  margin-top: 12px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f9f9f9;
  border-radius: 12px;
  cursor: pointer;
}

.user-item:active {
  background: #f0f0f0;
}

.user-avatar {
  font-size: 32px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-nickname {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  margin-bottom: 2px;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #999;
}

.user-gender {
  background: #eef5ff;
  color: #4a9eff;
  padding: 1px 8px;
  border-radius: 8px;
}

.user-charm {
  color: #ff6b9d;
}

.empty-search {
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}
</style>
