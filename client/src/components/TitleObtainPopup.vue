<template>
  <transition name="title-popup">
    <div class="title-obtain-popup" v-if="visible" @click="handleClose">
      <div class="popup-content" @click.stop>
        <div class="bg-glow" :style="glowStyle"></div>
        <div class="sparkles">
          <span v-for="i in 12" :key="i" class="sparkle" :style="sparkleStyle(i)">✨</span>
        </div>
        
        <div class="title-icon-wrapper" :style="iconWrapperStyle">
          <div class="title-ring"></div>
          <div class="title-ring ring2"></div>
          <span class="title-icon" :style="iconStyle">{{ title?.icon }}</span>
        </div>
        
        <div class="obtain-title">恭喜获得称号</div>
        
        <div class="title-name" :style="nameStyle">{{ title?.name }}</div>
        
        <div class="title-description">{{ title?.description }}</div>
        
        <div class="title-rarity" :style="rarityStyle">
          {{ getRarityText(title?.rarity) }}
        </div>
        
        <van-button 
          type="primary" 
          round 
          block 
          class="equip-btn"
          @click="handleEquip"
        >
          立即佩戴
        </van-button>
        
        <div class="close-tip">点击任意处关闭</div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue';
import { showToast } from 'vant';
import { equipTitle as apiEquipTitle } from '../api';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update:visible', 'close', 'equipped']);

function getRarityText(rarity) {
  const map = {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说'
  };
  return map[rarity] || rarity;
}

const glowStyle = computed(() => {
  if (!props.title) return {};
  return {
    background: `radial-gradient(circle, ${props.title.color || '#ffd700'}40 0%, transparent 70%)`
  };
});

const iconWrapperStyle = computed(() => {
  if (!props.title) return {};
  return {
    boxShadow: `0 0 40px ${props.title.color || '#ffd700'}60`
  };
});

const iconStyle = computed(() => {
  return {};
});

const nameStyle = computed(() => {
  if (!props.title) return {};
  return {
    background: props.title.bg_gradient || props.title.bgGradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text'
  };
});

const rarityStyle = computed(() => {
  if (!props.title) return {};
  return {
    borderColor: props.title.color,
    color: props.title.color
  };
});

function sparkleStyle(index) {
  const angle = (index - 1) * 30;
  const delay = index * 0.1;
  return {
    transform: `rotate(${angle}deg) translateY(-80px)`,
    animationDelay: `${delay}s`
  };
}

function handleClose() {
  emit('update:visible', false);
  emit('close');
}

async function handleEquip() {
  if (!props.title) return;
  
  try {
    const titleId = props.title.id || props.title.title_id;
    await apiEquipTitle(titleId);
    showToast('佩戴成功');
    emit('equipped', props.title);
    handleClose();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '佩戴失败');
  }
}
</script>

<style scoped>
.title-obtain-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.popup-content {
  position: relative;
  width: 280px;
  padding: 40px 24px 24px;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 24px;
  text-align: center;
  overflow: hidden;
}

.bg-glow {
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 300px;
  border-radius: 50%;
  pointer-events: none;
}

.sparkles {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}

.sparkle {
  position: absolute;
  font-size: 16px;
  animation: sparkle-float 2s ease-in-out infinite;
}

@keyframes sparkle-float {
  0%, 100% {
    opacity: 0;
    transform: rotate(var(--angle, 0deg)) translateY(-80px) scale(0.5);
  }
  50% {
    opacity: 1;
    transform: rotate(var(--angle, 0deg)) translateY(-100px) scale(1);
  }
}

.title-icon-wrapper {
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2a2a4a 0%, #1a1a3a 100%);
  animation: icon-bounce 1s ease-out;
}

@keyframes icon-bounce {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.title-ring {
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  border-radius: 50%;
  border: 2px solid #ffd700;
  animation: ring-rotate 3s linear infinite;
  opacity: 0.6;
}

.ring2 {
  animation-direction: reverse;
  animation-duration: 4s;
  border-style: dashed;
  opacity: 0.4;
}

@keyframes ring-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.title-icon {
  font-size: 48px;
  animation: icon-shine 2s ease-in-out infinite;
}

@keyframes icon-shine {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.6));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.9));
  }
}

.obtain-title {
  font-size: 14px;
  color: #aaa;
  margin-bottom: 8px;
  letter-spacing: 2px;
}

.title-name {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 12px;
  animation: name-glow 2s ease-in-out infinite;
}

@keyframes name-glow {
  0%, 100% {
    filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.4));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(255, 215, 0, 0.8));
  }
}

.title-description {
  font-size: 13px;
  color: #888;
  margin-bottom: 16px;
  line-height: 1.5;
}

.title-rarity {
  display: inline-block;
  padding: 4px 16px;
  border-radius: 12px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 24px;
}

.equip-btn {
  margin-bottom: 12px;
}

.close-tip {
  font-size: 11px;
  color: #666;
}

.title-popup-enter-active {
  animation: popup-in 0.4s ease-out;
}

.title-popup-leave-active {
  animation: popup-out 0.3s ease-in;
}

@keyframes popup-in {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes popup-out {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.title-popup-enter-active .popup-content {
  animation: popup-content-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.title-popup-leave-active .popup-content {
  animation: popup-content-out 0.3s ease-in;
}

@keyframes popup-content-in {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes popup-content-out {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(0.8);
    opacity: 0;
  }
}
</style>
