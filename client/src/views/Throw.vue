<template>
  <div class="page-container">
    <div class="wave-bg">
      <div class="water-layer water-layer-1"></div>
      <div class="water-layer water-layer-2"></div>
    </div>
    <div class="content-wrapper">
      <div class="nav-bar">
        <van-icon name="arrow-left" size="24" color="#fff" @click="goBack" />
        <span class="nav-title">扔瓶子</span>
        <div class="limit-badge" :class="{ 'limit-reached': throwRemaining <= 0 }">
          今日剩余: {{ throwRemaining }}次
        </div>
      </div>

      <div class="throw-animation-container">
        <div class="ocean-scene">
          <div class="water-surface-throw">
            <div class="wave-throw"></div>
          </div>
          <div class="bottle-display" :class="{ 'bottle-throwing': isThrowing, 'bottle-sinked': showSuccess }">
            <span class="bottle-emoji">{{ isThrowing ? '🍾' : showSuccess ? '🌊' : '🍾' }}</span>
          </div>
          <div class="splash-effect" v-if="showSplash">
            <div class="splash-main"></div>
            <div class="splash-dot d1"></div>
            <div class="splash-dot d2"></div>
            <div class="splash-dot d3"></div>
            <div class="splash-dot d4"></div>
          </div>
        </div>
      </div>

      <div class="limit-warning" v-if="throwRemaining <= 0 && !showSuccess">
        <van-icon name="warning-o" size="16" />
        <span>今日扔瓶子次数已达上限(20次)，明天再来吧</span>
      </div>

      <div class="input-card" v-if="!showSuccess">
        <div class="input-header">
          <span class="input-icon">💭</span>
          <span class="input-title">写下你想说的话</span>
        </div>
        <textarea
          v-model="content"
          class="bottle-input"
          placeholder="在这里写下你的心情、故事或者想说的话..."
          maxlength="500"
          :disabled="isThrowing || throwRemaining <= 0"
        ></textarea>
        <div class="char-count">{{ content.length }}/500</div>

        <div class="quick-messages">
          <div class="quick-messages-label">
            <van-icon name="chat-o" size="14" />
            <span>快捷语句</span>
          </div>
          <div class="quick-tags">
            <div 
              class="quick-tag" 
              v-for="(msg, index) in quickMessages" 
              :key="index"
              @click="useQuickMessage(msg)"
            >
              {{ msg }}
            </div>
          </div>
        </div>

        <van-button
          type="primary"
          block
          size="large"
          class="throw-btn"
          :disabled="!canThrow || isThrowing || throwRemaining <= 0"
          :loading="isThrowing"
          loading-text="扔出中..."
          @click="throwBottle"
        >
          🌊 扔向大海
        </van-button>
        <div class="throw-tip" v-if="throwRemaining > 0">今日还可扔 {{ throwRemaining }} 次</div>
      </div>

      <div class="success-card" v-else>
        <div class="success-icon">🌊</div>
        <div class="success-title">瓶子已成功扔出！</div>
        <div class="success-desc">等待有缘人捞起你的瓶子~</div>
        <div class="success-actions">
          <van-button type="primary" block class="success-btn" @click="throwAgain" :disabled="throwRemaining <= 0">
            再扔一个
          </van-button>
          <van-button plain block style="margin-top: 12px;" class="back-btn" @click="goBack">
            返回首页
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { throwBottle as apiThrowBottle, getDailyLimits } from '../api';

const router = useRouter();
const content = ref('');
const isThrowing = ref(false);
const showSuccess = ref(false);
const showSplash = ref(false);
const throwRemaining = ref(20);

const quickMessages = [
  '今天心情很好！',
  '有人在吗？',
  '好无聊，聊聊天吧',
  '分享一个小故事...',
  '最近有什么开心的事吗？',
  '晚安，陌生人'
];

const canThrow = computed(() => {
  return content.value.trim().length > 0 && throwRemaining.value > 0;
});

onMounted(() => {
  fetchDailyLimits();
});

async function fetchDailyLimits() {
  try {
    const result = await getDailyLimits();
    throwRemaining.value = result.throwRemaining;
  } catch (error) {
    console.error('获取每日限制失败:', error);
  }
}

function useQuickMessage(msg) {
  content.value = msg;
}

async function throwBottle() {
  if (!canThrow.value) {
    if (throwRemaining.value <= 0) {
      showToast('今日扔瓶子次数已达上限');
    } else {
      showToast('请先写下你想说的话');
    }
    return;
  }

  isThrowing.value = true;
  showSuccess.value = false;
  showSplash.value = false;

  try {
    setTimeout(() => {
      showSplash.value = true;
    }, 350);

    const result = await apiThrowBottle(content.value);
    showToast(result._message || '操作成功');
    if (result.throwRemaining !== undefined) {
      throwRemaining.value = result.throwRemaining;
    } else {
      throwRemaining.value = Math.max(0, throwRemaining.value - 1);
    }
    
    setTimeout(() => {
      showSuccess.value = true;
      isThrowing.value = false;
    }, 700);
  } catch (error) {
    isThrowing.value = false;
    if (error.httpMessage && error.httpMessage.includes('上限')) {
      throwRemaining.value = 0;
      showToast(error.httpMessage);
    } else {
      showToast(error.businessMessage || error.httpMessage || '出现异常');
    }
  }
}

function throwAgain() {
  if (throwRemaining.value <= 0) {
    showToast('今日扔瓶子次数已达上限');
    return;
  }
  content.value = '';
  showSuccess.value = false;
  showSplash.value = false;
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

.throw-animation-container {
  margin: 20px 0;
}

.ocean-scene {
  position: relative;
  height: 160px;
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(180deg, #87CEEB 0%, #4FC3F7 50%, #0288D1 100%);
}

.water-surface-throw {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  overflow: hidden;
}

.wave-throw {
  position: absolute;
  left: -100%;
  right: -100%;
  bottom: 0;
  height: 50px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath fill='rgba(255,255,255,0.4)' d='M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z'/%3E%3C/svg%3E") repeat-x;
  background-size: 600px 60px;
  animation: waveMove 3s linear infinite;
}

@keyframes waveMove {
  0% { transform: translateX(0); }
  100% { transform: translateX(50%); }
}

.bottle-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.bottle-emoji {
  font-size: 60px;
  display: block;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
}

.bottle-display.bottle-throwing {
  animation: bottleThrow 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes bottleThrow {
  0% {
    top: 50%;
    left: 20%;
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
  }
  50% {
    top: 20%;
    left: 60%;
    transform: translate(-50%, -50%) rotate(180deg) scale(1.1);
  }
  100% {
    top: 65%;
    left: 85%;
    transform: translate(-50%, -50%) rotate(360deg) scale(0.7);
    opacity: 0.8;
  }
}

.bottle-display.bottle-sinked {
  opacity: 0;
  transform: translate(-50%, 100%) scale(0.5);
}

.splash-effect {
  position: absolute;
  top: 60%;
  left: 85%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  animation: splashShow 0.5s ease-out forwards;
}

@keyframes splashShow {
  0% { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
}

.splash-main {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,0.8);
  border-radius: 50%;
  animation: splashRing 0.4s ease-out forwards;
}

@keyframes splashRing {
  0% { width: 10px; height: 10px; opacity: 1; }
  100% { width: 80px; height: 80px; opacity: 0; }
}

.splash-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  background: rgba(255,255,255,0.9);
  border-radius: 50%;
  animation: splashDot 0.4s ease-out forwards;
}

.splash-dot.d1 { animation-delay: 0.05s; transform: translate(0, 0); }
.splash-dot.d2 { animation-delay: 0.08s; transform: translate(0, 0); }
.splash-dot.d3 { animation-delay: 0.1s; transform: translate(0, 0); }
.splash-dot.d4 { animation-delay: 0.12s; transform: translate(0, 0); }

@keyframes splashDot {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { opacity: 0; }
}

.splash-dot.d1 { --tx: 25px; --ty: -35px; }
.splash-dot.d2 { --tx: -30px; --ty: -25px; }
.splash-dot.d3 { --tx: 35px; --ty: -15px; }
.splash-dot.d4 { --tx: -25px; --ty: -30px; }

.splash-dot {
  animation-name: splashDotMove;
}

@keyframes splashDotMove {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
}

.input-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.input-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.input-icon {
  font-size: 24px;
}

.input-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.bottle-input {
  width: 100%;
  min-height: 120px;
  border: 2px solid #eee;
  border-radius: 12px;
  padding: 15px;
  font-size: 15px;
  resize: none;
  outline: none;
  transition: border-color 0.3s;
  font-family: inherit;
  background: #fafafa;
}

.bottle-input:focus {
  border-color: #1989fa;
  background: #fff;
}

.bottle-input:disabled {
  background: #f5f5f5;
  color: #999;
}

.char-count {
  text-align: right;
  color: #999;
  font-size: 12px;
  margin-top: 8px;
}

.quick-messages {
  margin: 16px 0;
}

.quick-messages-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
  margin-bottom: 10px;
}

.quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-tag {
  padding: 7px 12px;
  background: #f0f7ff;
  color: #1989fa;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.quick-tag:active {
  transform: scale(0.95);
  background: #d9eaff;
}

.throw-btn {
  margin-top: 10px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.throw-btn:disabled {
  background: #ccc;
}

.throw-tip {
  text-align: center;
  color: #fff;
  font-size: 12px;
  margin-top: 10px;
  opacity: 0.8;
}

.success-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 40px 20px;
  margin-top: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.success-icon {
  font-size: 60px;
  margin-bottom: 16px;
}

.success-title {
  font-size: 20px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
}

.success-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 24px;
}

.success-btn {
  border-radius: 12px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.back-btn {
  border-radius: 12px;
  height: 48px;
  color: #667eea;
  border-color: #667eea;
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
  height: 50%;
  background: linear-gradient(180deg, transparent 0%, rgba(41,182,246,0.4) 100%);
  animation: waterShift 6s ease-in-out infinite;
}

.water-layer::before {
  content: '';
  position: absolute;
  top: -25px;
  left: 0;
  right: 0;
  height: 50px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath fill='%234FC3F7' d='M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z'/%3E%3C/svg%3E") repeat-x;
  background-size: 600px 60px;
}

@keyframes waterShift {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.content-wrapper {
  position: relative;
  z-index: 1;
  padding: 20px;
}
</style>
