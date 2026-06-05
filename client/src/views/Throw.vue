<template>
  <div class="page-container">
    <div class="wave-bg"></div>
    <div class="content-wrapper">
      <div class="nav-bar">
        <van-icon name="arrow-left" size="24" color="#fff" @click="goBack" />
        <span class="nav-title">扔瓶子</span>
        <div style="width: 24px;"></div>
      </div>

      <div class="throw-animation" v-if="!showSuccess">
        <div class="bottle-write" :class="{ shaking: isWriting }">
          <span class="bottle-icon">📝</span>
        </div>
      </div>

      <div class="success-animation" v-else>
        <div class="bottle-fly">
          <span class="bottle-icon">🍾</span>
        </div>
        <div class="success-text">瓶子已扔向大海 🌊</div>
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
          :disabled="isThrowing"
          @input="onInput"
        ></textarea>
        <div class="char-count">{{ content.length }}/500</div>

        <div class="quick-messages">
          <div 
            class="quick-tag" 
            v-for="(msg, index) in quickMessages" 
            :key="index"
            @click="useQuickMessage(msg)"
          >
            {{ msg }}
          </div>
        </div>

        <van-button
          type="primary"
          block
          size="large"
          class="throw-btn"
          :disabled="!canThrow || isThrowing"
          :loading="isThrowing"
          loading-text="扔出中..."
          @click="throwBottle"
        >
          🌊 扔向大海
        </van-button>
      </div>

      <div class="success-actions" v-else>
        <van-button type="primary" block @click="throwAgain">
          再扔一个
        </van-button>
        <van-button plain block style="margin-top: 12px;" @click="goBack">
          返回首页
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getUser } from '../utils/storage';
import { throwBottle as apiThrowBottle } from '../api';

const router = useRouter();
const content = ref('');
const isThrowing = ref(false);
const isWriting = ref(false);
const showSuccess = ref(false);

const quickMessages = [
  '今天心情很好！',
  '有人在吗？',
  '好无聊，聊聊天吧',
  '分享一个小故事...',
  '最近有什么开心的事吗？',
  '晚安，陌生人'
];

const canThrow = computed(() => {
  return content.value.trim().length > 0;
});

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
    showToast('请先写下你想说的话');
    return;
  }

  isThrowing.value = true;

  try {
    await apiThrowBottle(content.value);
    showSuccess.value = true;
  } catch (error) {
    console.error('扔瓶子失败:', error);
  } finally {
    isThrowing.value = false;
  }
}

function throwAgain() {
  content.value = '';
  showSuccess.value = false;
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

.throw-animation {
  display: flex;
  justify-content: center;
  margin: 30px 0;
}

.bottle-write {
  font-size: 80px;
  animation: float 3s ease-in-out infinite;
}

.bottle-write.shaking {
  animation: shake 0.3s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}

.success-animation {
  text-align: center;
  margin: 40px 0;
}

.bottle-fly {
  font-size: 80px;
  animation: fly 1.5s ease-out forwards;
}

@keyframes fly {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) translateX(100px) scale(0.5) rotate(45deg);
    opacity: 0;
  }
}

.success-text {
  color: #fff;
  font-size: 18px;
  margin-top: 20px;
  animation: fadeIn 0.5s ease-out 0.5s forwards;
  opacity: 0;
}

@keyframes fadeIn {
  to { opacity: 1; }
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
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0;
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

.success-actions {
  margin-top: 40px;
}
</style>
