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

      <div class="throw-scene">
        <div class="scene-bg">
          <div class="scene-wave"></div>
        </div>
        <div class="bottle-stage">
          <div class="bottle-icon-wrap" :class="{ 'bottle-flying': isThrowing }">
            <span class="bottle-emoji">🍾</span>
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

        <div class="image-upload-section">
          <div class="section-label">
            <span class="label-icon">📷</span>
            <span>添加图片</span>
            <span class="label-tip">（可选，最多1张，5MB以内）</span>
          </div>
          <div class="image-upload-area">
            <div v-if="imageUrl" class="image-preview">
              <img :src="getImageFullUrl(imageUrl)" class="preview-img" alt="预览图片" />
              <div class="image-remove" @click="removeImage">
                <van-icon name="cross" size="16" />
              </div>
            </div>
            <div v-else class="upload-btn" @click="triggerUpload" :class="{ disabled: isUploading || isThrowing }">
              <van-icon name="photograph" size="32" color="#999" />
              <span class="upload-text">{{ isUploading ? '上传中...' : '点击上传图片' }}</span>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style="display: none;"
              @change="handleFileChange"
            />
          </div>
        </div>

        <div class="tag-section">
          <div class="section-label">
            <span class="label-icon">🏷️</span>
            <span>选择标签</span>
            <span class="label-tip">（可选，帮助有缘人更快找到你）</span>
          </div>
          <div class="tag-options">
            <div
              v-for="tag in tagOptions"
              :key="tag.value"
              class="tag-option"
              :class="{ active: selectedTag === tag.value }"
              @click="selectTag(tag.value)"
            >
              <span class="tag-emoji">{{ tag.emoji }}</span>
              <span>{{ tag.label }}</span>
            </div>
          </div>
        </div>

        <div class="target-section">
          <div class="section-label">
            <span class="label-icon">🎯</span>
            <span>设置谁可以捞到</span>
            <span class="label-tip">（可选，默认不限）</span>
          </div>

          <div class="target-subsection">
            <div class="subsection-label">性别偏好</div>
            <div class="target-options">
              <div
                v-for="option in genderTargetOptions"
                :key="option.value"
                class="target-option"
                :class="{ active: targetGender === option.value }"
                @click="targetGender = option.value"
              >
                {{ option.label }}
              </div>
            </div>
          </div>

          <div class="target-subsection">
            <div class="subsection-label">
              年龄范围
              <span class="range-display">{{ targetMinAge }} - {{ targetMaxAge }}岁</span>
            </div>
            <div class="age-inputs">
              <div class="age-input-group">
                <span>最小</span>
                <van-stepper
                  v-model="targetMinAge"
                  :min="18"
                  :max="targetMaxAge - 1"
                  input-width="60px"
                  button-size="24"
                />
              </div>
              <div class="age-divider">~</div>
              <div class="age-input-group">
                <span>最大</span>
                <van-stepper
                  v-model="targetMaxAge"
                  :min="targetMinAge + 1"
                  :max="60"
                  input-width="60px"
                  button-size="24"
                />
              </div>
            </div>
            <div class="age-toggle-row">
              <div class="age-toggle" @click="resetAgeRange">
                <van-icon name="replay" size="14" />
                <span>不限年龄</span>
              </div>
            </div>
          </div>
        </div>

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
          :disabled="!canThrow || isThrowing || throwRemaining <= 0 || isUploading"
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
import { throwBottle as apiThrowBottle, getDailyLimits, uploadBottleImage } from '../api';

const router = useRouter();
const fileInput = ref(null);
const content = ref('');
const isThrowing = ref(false);
const isUploading = ref(false);
const showSuccess = ref(false);
const throwRemaining = ref(20);
const imageUrl = ref('');
const selectedTag = ref('');
const targetGender = ref('all');
const targetMinAge = ref(18);
const targetMaxAge = ref(60);
const ageUnlimited = ref(true);

const tagOptions = [
  { value: '情绪倾诉', label: '情绪倾诉', emoji: '💬' },
  { value: '交友', label: '交友', emoji: '🤝' },
  { value: '求助', label: '求助', emoji: '🆘' },
  { value: '树洞', label: '树洞', emoji: '🌳' },
  { value: '闲聊', label: '闲聊', emoji: '☕' },
  { value: '考研搭子', label: '考研搭子', emoji: '📚' },
  { value: '游戏组队', label: '游戏组队', emoji: '🎮' }
];

const genderTargetOptions = [
  { label: '不限', value: 'all' },
  { label: '男生', value: 'male' },
  { label: '女生', value: 'female' }
];

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

function getImageFullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4022';
  return baseUrl + url;
}

function triggerUpload() {
  if (isUploading.value || isThrowing.value) return;
  fileInput.value.click();
}

async function handleFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('图片大小不能超过5MB');
    event.target.value = '';
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('只支持 JPG、PNG、GIF、WebP 格式的图片');
    event.target.value = '';
    return;
  }

  isUploading.value = true;

  try {
    const formData = new FormData();
    formData.append('image', file);
    const result = await uploadBottleImage(formData);
    imageUrl.value = result.imageUrl;
    showToast('图片上传成功');
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '图片上传失败');
  } finally {
    isUploading.value = false;
    event.target.value = '';
  }
}

function removeImage() {
  imageUrl.value = '';
}

function selectTag(tag) {
  selectedTag.value = selectedTag.value === tag ? '' : tag;
}

function resetAgeRange() {
  targetMinAge.value = 18;
  targetMaxAge.value = 60;
  ageUnlimited.value = true;
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

  try {
    const data = {
      content: content.value
    };

    if (selectedTag.value) {
      data.tag = selectedTag.value;
    }
    if (imageUrl.value) {
      data.imageUrl = imageUrl.value;
    }
    if (targetGender.value && targetGender.value !== 'all') {
      data.targetGender = targetGender.value;
    }
    if (!ageUnlimited.value || (targetMinAge.value !== 18 || targetMaxAge.value !== 60)) {
      data.targetMinAge = targetMinAge.value;
      data.targetMaxAge = targetMaxAge.value;
    }

    const result = await apiThrowBottle(data);
    showToast(result._message || '操作成功');
    if (result.throwRemaining !== undefined) {
      throwRemaining.value = result.throwRemaining;
    } else {
      throwRemaining.value = Math.max(0, throwRemaining.value - 1);
    }
    showSuccess.value = true;
  } catch (error) {
    if (error.httpMessage && error.httpMessage.includes('上限')) {
      throwRemaining.value = 0;
      showToast(error.httpMessage);
    } else {
      showToast(error.businessMessage || error.httpMessage || '出现异常');
    }
  } finally {
    isThrowing.value = false;
  }
}

function throwAgain() {
  if (throwRemaining.value <= 0) {
    showToast('今日扔瓶子次数已达上限');
    return;
  }
  content.value = '';
  imageUrl.value = '';
  selectedTag.value = '';
  targetGender.value = 'all';
  targetMinAge.value = 18;
  targetMaxAge.value = 60;
  ageUnlimited.value = true;
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

.throw-scene {
  position: relative;
  height: 140px;
  margin: 16px 0;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(180deg, #87CEEB 0%, #4FC3F7 60%, #0288D1 100%);
}

.scene-bg {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50px;
  overflow: hidden;
}

.scene-wave {
  position: absolute;
  left: -100%;
  right: -100%;
  bottom: 0;
  height: 40px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 120'%3E%3Cpath fill='rgba(255,255,255,0.4)' d='M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z'/%3E%3C/svg%3E") repeat-x;
  background-size: 600px 60px;
  animation: waveMove 3s linear infinite;
}

@keyframes waveMove {
  0% { transform: translateX(0); }
  100% { transform: translateX(50%); }
}

.bottle-stage {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottle-icon-wrap {
  font-size: 56px;
  transition: none;
  filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));
}

.bottle-icon-wrap.bottle-flying {
  animation: flyOut 0.5s ease-out forwards;
}

@keyframes flyOut {
  0% {
    transform: translate(0, 0) rotate(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(120px, -60px) rotate(360deg) scale(0.3);
    opacity: 0;
  }
}

.bottle-emoji {
  display: block;
}

.input-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  margin-top: 12px;
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

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 12px;
}

.label-icon {
  font-size: 16px;
}

.label-tip {
  font-size: 12px;
  color: #999;
  font-weight: normal;
}

.image-upload-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed #eee;
}

.image-upload-area {
  display: flex;
  gap: 12px;
}

.image-preview {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #667eea;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
}

.upload-btn {
  width: 120px;
  height: 120px;
  border: 2px dashed #ddd;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
}

.upload-btn:active {
  transform: scale(0.98);
}

.upload-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-text {
  font-size: 12px;
  color: #999;
}

.tag-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed #eee;
}

.tag-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f5f5f5;
  border: 2px solid transparent;
  border-radius: 20px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-option:active {
  transform: scale(0.97);
}

.tag-option.active {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-color: #667eea;
  color: #667eea;
  font-weight: 500;
}

.tag-emoji {
  font-size: 14px;
}

.target-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px dashed #eee;
}

.target-subsection {
  margin-bottom: 16px;
}

.target-subsection:last-child {
  margin-bottom: 0;
}

.subsection-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #666;
  margin-bottom: 10px;
}

.range-display {
  color: #667eea;
  font-weight: 500;
}

.target-options {
  display: flex;
  gap: 10px;
}

.target-option {
  flex: 1;
  padding: 10px 0;
  background: #f5f5f5;
  border: 2px solid transparent;
  border-radius: 10px;
  text-align: center;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.target-option:active {
  transform: scale(0.98);
}

.target-option.active {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-color: #667eea;
  color: #667eea;
  font-weight: 500;
}

.age-inputs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #fafafa;
  border-radius: 12px;
  padding: 12px;
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

.age-toggle-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.age-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #667eea;
  cursor: pointer;
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
  margin-top: 12px;
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

.content-wrapper {
  position: relative;
  z-index: 1;
  padding: 20px;
}
</style>
