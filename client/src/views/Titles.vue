<template>
  <div class="titles-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="header-content">
        <div class="back-btn" @click="goBack">
          <van-icon name="arrow-left" size="20" color="#fff" />
        </div>
        <h2 class="page-title">🏆 我的称号</h2>
        <div class="header-right"></div>
      </div>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="content">
        <div class="equipped-section" v-if="equippedTitle">
          <div class="section-title">当前佩戴</div>
          <div class="equipped-card" :style="cardStyle(equippedTitle)" @click="showTitleDetail(equippedTitle)">
            <div class="title-glow" :style="glowStyle(equippedTitle)"></div>
            <div class="equipped-icon">{{ equippedTitle.icon }}</div>
            <div class="equipped-info">
              <div class="equipped-name">{{ equippedTitle.name }}</div>
              <div class="equipped-desc">{{ equippedTitle.description }}</div>
              <div class="equipped-validity" v-if="equippedTitle.validity_type === 'duration'">
                有效期至：{{ formatDate(equippedTitle.expires_at) }}
              </div>
              <div class="equipped-validity permanent" v-else>
                永久有效
              </div>
            </div>
            <div class="equipped-badge">佩戴中</div>
          </div>
        </div>

        <div class="empty-state" v-if="myTitles.length === 0 && !loading">
          <div class="empty-icon">🏅</div>
          <div class="empty-text">还没有获得任何称号</div>
          <div class="empty-desc">完成任务、上榜排行都可以获得称号哦</div>
          <van-button type="primary" round @click="goToWelfare" class="go-btn">
            去做任务
          </van-button>
        </div>

        <div class="titles-section" v-if="myTitles.length > 0">
          <div class="section-header">
            <div class="section-title">我的称号 ({{ myTitles.length }})</div>
          </div>
          
          <div class="titles-grid">
            <div 
              v-for="title in myTitles" 
              :key="title.title_id"
              class="title-card"
              :class="{ 
                'is-equipped': title.is_equipped,
                'is-expired': title.is_expired,
                [`rarity-${title.rarity}`]: true 
              }"
              @click="showTitleDetail(title)"
            >
              <div class="card-glow" :style="glowStyle(title)"></div>
              <div class="title-icon">{{ title.icon }}</div>
              <div class="title-name">{{ title.name }}</div>
              <div class="title-rarity">{{ getRarityText(title.rarity) }}</div>
              <div class="title-status" v-if="title.is_equipped">已佩戴</div>
              <div class="title-status expired" v-else-if="title.is_expired">已过期</div>
            </div>
          </div>
        </div>

        <div class="all-titles-section">
          <div class="section-header">
            <div class="section-title">全部称号</div>
            <div class="section-subtitle">共 {{ allTitles.length }} 个称号</div>
          </div>
          
          <div class="titles-list">
            <div 
              v-for="title in allTitles" 
              :key="title.id"
              class="title-item"
              :class="{ 
                'has-title': hasTitle(title.id),
                'is-equipped': isEquipped(title.id),
                [`rarity-${title.rarity}`]: true 
              }"
              @click="showAllTitleDetail(title)"
            >
              <div class="item-icon" :class="{ 'locked': !hasTitle(title.id) }">
                {{ hasTitle(title.id) ? title.icon : '🔒' }}
              </div>
              <div class="item-info">
                <div class="item-name">{{ title.name }}</div>
                <div class="item-desc">{{ title.description }}</div>
                <div class="item-condition" v-if="title.condition_json">
                  {{ getConditionText(title.condition_json) }}
                </div>
              </div>
              <div class="item-action">
                <van-button 
                  v-if="hasTitle(title.id) && !isEquipped(title.id) && !isTitleExpired(title.id)"
                  size="mini" 
                  type="primary" 
                  round
                  @click.stop="handleEquip(title.id)"
                >
                  佩戴
                </van-button>
                <span class="equipped-tag" v-else-if="isEquipped(title.id)">佩戴中</span>
                <span class="locked-tag" v-else>未获得</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </van-pull-refresh>

    <van-loading v-if="loading" color="#1989fa" style="margin-top: 40px; display: block; text-align: center;">
      加载中...
    </van-loading>

    <van-popup 
      v-model:show="showDetail" 
      round 
      position="bottom"
      :style="{ height: '70%' }"
    >
      <div class="detail-popup" v-if="selectedTitle">
        <div class="detail-header" :style="headerStyle(selectedTitle)">
          <div class="detail-glow" :style="glowStyle(selectedTitle)"></div>
          <div class="detail-icon">{{ selectedTitle.icon || selectedTitle.title_icon }}</div>
          <div class="detail-name">{{ selectedTitle.name }}</div>
          <div class="detail-rarity">{{ getRarityText(selectedTitle.rarity) }}</div>
        </div>
        
        <div class="detail-content">
          <div class="detail-section">
            <div class="detail-label">称号描述</div>
            <div class="detail-desc">{{ selectedTitle.description }}</div>
          </div>
          
          <div class="detail-section">
            <div class="detail-label">获取条件</div>
            <div class="detail-condition">
              {{ selectedTitle.condition_json ? getConditionText(selectedTitle.condition_json) : '特殊活动获得' }}
            </div>
          </div>
          
          <div class="detail-section" v-if="selectedTitle.validity_type">
            <div class="detail-label">有效期</div>
            <div class="detail-validity">
              <span v-if="selectedTitle.validity_type === 'permanent'">永久有效</span>
              <span v-else>{{ selectedTitle.validity_value }} {{ getValidityUnitText(selectedTitle.validity_unit) }}</span>
            </div>
          </div>
          
          <div class="detail-section" v-if="selectedTitle.obtained_at">
            <div class="detail-label">获得时间</div>
            <div class="detail-time">{{ formatDate(selectedTitle.obtained_at) }}</div>
          </div>
          
          <div class="detail-section" v-if="selectedTitle.expires_at">
            <div class="detail-label">到期时间</div>
            <div class="detail-expire">{{ formatDate(selectedTitle.expires_at) }}</div>
          </div>
        </div>
        
        <div class="detail-actions">
          <van-button 
            v-if="!hasTitle(selectedTitle.id || selectedTitle.title_id)"
            type="default" 
            block 
            round
            disabled
          >
            未获得
          </van-button>
          <van-button 
            v-else-if="isEquipped(selectedTitle.id || selectedTitle.title_id)"
            type="warning" 
            block 
            round
            @click="handleUnequip"
          >
            卸下称号
          </van-button>
          <van-button 
            v-else-if="isTitleExpired(selectedTitle.id || selectedTitle.title_id)"
            type="default" 
            block 
            round
            disabled
          >
            已过期
          </van-button>
          <van-button 
            v-else
            type="primary" 
            block 
            round
            @click="handleEquipFromDetail"
          >
            立即佩戴
          </van-button>
        </div>
      </div>
    </van-popup>

    <van-tabbar v-model="activeBottom" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o" @click="goToHome">首页</van-tabbar-item>
      <van-tabbar-item name="messages" icon="chat-o" @click="goToMessages">消息</van-tabbar-item>
      <van-tabbar-item name="welfare" icon="gift-o" @click="goToWelfare">福利</van-tabbar-item>
      <van-tabbar-item name="shop" icon="shop-o" @click="goToShop">商城</van-tabbar-item>
      <van-tabbar-item name="my" icon="user-o" @click="goToMy">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { 
  getTitles, 
  getMyTitles, 
  equipTitle as apiEquipTitle, 
  unequipTitle as apiUnequipTitle 
} from '../api';

const router = useRouter();
const activeBottom = ref('my');
const loading = ref(false);
const refreshing = ref(false);
const allTitles = ref([]);
const myTitles = ref([]);
const equippedTitle = ref(null);
const showDetail = ref(false);
const selectedTitle = ref(null);

function hasTitle(titleId) {
  return myTitles.value.some(t => t.title_id === titleId && !t.is_expired);
}

function isEquipped(titleId) {
  return myTitles.value.some(t => t.title_id === titleId && t.is_equipped && !t.is_expired);
}

function isTitleExpired(titleId) {
  const title = myTitles.value.find(t => t.title_id === titleId);
  return title ? title.is_expired : false;
}

function cardStyle(title) {
  return {
    background: title.bg_gradient || title.bgGradient,
    borderColor: title.color
  };
}

function headerStyle(title) {
  return {
    background: title.bg_gradient || title.bgGradient
  };
}

function glowStyle(title) {
  return {
    background: `radial-gradient(circle, ${title.color || '#fff'}40 0%, transparent 70%)`
  };
}

function getRarityText(rarity) {
  const map = {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说'
  };
  return map[rarity] || rarity;
}

function getConditionText(condition) {
  if (typeof condition === 'string') {
    try {
      condition = JSON.parse(condition);
    } catch {
      return '特殊活动获得';
    }
  }
  
  switch (condition.type) {
    case 'continuous_checkin':
      return `连续签到 ${condition.value} 天`;
    case 'total_messages':
      return `累计发送 ${condition.value} 条消息`;
    case 'total_bottles_thrown':
      return `累计扔出 ${condition.value} 个漂流瓶`;
    case 'total_bottles_picked':
      return `累计捞起 ${condition.value} 个漂流瓶`;
    case 'all_once_tasks':
      return '完成所有一次性任务';
    default:
      return '特殊活动获得';
  }
}

function getValidityUnitText(unit) {
  const map = {
    hour: '小时',
    day: '天',
    month: '个月'
  };
  return map[unit] || unit;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function fetchData() {
  loading.value = true;
  try {
    const [allResult, myResult] = await Promise.all([
      getTitles(),
      getMyTitles()
    ]);
    allTitles.value = allResult || [];
    myTitles.value = myResult?.titles || [];
    equippedTitle.value = myResult?.equipped || null;
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  try {
    const [allResult, myResult] = await Promise.all([
      getTitles(),
      getMyTitles()
    ]);
    allTitles.value = allResult || [];
    myTitles.value = myResult?.titles || [];
    equippedTitle.value = myResult?.equipped || null;
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '刷新失败');
  } finally {
    refreshing.value = false;
  }
}

function showTitleDetail(title) {
  selectedTitle.value = title;
  showDetail.value = true;
}

function showAllTitleDetail(title) {
  const userTitle = myTitles.value.find(t => t.title_id === title.id);
  if (userTitle) {
    selectedTitle.value = userTitle;
  } else {
    selectedTitle.value = { ...title, title_id: title.id };
  }
  showDetail.value = true;
}

async function handleEquip(titleId) {
  try {
    await showDialog({
      title: '佩戴称号',
      message: '确定要佩戴这个称号吗？',
      showCancelButton: true,
      confirmButtonText: '佩戴',
      cancelButtonText: '取消'
    });
    
    const result = await apiEquipTitle(titleId);
    showToast('佩戴成功');
    
    myTitles.value.forEach(t => {
      t.is_equipped = t.title_id === titleId;
    });
    
    const title = allTitles.value.find(t => t.id === titleId);
    const myTitle = myTitles.value.find(t => t.title_id === titleId);
    equippedTitle.value = myTitle || title;
    
    showDetail.value = false;
  } catch {
    // cancelled
  }
}

async function handleUnequip() {
  if (!selectedTitle.value) return;
  
  const titleId = selectedTitle.value.id || selectedTitle.value.title_id;
  
  try {
    await showDialog({
      title: '卸下称号',
      message: '确定要卸下这个称号吗？',
      showCancelButton: true,
      confirmButtonText: '卸下',
      cancelButtonText: '取消'
    });
    
    await apiUnequipTitle(titleId);
    showToast('卸下成功');
    
    myTitles.value.forEach(t => {
      if (t.title_id === titleId) {
        t.is_equipped = false;
      }
    });
    
    equippedTitle.value = null;
    showDetail.value = false;
  } catch {
    // cancelled
  }
}

function handleEquipFromDetail() {
  if (!selectedTitle.value) return;
  const titleId = selectedTitle.value.id || selectedTitle.value.title_id;
  handleEquip(titleId);
}

function goBack() {
  router.back();
}

function goToHome() { router.push('/'); }
function goToMessages() { router.push('/messages'); }
function goToWelfare() { router.push('/welfare'); }
function goToShop() { router.push('/shop'); }
function goToMy() { router.push('/my'); }

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.titles-page {
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
  height: 120px;
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

.back-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.header-right {
  width: 36px;
}

.page-title {
  font-size: 20px;
  margin: 0;
}

.content {
  padding: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid #667eea;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-subtitle {
  font-size: 12px;
  color: #999;
}

.equipped-section {
  margin-bottom: 24px;
}

.equipped-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  color: #fff;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.2s;
}

.equipped-card:active {
  transform: scale(0.98);
}

.title-glow {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  opacity: 0.3;
  pointer-events: none;
}

.equipped-icon {
  font-size: 48px;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.equipped-info {
  flex: 1;
  min-width: 0;
}

.equipped-name {
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 6px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.equipped-desc {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.equipped-validity {
  font-size: 12px;
  opacity: 0.8;
}

.equipped-validity.permanent {
  color: #fff;
  font-weight: 600;
}

.equipped-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 64px;
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
  font-size: 13px;
  margin-bottom: 24px;
}

.go-btn {
  width: 140px;
}

.titles-section {
  margin-bottom: 24px;
}

.titles-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.title-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  background: #fff;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
  border: 2px solid transparent;
}

.title-card:active {
  transform: scale(0.96);
}

.card-glow {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 60px;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s;
}

.title-card.rarity-legendary .card-glow { opacity: 0.5; }
.title-card.rarity-epic .card-glow { opacity: 0.3; }

.title-card.is-equipped {
  border-color: #1989fa;
}

.title-card.is-expired {
  opacity: 0.5;
  filter: grayscale(0.8);
}

.title-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.title-name {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  text-align: center;
}

.title-rarity {
  font-size: 10px;
  color: #999;
}

.title-status {
  position: absolute;
  top: 6px;
  right: 6px;
  padding: 2px 6px;
  background: #1989fa;
  color: #fff;
  font-size: 10px;
  border-radius: 8px;
}

.title-status.expired {
  background: #999;
}

.all-titles-section {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
}

.titles-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.title-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.title-item:active {
  background: #f0f0f0;
}

.title-item.has-title {
  background: #fff;
  border: 1px solid #eee;
}

.title-item.is-equipped {
  background: linear-gradient(135deg, #e8f4ff 0%, #f0e8ff 100%);
  border-color: #667eea40;
}

.item-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: #fff;
  border-radius: 12px;
  flex-shrink: 0;
  transition: all 0.3s;
}

.item-icon.locked {
  filter: grayscale(1);
  opacity: 0.5;
  background: #f5f5f5;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.item-desc {
  font-size: 12px;
  color: #999;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-condition {
  font-size: 11px;
  color: #667eea;
}

.item-action {
  flex-shrink: 0;
}

.equipped-tag {
  font-size: 12px;
  color: #1989fa;
  font-weight: 600;
}

.locked-tag {
  font-size: 12px;
  color: #ccc;
}

.detail-popup {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 20px;
  color: #fff;
  overflow: hidden;
}

.detail-glow {
  position: absolute;
  top: -50%;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  opacity: 0.3;
}

.detail-icon {
  font-size: 72px;
  margin-bottom: 12px;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2));
  animation: float 3s ease-in-out infinite;
}

.detail-name {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 6px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.detail-rarity {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  font-size: 13px;
  backdrop-filter: blur(4px);
}

.detail-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 6px;
}

.detail-desc {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
}

.detail-condition {
  font-size: 14px;
  color: #667eea;
  font-weight: 500;
}

.detail-validity {
  font-size: 14px;
  color: #07c160;
  font-weight: 500;
}

.detail-time, .detail-expire {
  font-size: 14px;
  color: #333;
}

.detail-actions {
  padding: 16px 20px 24px;
  border-top: 1px solid #f0f0f0;
}
</style>
