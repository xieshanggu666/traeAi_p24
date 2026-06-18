<template>
  <div class="chat-settings-page">
    <van-nav-bar
      title="聊天设置"
      left-arrow
      @click-left="goBack"
      fixed
      placeholder
    />

    <div class="settings-content">
      <div class="settings-section">
        <div class="section-title">聊天框皮肤</div>
        <div class="skin-preview current-skin" v-if="currentSkin">
          <div class="skin-label">当前使用</div>
          <div class="skin-preview-box" :style="getSkinStyle(currentSkin)">
            <div class="preview-message self">
              <div class="message-bubble" :style="getBubbleStyle(currentSkin, 'self')">
                你好呀~
              </div>
            </div>
            <div class="preview-message other">
              <div class="message-avatar">😊</div>
              <div class="message-bubble" :style="getBubbleStyle(currentSkin, 'other')">
                你好，很高兴认识你！
              </div>
            </div>
          </div>
          <div class="skin-name">{{ currentSkin.name }}</div>
        </div>
        <div class="skin-preview default-skin" v-else>
          <div class="skin-label">当前使用</div>
          <div class="skin-preview-box default">
            <div class="preview-message self">
              <div class="message-bubble self-default">
                你好呀~
              </div>
            </div>
            <div class="preview-message other">
              <div class="message-avatar">😊</div>
              <div class="message-bubble other-default">
                你好，很高兴认识你！
              </div>
            </div>
          </div>
          <div class="skin-name">默认皮肤</div>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-title">选择皮肤</div>
        <div class="skin-list">
          <div
            class="skin-item default-item"
            :class="{ active: !selectedSkinId }"
            @click="selectSkin(null)"
          >
            <div class="skin-thumb default-thumb">
              <div class="thumb-bubble self-default-thumb"></div>
              <div class="thumb-bubble other-default-thumb"></div>
            </div>
            <span class="skin-item-name">默认</span>
          </div>
          <div
            v-for="skin in mySkins"
            :key="skin.skin_id || skin.id"
            class="skin-item"
            :class="{ active: selectedSkinId === (skin.skin_id || skin.id) }"
            @click="selectSkin(skin.skin_id || skin.id)"
          >
            <div class="skin-thumb" :style="getThumbStyle(skin)">
              <div class="thumb-bubble" :style="getThumbBubbleStyle(skin, 'self')"></div>
              <div class="thumb-bubble" :style="getThumbBubbleStyle(skin, 'other')"></div>
            </div>
            <span class="skin-item-name">{{ skin.name }}</span>
          </div>
        </div>
        <div class="empty-tip" v-if="mySkins.length === 0">
          <span>暂无聊天皮肤，去商城购买吧~</span>
          <van-button size="small" type="primary" round @click="goToShop">去商城</van-button>
        </div>
      </div>

      <div class="confirm-section">
        <van-button type="primary" block round @click="confirmSkin">确认使用</van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getMyChatSkins, useChatSkin } from '../api';

const router = useRouter();

const mySkins = ref([]);
const currentSkin = ref(null);
const selectedSkinId = ref(null);

onMounted(() => {
  fetchMySkins();
});

async function fetchMySkins() {
  try {
    const result = await getMyChatSkins();
    mySkins.value = result.skins || [];
    currentSkin.value = result.activeSkin || null;
    selectedSkinId.value = result.activeSkin?.id || null;
  } catch (error) {
    console.error('获取聊天皮肤失败:', error);
  }
}

function getSkinStyle(skin) {
  return {
    background: skin.bg_color || '#f5f5f5'
  };
}

function getBubbleStyle(skin, type) {
  if (type === 'self') {
    return {
      background: skin.bubble_bg_mine || '#1989fa',
      color: skin.text_color_mine || '#fff'
    };
  } else {
    return {
      background: skin.bubble_bg_other || '#fff',
      color: skin.text_color_other || '#333'
    };
  }
}

function getThumbStyle(skin) {
  return {
    background: skin.bg_color || '#f5f5f5'
  };
}

function getThumbBubbleStyle(skin, type) {
  if (type === 'self') {
    return {
      background: skin.bubble_bg_mine || '#1989fa',
      marginLeft: 'auto'
    };
  } else {
    return {
      background: skin.bubble_bg_other || '#fff'
    };
  }
}

function selectSkin(skinId) {
  selectedSkinId.value = skinId;
}

async function confirmSkin() {
  try {
    if (selectedSkinId.value) {
      await useChatSkin(selectedSkinId.value);
    } else {
      await useChatSkin('');
    }
    await fetchMySkins();
    showToast('切换成功');
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '切换失败');
  }
}

function goToShop() {
  router.push('/shop');
}

function goBack() {
  router.back();
}
</script>

<style scoped>
.chat-settings-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 100px;
}

.settings-content {
  padding: 16px;
}

.settings-section {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 16px;
}

.skin-preview {
  text-align: center;
}

.skin-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 12px;
}

.skin-preview-box {
  height: 180px;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
}

.skin-preview-box.default {
  background: #f5f5f5;
}

.preview-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
}

.preview-message.self {
  justify-content: flex-end;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.message-bubble {
  max-width: 70%;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.4;
  word-wrap: break-word;
}

.self-default {
  background: #1989fa;
  color: #fff;
  border-radius: 16px 16px 4px 16px;
}

.other-default {
  background: #fff;
  color: #333;
  border-radius: 16px 16px 16px 4px;
}

.skin-name {
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.skin-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.skin-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 10px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.skin-item:active {
  transform: scale(0.95);
}

.skin-item.active {
  border-color: #1989fa;
  background: #e8f4fd;
}

.skin-thumb {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #f5f5f5;
}

.skin-thumb.default-thumb {
  background: #f5f5f5;
}

.thumb-bubble {
  width: 70%;
  height: 14px;
  border-radius: 8px;
}

.self-default-thumb {
  background: #1989fa;
  margin-left: auto;
}

.other-default-thumb {
  background: #fff;
}

.skin-item-name {
  font-size: 12px;
  color: #666;
}

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  color: #999;
  font-size: 14px;
}

.confirm-section {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}
</style>
