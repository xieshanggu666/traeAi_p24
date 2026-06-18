<template>
  <div class="shop-page">
    <div class="header">
      <div class="header-bg"></div>
      <div class="header-content">
        <h2 class="page-title">🛒 道具商城</h2>
      </div>
    </div>

    <div class="content-wrapper">
      <div class="coin-bar" @click="goToWelfare">
        <div class="coin-left">
          <span class="coin-icon">🪙</span>
          <span class="coin-label">漂流币余额</span>
        </div>
        <div class="coin-right">
          <span class="coin-value">{{ userCoins }}</span>
          <van-icon name="arrow" size="14" color="#667eea" />
        </div>
      </div>

      <van-tabs v-model:active="activeCategory" class="category-tabs" animated line-width="24px" scrollable swipeable>
        <van-tab
          v-for="cat in categories"
          :key="cat.key"
          :name="cat.key"
        >
          <template #title>
            <div class="category-tab-title">
              <span class="category-tab-icon">{{ cat.icon }}</span>
              <span class="category-tab-text">{{ cat.name }}</span>
            </div>
          </template>
        </van-tab>
      </van-tabs>

      <div class="product-list" v-if="!loading && (activeCategory === 'function' || activeCategory === 'gift')">
        <div
          v-for="product in filteredProducts"
          :key="product.key"
          class="product-card"
        >
          <div class="product-icon">{{ product.icon }}</div>
          <div class="product-info">
            <div class="product-name">{{ product.name }}</div>
            <div class="product-desc">{{ product.description }}</div>
            <div class="product-meta">
              <span class="product-price">🪙 {{ product.price }}</span>
              <span v-if="product.charmValue" class="product-charm">
                魅力+{{ product.charmValue }}
              </span>
              <span v-if="product.dailyLimit > 0" class="product-limit">
                今日已购 {{ product.todayPurchased }}/{{ product.dailyLimit }}
              </span>
            </div>
          </div>
          <van-button
            size="small"
            round
            type="primary"
            :disabled="!product.canBuy || userCoins < product.price"
            @click="handleBuy(product)"
          >
            {{ product.canBuy ? '购买' : '已售罄' }}
          </van-button>
        </div>
      </div>

      <div class="skin-list" v-if="!loading && activeCategory === 'skin'">
        <div
          v-for="skin in skins"
          :key="skin.id"
          class="skin-card"
          :class="{ 'skin-active': skin.isActive }"
        >
          <div class="skin-preview" :style="getSkinStyle(skin)">
            <div class="skin-emoji">{{ skin.emoji }}</div>
            <div class="skin-rarity" :class="`rarity-${skin.rarity}`">
              {{ getRarityLabel(skin.rarity) }}
            </div>
          </div>
          <div class="skin-info">
            <div class="skin-name-row">
              <span class="skin-name">{{ skin.name }}</span>
              <van-tag
                v-if="skin.isActive"
                type="primary"
                size="medium"
                round
                color="#667eea"
              >使用中</van-tag>
              <van-tag
                v-else-if="skin.owned"
                type="success"
                size="medium"
                round
              >已拥有</van-tag>
            </div>
            <div class="skin-desc">{{ skin.description }}</div>
            <div v-if="skin.owned && skin.expireAt" class="skin-expire">
              有效期至：{{ formatExpireTime(skin.expireAt) }}
            </div>
            <div class="skin-duration-options">
              <div
                v-for="opt in skin.prices"
                :key="opt.key"
                class="duration-option"
                :class="{ active: selectedDuration[skin.id] === opt.key }"
                @click="selectDuration(skin.id, opt.key)"
              >
                <span class="duration-label">{{ opt.label }}</span>
                <span class="duration-price">🪙{{ opt.price }}</span>
              </div>
            </div>
            <div class="skin-actions">
              <van-button
                v-if="skin.owned && !skin.isActive"
                size="small"
                round
                type="warning"
                @click="handleUseSkin(skin)"
              >
                使用皮肤
              </van-button>
              <van-button
                size="small"
                round
                type="primary"
                :disabled="!selectedDuration[skin.id] || userCoins < getSelectedPrice(skin)"
                @click="handleBuySkin(skin)"
              >
                {{ skin.owned ? '续费' : '购买' }}
              </van-button>
            </div>
          </div>
        </div>
      </div>

      <div class="avatar-frame-list" v-if="!loading && activeCategory === 'avatar_frame'">
        <div
          v-for="frame in avatarFrames"
          :key="frame.id"
          class="avatar-frame-card"
          :class="{ 'frame-active': frame.isActive }"
        >
          <div class="frame-preview">
            <div class="frame-avatar" :style="getFrameStyle(frame)">
              <span class="frame-avatar-emoji">😊</span>
            </div>
            <div class="frame-rarity" :class="`rarity-${frame.rarity}`">
              {{ getRarityLabel(frame.rarity) }}
            </div>
          </div>
          <div class="frame-info">
            <div class="frame-name-row">
              <span class="frame-name">{{ frame.name }}</span>
              <van-tag
                v-if="frame.isActive"
                type="primary"
                size="medium"
                round
                color="#667eea"
              >使用中</van-tag>
              <van-tag
                v-else-if="frame.owned"
                type="success"
                size="medium"
                round
              >已拥有</van-tag>
            </div>
            <div class="frame-desc">{{ frame.description }}</div>
            <div class="frame-price-row">
              <span class="frame-price">🪙 {{ frame.price }}</span>
              <span class="frame-permanent">永久</span>
            </div>
            <div class="frame-actions">
              <van-button
                v-if="frame.owned && !frame.isActive"
                size="small"
                round
                type="warning"
                @click="handleUseAvatarFrame(frame)"
              >
                使用
              </van-button>
              <van-button
                v-if="!frame.owned"
                size="small"
                round
                type="primary"
                :disabled="userCoins < frame.price"
                @click="handleBuyAvatarFrame(frame)"
              >
                购买
              </van-button>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-skin-list" v-if="!loading && activeCategory === 'chat_skin'">
        <div
          v-for="skin in chatSkins"
          :key="skin.id"
          class="chat-skin-card"
          :class="{ 'chat-skin-active': skin.isActive }"
        >
          <div class="chat-skin-preview" :style="getChatSkinPreviewStyle(skin)">
            <div class="chat-skin-bubble mine" :style="getChatBubbleMineStyle(skin)">
              <span>你好</span>
            </div>
            <div class="chat-skin-bubble other" :style="getChatBubbleOtherStyle(skin)">
              <span>嗨~</span>
            </div>
            <div class="chat-skin-rarity" :class="`rarity-${skin.rarity}`">
              {{ getRarityLabel(skin.rarity) }}
            </div>
          </div>
          <div class="chat-skin-info">
            <div class="chat-skin-name-row">
              <span class="chat-skin-name">{{ skin.name }}</span>
              <van-tag
                v-if="skin.isActive"
                type="primary"
                size="medium"
                round
                color="#667eea"
              >使用中</van-tag>
              <van-tag
                v-else-if="skin.owned"
                type="success"
                size="medium"
                round
              >已拥有</van-tag>
            </div>
            <div class="chat-skin-desc">{{ skin.description }}</div>
            <div class="chat-skin-price-row">
              <span class="chat-skin-price">🪙 {{ skin.price }}</span>
              <span class="chat-skin-permanent">永久</span>
            </div>
            <div class="chat-skin-actions">
              <van-button
                v-if="skin.owned && !skin.isActive"
                size="small"
                round
                type="warning"
                @click="handleUseChatSkin(skin)"
              >
                使用
              </van-button>
              <van-button
                v-if="!skin.owned"
                size="small"
                round
                type="primary"
                :disabled="userCoins < skin.price"
                @click="handleBuyChatSkin(skin)"
              >
                购买
              </van-button>
            </div>
          </div>
        </div>
      </div>

      <div class="loading-state" v-if="loading">
        <van-loading color="#667eea" size="24px">加载中...</van-loading>
      </div>

      <div class="empty-state" v-if="filteredProducts.length === 0 && !loading && (activeCategory === 'function' || activeCategory === 'gift')">
        <div class="empty-icon">📦</div>
        <div class="empty-text">暂无商品</div>
      </div>

      <div class="backpack-entry" @click="goToBackpack">
        <van-icon name="bag-o" size="20" color="#667eea" />
        <span>我的背包</span>
        <van-icon name="arrow" size="16" color="#ccc" />
      </div>
    </div>

    <van-tabbar v-model="active" active-color="#1989fa">
      <van-tabbar-item name="home" icon="home-o" @click="goToHome">首页</van-tabbar-item>
      <van-tabbar-item name="messages" icon="chat-o" @click="goToMessages">消息</van-tabbar-item>
      <van-tabbar-item name="welfare" icon="gift-o" @click="goToWelfare">福利</van-tabbar-item>
      <van-tabbar-item name="shop" icon="shop-o">商城</van-tabbar-item>
      <van-tabbar-item name="my" icon="user-o" @click="goToMy">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { getShopProducts, buyProduct, getWelfareInfo, getSkins, buySkin, useSkin, getAvatarFrames, buyAvatarFrame, useAvatarFrame, getChatSkins, buyChatSkin, useChatSkin } from '../api';

const router = useRouter();
const active = ref('shop');
const activeCategory = ref('function');
const products = ref([]);
const categories = ref([]);
const skins = ref([]);
const avatarFrames = ref([]);
const chatSkins = ref([]);
const userCoins = ref(0);
const loading = ref(false);
const selectedDuration = reactive({});

const filteredProducts = computed(() => {
  return products.value.filter(p => p.category === activeCategory.value);
});

onMounted(() => {
  fetchAll();
});

async function fetchAll() {
  loading.value = true;
  try {
    await Promise.all([fetchProducts(), fetchSkins(), fetchAvatarFrames(), fetchChatSkins(), fetchCoins()]);
  } finally {
    loading.value = false;
  }
}

async function fetchProducts() {
  try {
    const result = await getShopProducts();
    products.value = result.products;
    categories.value = [
      { key: 'function', name: '功能道具', icon: '🎯' },
      { key: 'gift', name: '礼物', icon: '🎁' },
      { key: 'skin', name: '漂流瓶皮肤', icon: '✨' },
      { key: 'avatar_frame', name: '头像框', icon: '🖼️' },
      { key: 'chat_skin', name: '聊天皮肤', icon: '💬' }
    ];
  } catch (error) {
    console.error('获取商品列表失败:', error);
  }
}

async function fetchSkins() {
  try {
    const result = await getSkins();
    skins.value = result.skins;
    skins.value.forEach(skin => {
      if (!selectedDuration[skin.id]) {
        selectedDuration[skin.id] = skin.prices[1]?.key || '1d';
      }
    });
  } catch (error) {
    console.error('获取皮肤列表失败:', error);
    skins.value = [];
  }
}

async function fetchCoins() {
  try {
    const info = await getWelfareInfo();
    userCoins.value = info.totalCoins;
  } catch (error) {
    console.error('获取漂流币失败:', error);
  }
}

function getSkinStyle(skin) {
  return {
    background: `linear-gradient(135deg, ${skin.gradient_from} 0%, ${skin.gradient_to} 100%)`,
    borderColor: skin.border_color,
    boxShadow: `0 4px 12px ${skin.border_color}40`
  };
}

function getRarityLabel(rarity) {
  const map = {
    common: '普通',
    rare: '稀有',
    legendary: '传说'
  };
  return map[rarity] || '普通';
}

function formatExpireTime(time) {
  if (!time) return '';
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function selectDuration(skinId, duration) {
  selectedDuration[skinId] = duration;
}

function getSelectedPrice(skin) {
  const duration = selectedDuration[skin.id];
  const opt = skin.prices?.find(p => p.key === duration);
  return opt ? opt.price : 0;
}

async function handleBuy(product) {
  try {
    await showDialog({
      title: '确认购买',
      message: `确定花费 ${product.price} 漂流币购买「${product.name}」吗？`,
      showCancelButton: true,
      confirmButtonText: '购买',
      cancelButtonText: '取消'
    });

    const result = await buyProduct(product.key);
    showToast(result._message || '购买成功');
    await fetchProducts();
    await fetchCoins();
  } catch (error) {
    if (error.isBusinessError || error.httpMessage) {
      showToast(error.businessMessage || error.httpMessage || '购买失败');
    }
  }
}

async function handleBuySkin(skin) {
  const duration = selectedDuration[skin.id];
  if (!duration) {
    showToast('请先选择时长');
    return;
  }
  const price = getSelectedPrice(skin);
  const durationLabel = skin.prices.find(p => p.key === duration)?.label || '';

  try {
    await showDialog({
      title: '确认购买',
      message: `确定花费 ${price} 漂流币购买「${skin.name}」皮肤(${durationLabel})吗？`,
      showCancelButton: true,
      confirmButtonText: '购买',
      cancelButtonText: '取消'
    });

    const result = await buySkin(skin.id, duration);
    showToast(result._message || '购买成功');
    await fetchSkins();
    await fetchCoins();
  } catch (error) {
    if (error.isBusinessError || error.httpMessage) {
      showToast(error.businessMessage || error.httpMessage || '购买失败');
    }
  }
}

async function handleUseSkin(skin) {
  try {
    await useSkin(skin.id);
    showToast(`已切换至「${skin.name}」皮肤`);
    await fetchSkins();
  } catch (error) {
    if (error.isBusinessError || error.httpMessage) {
      showToast(error.businessMessage || error.httpMessage || '切换失败');
    }
  }
}

async function fetchAvatarFrames() {
  try {
    const result = await getAvatarFrames();
    avatarFrames.value = result.frames;
  } catch (error) {
    console.error('获取头像框列表失败:', error);
    avatarFrames.value = [];
  }
}

async function fetchChatSkins() {
  try {
    const result = await getChatSkins();
    chatSkins.value = result.skins;
  } catch (error) {
    console.error('获取聊天皮肤列表失败:', error);
    chatSkins.value = [];
  }
}

function getFrameStyle(frame) {
  return {
    borderColor: frame.border_color,
    boxShadow: `0 0 12px ${frame.shadow_color || frame.border_color}60`,
    background: `linear-gradient(135deg, ${frame.gradient_from} 0%, ${frame.gradient_to} 100%)`
  };
}

function getChatSkinPreviewStyle(skin) {
  return {
    backgroundColor: skin.bg_color
  };
}

function getChatBubbleMineStyle(skin) {
  return {
    backgroundColor: skin.bubble_bg_mine,
    color: skin.text_color_mine
  };
}

function getChatBubbleOtherStyle(skin) {
  return {
    backgroundColor: skin.bubble_bg_other,
    color: skin.text_color_other
  };
}

async function handleBuyAvatarFrame(frame) {
  try {
    await showDialog({
      title: '确认购买',
      message: `确定花费 ${frame.price} 漂流币购买「${frame.name}」头像框吗？\n购买后永久有效`,
      showCancelButton: true,
      confirmButtonText: '购买',
      cancelButtonText: '取消'
    });

    const result = await buyAvatarFrame(frame.id);
    showToast(result._message || '购买成功');
    await fetchAvatarFrames();
    await fetchCoins();
  } catch (error) {
    if (error.isBusinessError || error.httpMessage) {
      showToast(error.businessMessage || error.httpMessage || '购买失败');
    }
  }
}

async function handleUseAvatarFrame(frame) {
  try {
    await useAvatarFrame(frame.id);
    showToast(`已切换至「${frame.name}」头像框`);
    await fetchAvatarFrames();
  } catch (error) {
    if (error.isBusinessError || error.httpMessage) {
      showToast(error.businessMessage || error.httpMessage || '切换失败');
    }
  }
}

async function handleBuyChatSkin(skin) {
  try {
    await showDialog({
      title: '确认购买',
      message: `确定花费 ${skin.price} 漂流币购买「${skin.name}」聊天皮肤吗？\n购买后永久有效`,
      showCancelButton: true,
      confirmButtonText: '购买',
      cancelButtonText: '取消'
    });

    const result = await buyChatSkin(skin.id);
    showToast(result._message || '购买成功');
    await fetchChatSkins();
    await fetchCoins();
  } catch (error) {
    if (error.isBusinessError || error.httpMessage) {
      showToast(error.businessMessage || error.httpMessage || '购买失败');
    }
  }
}

async function handleUseChatSkin(skin) {
  try {
    await useChatSkin(skin.id);
    showToast(`已切换至「${skin.name}」聊天皮肤`);
    await fetchChatSkins();
  } catch (error) {
    if (error.isBusinessError || error.httpMessage) {
      showToast(error.businessMessage || error.httpMessage || '切换失败');
    }
  }
}

function goToHome() { router.push('/'); }
function goToWelfare() { router.push('/welfare'); }
function goToMy() { router.push('/my'); }
function goToMessages() { router.push('/messages'); }
function goToBackpack() { router.push('/backpack'); }
</script>

<style scoped>
.shop-page {
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
  padding: 16px 20px 20px;
  color: #fff;
}

.page-title {
  font-size: 22px;
  margin: 0;
}

.content-wrapper {
  padding: 0 16px;
}

.coin-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  padding: 14px 18px;
  margin-top: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.coin-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coin-icon {
  font-size: 20px;
}

.coin-label {
  font-size: 14px;
  color: #666;
}

.coin-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.coin-value {
  font-size: 18px;
  font-weight: bold;
  color: #667eea;
}

.category-tabs {
  margin-top: 12px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.category-tabs :deep(.van-tabs__wrap) {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.category-tabs :deep(.van-tabs__nav) {
  display: flex;
}

.category-tabs :deep(.van-tab) {
  font-size: 14px;
  font-weight: 500;
  flex: 0 0 auto;
  padding: 0 14px;
}

.category-tabs :deep(.van-tab--active) {
  font-weight: 600;
}

.category-tab-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.category-tab-icon {
  font-size: 16px;
  line-height: 1;
}

.category-tab-text {
  font-size: 14px;
  line-height: 1;
}

.product-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.product-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.product-icon {
  font-size: 40px;
  flex-shrink: 0;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.product-desc {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.product-price {
  font-size: 14px;
  font-weight: bold;
  color: #ff9800;
}

.product-charm {
  font-size: 11px;
  color: #ff6b9d;
  background: #fff0f5;
  padding: 1px 8px;
  border-radius: 8px;
}

.product-limit {
  font-size: 11px;
  color: #999;
  background: #f5f5f5;
  padding: 1px 8px;
  border-radius: 8px;
}

.skin-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.skin-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  display: flex;
  gap: 14px;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.skin-card.skin-active {
  border-color: #667eea;
  background: linear-gradient(135deg, #f8f9ff 0%, #fff5fb 100%);
}

.skin-preview {
  width: 90px;
  height: 120px;
  border-radius: 14px;
  border: 3px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}

.skin-emoji {
  font-size: 48px;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.2));
  animation: skinFloat 3s ease-in-out infinite;
}

@keyframes skinFloat {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-6px) rotate(5deg); }
}

.skin-rarity {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #666;
  font-weight: bold;
}

.skin-rarity.rarity-rare {
  background: linear-gradient(135deg, #ffd700, #ffb700);
  color: #fff;
}

.skin-rarity.rarity-legendary {
  background: linear-gradient(135deg, #ff6b6b, #ee5a6f, #c44569);
  color: #fff;
  box-shadow: 0 0 8px rgba(238, 90, 111, 0.5);
}

.skin-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.skin-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.skin-name {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.skin-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.4;
  margin-bottom: 8px;
}

.skin-expire {
  font-size: 11px;
  color: #667eea;
  margin-bottom: 10px;
}

.skin-duration-options {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.duration-option {
  padding: 6px 10px;
  background: #f5f5f5;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 58px;
}

.duration-option:active {
  transform: scale(0.97);
}

.duration-option.active {
  background: linear-gradient(135deg, #eef0ff, #fff0f5);
  border-color: #667eea;
}

.duration-label {
  font-size: 11px;
  color: #666;
}

.duration-option.active .duration-label {
  color: #667eea;
  font-weight: 500;
}

.duration-price {
  font-size: 12px;
  color: #ff9800;
  font-weight: bold;
}

.skin-actions {
  display: flex;
  gap: 10px;
  margin-top: auto;
}

.skin-actions .van-button {
  flex: 1;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 20px;
  color: #999;
  font-size: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 10px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
}

.backpack-entry {
  margin-top: 20px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #333;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.backpack-entry span {
  flex: 1;
  font-size: 15px;
}

.avatar-frame-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.avatar-frame-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  display: flex;
  gap: 14px;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.avatar-frame-card.frame-active {
  border-color: #667eea;
  background: linear-gradient(135deg, #f8f9ff 0%, #fff5fb 100%);
}

.frame-preview {
  width: 90px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}

.frame-avatar {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: 4px solid;
  display: flex;
  align-items: center;
  justify-content: center;
}

.frame-avatar-emoji {
  font-size: 36px;
}

.frame-rarity {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #666;
  font-weight: bold;
}

.frame-rarity.rarity-rare {
  background: linear-gradient(135deg, #ffd700, #ffb700);
  color: #fff;
}

.frame-rarity.rarity-legendary {
  background: linear-gradient(135deg, #ff6b6b, #ee5a6f, #c44569);
  color: #fff;
  box-shadow: 0 0 8px rgba(238, 90, 111, 0.5);
}

.frame-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.frame-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.frame-name {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.frame-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.4;
  margin-bottom: 8px;
}

.frame-price-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.frame-price {
  font-size: 16px;
  font-weight: bold;
  color: #ff9800;
}

.frame-permanent {
  font-size: 11px;
  color: #07c160;
  background: #f6ffed;
  padding: 2px 8px;
  border-radius: 8px;
}

.frame-actions {
  display: flex;
  gap: 10px;
  margin-top: auto;
}

.frame-actions .van-button {
  flex: 1;
}

.chat-skin-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chat-skin-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  display: flex;
  gap: 14px;
  border: 2px solid transparent;
  transition: all 0.3s;
}

.chat-skin-card.chat-skin-active {
  border-color: #667eea;
  background: linear-gradient(135deg, #f8f9ff 0%, #fff5fb 100%);
}

.chat-skin-preview {
  width: 100px;
  height: 100px;
  border-radius: 12px;
  flex-shrink: 0;
  position: relative;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #eee;
}

.chat-skin-bubble {
  max-width: 70%;
  padding: 6px 10px;
  border-radius: 12px;
  font-size: 10px;
  line-height: 1.4;
}

.chat-skin-bubble.mine {
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

.chat-skin-bubble.other {
  align-self: flex-start;
  border-bottom-left-radius: 4px;
}

.chat-skin-rarity {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #666;
  font-weight: bold;
}

.chat-skin-rarity.rarity-rare {
  background: linear-gradient(135deg, #ffd700, #ffb700);
  color: #fff;
}

.chat-skin-rarity.rarity-legendary {
  background: linear-gradient(135deg, #ff6b6b, #ee5a6f, #c44569);
  color: #fff;
  box-shadow: 0 0 6px rgba(238, 90, 111, 0.5);
}

.chat-skin-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.chat-skin-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.chat-skin-name {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.chat-skin-desc {
  font-size: 12px;
  color: #888;
  line-height: 1.4;
  margin-bottom: 8px;
}

.chat-skin-price-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.chat-skin-price {
  font-size: 16px;
  font-weight: bold;
  color: #ff9800;
}

.chat-skin-permanent {
  font-size: 11px;
  color: #07c160;
  background: #f6ffed;
  padding: 2px 8px;
  border-radius: 8px;
}

.chat-skin-actions {
  display: flex;
  gap: 10px;
  margin-top: auto;
}

.chat-skin-actions .van-button {
  flex: 1;
}
</style>
