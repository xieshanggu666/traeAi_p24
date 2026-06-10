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

      <div class="product-list">
        <div
          v-for="product in products"
          :key="product.key"
          class="product-card"
        >
          <div class="product-icon">{{ product.icon }}</div>
          <div class="product-info">
            <div class="product-name">{{ product.name }}</div>
            <div class="product-desc">{{ product.description }}</div>
            <div class="product-meta">
              <span class="product-price">🪙 {{ product.price }}</span>
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
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { getShopProducts, buyProduct, getWelfareInfo } from '../api';

const router = useRouter();
const active = ref('shop');
const products = ref([]);
const userCoins = ref(0);

onMounted(() => {
  fetchProducts();
  fetchCoins();
});

async function fetchProducts() {
  try {
    products.value = await getShopProducts();
  } catch (error) {
    console.error('获取商品列表失败:', error);
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
}

.product-price {
  font-size: 14px;
  font-weight: bold;
  color: #ff9800;
}

.product-limit {
  font-size: 11px;
  color: #999;
  background: #f5f5f5;
  padding: 1px 8px;
  border-radius: 8px;
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
</style>
