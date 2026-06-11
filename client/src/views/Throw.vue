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
        <span class="nav-title">扔瓶子</span>
        <div class="limit-badge" :class="{ 'limit-reached': throwRemaining <= 0 }">
          今日剩余: {{ throwRemaining }}次
        </div>
      </div>

      <div class="throw-animation-container" v-if="!showSuccess">
        <div class="ocean-scene">
          <div class="water-surface-throw">
            <div class="wave-throw wave-1-throw"></div>
            <div class="wave-throw wave-2-throw"></div>
            <div class="wave-throw wave-3-throw"></div>
          </div>
          <div class="deep-ocean-throw">
            <div class="bubble-throw bubble-1-throw"></div>
            <div class="bubble-throw bubble-2-throw"></div>
            <div class="bubble-throw bubble-3-throw"></div>
          </div>
          <div class="bottle-write-area" :class="{ shaking: isWriting }">
            <div class="bottle-write" :class="{ 'bottle-ready': canThrow }">
              <span class="bottle-icon">{{ isThrowing ? '🍾' : '📝' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="throw-success-container" v-else>
        <div class="success-ocean">
          <div class="throw-trajectory" v-if="showTrajectory">
            <div class="trajectory-dot" v-for="i in 8" :key="i" :style="{ animationDelay: (i * 0.08) + 's' }"></div>
          </div>
          <div class="bottle-fly-wrapper" v-if="showBottleFly">
            <div class="bottle-fly-throw">🍾</div>
          </div>
          <div class="water-splash-throw" v-if="showSplash">
            <div class="splash-ring ring-1"></div>
            <div class="splash-ring ring-2"></div>
            <div class="splash-ring ring-3"></div>
            <div class="splash-drop-throw drop-1-throw"></div>
            <div class="splash-drop-throw drop-2-throw"></div>
            <div class="splash-drop-throw drop-3-throw"></div>
            <div class="splash-drop-throw drop-4-throw"></div>
            <div class="splash-drop-throw drop-5-throw"></div>
            <div class="splash-drop-throw drop-6-throw"></div>
            <div class="splash-drop-throw drop-7-throw"></div>
            <div class="splash-drop-throw drop-8-throw"></div>
          </div>
          <div class="bottle-sink" v-if="showSink">
            <span class="sinking-bottle">🍾</span>
          </div>
          <div class="water-surface-success">
            <div class="wave-throw wave-1-throw"></div>
            <div class="wave-throw wave-2-throw"></div>
          </div>
        </div>
        <div class="success-text">{{ successMessage }}</div>
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
          @input="onInput"
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

      <div class="success-actions" v-else>
        <van-button type="primary" block class="success-btn" @click="throwAgain" :disabled="throwRemaining <= 0">
          再扔一个
        </van-button>
        <van-button plain block style="margin-top: 12px;" class="back-btn" @click="goBack">
          返回首页
        </van-button>
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
const isWriting = ref(false);
const showSuccess = ref(false);
const throwRemaining = ref(20);
const throwLimit = ref(20);
const showTrajectory = ref(false);
const showBottleFly = ref(false);
const showSplash = ref(false);
const showSink = ref(false);
const successMessage = ref('');

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
    throwLimit.value = result.throwLimit;
  } catch (error) {
    console.error('获取每日限制失败:', error);
  }
}

function onInput() {
  isWriting.value = true;
  setTimeout(() => {
    isWriting.value = false;
  }, 300);
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
  showTrajectory.value = false;
  showBottleFly.value = false;
  showSplash.value = false;
  showSink.value = false;
  successMessage.value = '用力投掷中...';

  try {
    setTimeout(() => {
      showTrajectory.value = true;
      successMessage.value = '瓶子正在飞向大海...';
    }, 300);

    setTimeout(() => {
      showBottleFly.value = true;
    }, 500);

    setTimeout(() => {
      showSplash.value = true;
      successMessage.value = '扑通！落入水中';
    }, 1200);

    setTimeout(() => {
      showSink.value = true;
      successMessage.value = '瓶子已沉入大海，等待有缘人...';
    }, 1800);

    const result = await apiThrowBottle(content.value);
    showToast(result._message || '操作成功');
    if (result.throwRemaining !== undefined) {
      throwRemaining.value = result.throwRemaining;
    } else {
      throwRemaining.value = Math.max(0, throwRemaining.value - 1);
    }
    
    setTimeout(() => {
      showSuccess.value = true;
    }, 2200);
  } catch (error) {
    if (error.httpMessage && error.httpMessage.includes('上限')) {
      throwRemaining.value = 0;
      showToast(error.httpMessage);
    } else {
      showToast(error.businessMessage || error.httpMessage || '出现异常');
    }
  } finally {
    setTimeout(() => {
      isThrowing.value = false;
    }, 2200);
  }
}

function throwAgain() {
  if (throwRemaining.value <= 0) {
    showToast('今日扔瓶子次数已达上限');
    return;
  }
  content.value = '';
  showSuccess.value = false;
  showTrajectory.value = false;
  showBottleFly.value = false;
  showSplash.value = false;
  showSink.value = false;
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
  height: 200px;
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(180deg, #87CEEB 0%, #4FC3F7 40%, #0288D1 100%);
}

.water-surface-throw {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  overflow: hidden;
}

.wave-throw {
  position: absolute;
  left: -100%;
  right: -100%;
  bottom: 0;
  height: 60px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath fill='rgba(255,255,255,0.3)' d='M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z'/%3E%3C/svg%3E") repeat-x;
  background-size: 600px 60px;
  animation: waveMove 4s linear infinite;
}

.wave-1-throw { opacity: 0.6; animation-duration: 3s; }
.wave-2-throw { opacity: 0.4; animation-duration: 4s; animation-delay: -1s; }
.wave-3-throw { opacity: 0.2; animation-duration: 5s; animation-delay: -2s; }

@keyframes waveMove {
  0% { transform: translateX(0); }
  100% { transform: translateX(50%); }
}

.deep-ocean-throw {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.bubble-throw {
  position: absolute;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(255,255,255,0.1));
  border-radius: 50%;
  animation: bubbleRise 4s ease-in-out infinite;
}

.bubble-1-throw { width: 6px; height: 6px; left: 15%; bottom: -20px; animation-delay: 0s; }
.bubble-2-throw { width: 10px; height: 10px; left: 50%; bottom: -20px; animation-delay: 1s; }
.bubble-3-throw { width: 8px; height: 8px; left: 80%; bottom: -20px; animation-delay: 0.5s; }

@keyframes bubbleRise {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.4; }
  100% { transform: translateY(-220px) scale(0.5); opacity: 0; }
}

.bottle-write-area {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.bottle-write {
  font-size: 80px;
  animation: float 3s ease-in-out infinite;
  transition: all 0.3s;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
}

.bottle-write.bottle-ready {
  filter: drop-shadow(0 4px 16px rgba(102, 126, 234, 0.6));
  transform: scale(1.05);
}

.bottle-write.shaking {
  animation: shake 0.3s ease-in-out;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-10px) rotate(5deg); }
}

@keyframes shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}

.throw-success-container {
  margin: 20px 0;
}

.success-ocean {
  position: relative;
  height: 250px;
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(180deg, #87CEEB 0%, #4FC3F7 50%, #0288D1 100%);
}

.throw-trajectory {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.trajectory-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  background: rgba(255,255,255,0.6);
  border-radius: 50%;
  opacity: 0;
  animation: trajectoryFade 0.5s ease-out forwards;
}

.trajectory-dot:nth-child(1) { top: 80%; left: 10%; }
.trajectory-dot:nth-child(2) { top: 65%; left: 18%; }
.trajectory-dot:nth-child(3) { top: 50%; left: 28%; }
.trajectory-dot:nth-child(4) { top: 40%; left: 40%; }
.trajectory-dot:nth-child(5) { top: 35%; left: 52%; }
.trajectory-dot:nth-child(6) { top: 40%; left: 64%; }
.trajectory-dot:nth-child(7) { top: 52%; left: 76%; }
.trajectory-dot:nth-child(8) { top: 70%; left: 86%; }

@keyframes trajectoryFade {
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(0.8); }
}

.bottle-fly-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.bottle-fly-throw {
  position: absolute;
  font-size: 50px;
  top: 70%;
  left: 5%;
  animation: bottleFly 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
}

@keyframes bottleFly {
  0% {
    top: 75%;
    left: 5%;
    transform: rotate(0deg) scale(1);
  }
  25% {
    top: 35%;
    left: 25%;
    transform: rotate(90deg) scale(1.1);
  }
  50% {
    top: 25%;
    left: 50%;
    transform: rotate(180deg) scale(1);
  }
  75% {
    top: 45%;
    left: 75%;
    transform: rotate(270deg) scale(0.9);
  }
  100% {
    top: 65%;
    left: 90%;
    transform: rotate(360deg) scale(0.8);
    opacity: 0.8;
  }
}

.water-splash-throw {
  position: absolute;
  top: 60%;
  left: 85%;
  transform: translate(-50%, -50%);
  width: 120px;
  height: 120px;
}

.splash-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 3px solid rgba(255,255,255,0.7);
  border-radius: 50%;
  animation: splashRingExpand 1s ease-out forwards;
  opacity: 0;
}

.ring-1 { animation-delay: 0s; }
.ring-2 { animation-delay: 0.2s; }
.ring-3 { animation-delay: 0.4s; }

@keyframes splashRingExpand {
  0% {
    width: 10px;
    height: 10px;
    opacity: 1;
  }
  100% {
    width: 150px;
    height: 150px;
    opacity: 0;
  }
}

.splash-drop-throw {
  position: absolute;
  width: 10px;
  height: 10px;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(79,195,247,0.3));
  border-radius: 50%;
  animation: splashDrop 0.8s ease-out forwards;
  opacity: 0;
}

.drop-1-throw { left: 50%; top: 50%; animation-delay: 0.1s; }
.drop-2-throw { left: 50%; top: 50%; animation-delay: 0.15s; }
.drop-3-throw { left: 50%; top: 50%; animation-delay: 0.2s; }
.drop-4-throw { left: 50%; top: 50%; animation-delay: 0.25s; }
.drop-5-throw { left: 50%; top: 50%; animation-delay: 0.3s; }
.drop-6-throw { left: 50%; top: 50%; animation-delay: 0.35s; }
.drop-7-throw { left: 50%; top: 50%; animation-delay: 0.4s; }
.drop-8-throw { left: 50%; top: 50%; animation-delay: 0.45s; }

@keyframes splashDrop {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--tx, 0), var(--ty, 0)) scale(0);
    opacity: 0;
  }
}

.splash-drop-throw:nth-child(4) { --tx: 40px; --ty: -60px; }
.splash-drop-throw:nth-child(5) { --tx: -50px; --ty: -50px; }
.splash-drop-throw:nth-child(6) { --tx: 60px; --ty: -20px; }
.splash-drop-throw:nth-child(7) { --tx: -60px; --ty: -30px; }
.splash-drop-throw:nth-child(8) { --tx: 30px; --ty: -70px; }
.splash-drop-throw:nth-child(9) { --tx: -40px; --ty: -60px; }
.splash-drop-throw:nth-child(10) { --tx: 70px; --ty: -40px; }
.splash-drop-throw:nth-child(11) { --tx: -70px; --ty: -20px; }

.bottle-sink {
  position: absolute;
  top: 60%;
  left: 85%;
  transform: translate(-50%, -50%);
}

.sinking-bottle {
  font-size: 40px;
  animation: bottleSink 1.5s ease-in forwards;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
}

@keyframes bottleSink {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  30% {
    transform: translateY(20px) rotate(15deg);
    opacity: 0.8;
  }
  60% {
    transform: translateY(60px) rotate(-10deg);
    opacity: 0.5;
  }
  100% {
    transform: translateY(120px) rotate(5deg);
    opacity: 0;
  }
}

.water-surface-success {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100px;
  overflow: hidden;
}

.success-text {
  color: #fff;
  font-size: 18px;
  margin-top: 20px;
  text-align: center;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
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
  min-height: 150px;
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
  margin: 20px 0;
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
  gap: 10px;
}

.quick-tag {
  padding: 8px 14px;
  background: #f0f7ff;
  color: #1989fa;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
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

.success-actions {
  margin-top: 40px;
}

.success-btn {
  border-radius: 12px;
  height: 50px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.back-btn {
  border-radius: 12px;
  height: 50px;
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
