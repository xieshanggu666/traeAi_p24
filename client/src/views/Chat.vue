<template>
  <div class="chat-page">
    <div class="chat-header">
      <van-icon name="arrow-left" size="24" @click="goBack" />
      <div class="chat-user-info">
        <AvatarDisplay :avatar="otherUser?.avatar || '🐱'" :size="44" class="chat-avatar" />
        <div class="chat-user-detail">
          <div class="chat-nickname">{{ otherUser?.nickname || '匿名用户' }}</div>
          <div class="chat-status">匿名聊天中</div>
        </div>
      </div>
      <div style="width: 24px;"></div>
    </div>

    <div class="bottle-info" v-if="bottleDetail">
      <div class="bottle-info-label">🍾 漂流瓶内容</div>
      <div class="bottle-info-content">{{ bottleDetail.content }}</div>
    </div>

    <div class="message-list" ref="messageListRef">
      <div 
        class="message-item" 
        v-for="msg in messages" 
        :key="msg.id"
        :class="{ 'is-mine': msg.sender_id === currentUserId }"
      >
        <AvatarDisplay :avatar="otherUser?.avatar || msg.sender_avatar" :size="36" class="message-avatar" v-if="msg.sender_id !== currentUserId" />
        <template v-if="msg.sender_id !== currentUserId">
          <div class="message-bubble" :class="{ 'gift-bubble': isGiftMessage(msg) }">
            <template v-if="isGiftMessage(msg)">
              <div class="gift-message">
                <div class="gift-label">🎁 赠送了礼物</div>
                <div class="gift-content">
                  <span class="gift-icon">{{ parseGiftContent(msg.content).giftIcon }}</span>
                  <div class="gift-info">
                    <div class="gift-name">{{ parseGiftContent(msg.content).giftName }}</div>
                    <div class="gift-charm">魅力值 +{{ parseGiftContent(msg.content).charmValue }}</div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="message-content">{{ msg.content }}</div>
            </template>
            <div class="message-time">{{ formatTime(msg.created_at) }}</div>
          </div>
        </template>
        <template v-else>
          <div class="message-bubble" :class="{ 'gift-bubble-mine': isGiftMessage(msg) }">
            <template v-if="isGiftMessage(msg)">
              <div class="gift-message">
                <div class="gift-label">🎁 赠送了礼物</div>
                <div class="gift-content">
                  <span class="gift-icon">{{ parseGiftContent(msg.content).giftIcon }}</span>
                  <div class="gift-info">
                    <div class="gift-name">{{ parseGiftContent(msg.content).giftName }}</div>
                    <div class="gift-charm">魅力值 +{{ parseGiftContent(msg.content).charmValue }}</div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="message-content">{{ msg.content }}</div>
            </template>
            <div class="message-time">{{ formatTime(msg.created_at) }}</div>
          </div>
          <AvatarDisplay :avatar="currentUser?.avatar" :size="36" class="message-avatar mine" />
        </template>
      </div>

      <van-loading v-if="loading" color="#1989fa" style="margin-top: 40px;">
        加载中...
      </van-loading>

      <div class="empty-messages" v-else-if="messages.length === 0">
        <div class="empty-icon">💬</div>
        <div class="empty-text">开始你们的聊天吧</div>
      </div>

      <div class="no-more" v-else>
        - 没有更多消息了 -
      </div>
    </div>

    <div class="input-area">
      <div class="gift-btn" @click="showGiftPanel = true">
        <van-icon name="gift-o" size="24" color="#667eea" />
      </div>
      <textarea
        v-model="messageContent"
        class="message-input"
        placeholder="输入消息..."
        rows="1"
        @keydown.enter.exact.prevent="sendMessage"
        @input="adjustTextareaHeight"
        ref="textareaRef"
      ></textarea>
      <van-button
        type="primary"
        class="send-button"
        :disabled="!canSend || isSending"
        :loading="isSending"
        @click="sendMessage"
      >
        发送
      </van-button>
    </div>

    <van-popup
      v-model:show="showGiftPanel"
      round
      position="bottom"
      :style="{ maxHeight: '70vh' }"
    >
      <div class="gift-panel">
        <div class="popup-header">
          <div class="popup-title">🎁 选择礼物</div>
          <van-icon name="cross" size="20" @click="showGiftPanel = false" />
        </div>
        <div class="gift-tip">赠送礼物可增加对方魅力值，表达心意吧~</div>
        <div class="gift-list" v-if="giftItems.length > 0">
          <div
            v-for="item in giftItems"
            :key="item.key"
            class="gift-card"
            :class="{ 'gift-selected': selectedGift?.key === item.key }"
            @click="selectedGift = item"
          >
            <div class="gift-card-icon">{{ item.icon }}</div>
            <div class="gift-card-name">{{ item.name }}</div>
            <div class="gift-card-charm">魅力+{{ item.charmValue }}</div>
            <div class="gift-card-qty">数量: {{ item.quantity }}</div>
          </div>
        </div>
        <div class="empty-gifts" v-else-if="!giftLoading">
          <div class="empty-gift-icon">🎁</div>
          <div class="empty-gift-text">您还没有礼物</div>
          <div class="empty-gift-desc">去商城购买礼物吧</div>
          <van-button type="primary" size="small" style="margin-top: 12px;" @click="goToShop">
            前往商城
          </van-button>
        </div>
        <van-loading v-if="giftLoading" color="#1989fa" style="display: block; text-align: center; padding: 40px 0;">加载中...</van-loading>
        <div class="gift-footer" v-if="giftItems.length > 0">
          <van-button
            type="primary"
            round
            block
            :disabled="!selectedGift || isSendingGift"
            :loading="isSendingGift"
            @click="handleSendGift"
          >
            {{ selectedGift ? `赠送「${selectedGift.name}」` : '请选择礼物' }}
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { getUser } from '../utils/storage';
import { getMessages, sendMessage as apiSendMessage, getBottleDetail, getBackpackItems, sendChatGift } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';

const route = useRoute();
const router = useRouter();
const bottleId = route.params.bottleId;

const currentUser = ref(null);
const currentUserId = computed(() => currentUser.value?.id);
const otherUser = ref(null);
const otherUserId = ref(null);
const bottleDetail = ref(null);
const messages = ref([]);
const messageContent = ref('');
const isSending = ref(false);
const loading = ref(false);
const messageListRef = ref(null);
const textareaRef = ref(null);
const showGiftPanel = ref(false);
const giftItems = ref([]);
const selectedGift = ref(null);
const giftLoading = ref(false);
const isSendingGift = ref(false);

let timer = null;

const canSend = computed(() => {
  return messageContent.value.trim().length > 0 && otherUserId.value;
});

onMounted(() => {
  currentUser.value = getUser();
  if (!currentUser.value) {
    showToast('用户信息异常，请刷新重试');
    router.back();
    return;
  }
  
  initChat();
  timer = setInterval(fetchMessages, 3000);
});

watch(showGiftPanel, (val) => {
  if (val) {
    fetchGiftItems();
  } else {
    selectedGift.value = null;
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

watch(messages, () => {
  nextTick(() => {
    scrollToBottom();
  });
}, { deep: true });

async function initChat() {
  try {
    loading.value = true;
    const detail = await getBottleDetail(bottleId);
    bottleDetail.value = detail;
    otherUser.value = {
      nickname: detail.other_nickname,
      avatar: detail.other_avatar
    };
    otherUserId.value = detail.other_id;
    
    await fetchMessages();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    loading.value = false;
  }
}

async function fetchMessages() {
  try {
    const result = await getMessages(bottleId);
    messages.value = result;
  } catch (error) {
    console.error('获取消息失败:', error);
  }
}

async function sendMessage() {
  if (!canSend.value) return;

  isSending.value = true;

  try {
    const result = await apiSendMessage(
      bottleId,
      otherUserId.value,
      messageContent.value
    );
    messages.value.push(result);
    messageContent.value = '';
    resetTextareaHeight();
    scrollToBottom();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    isSending.value = false;
  }
}

function formatTime(time) {
  if (!time) return '';
  const date = new Date(time);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function adjustTextareaHeight() {
  const textarea = textareaRef.value;
  if (textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }
}

function resetTextareaHeight() {
  const textarea = textareaRef.value;
  if (textarea) {
    textarea.style.height = 'auto';
  }
}

function scrollToBottom() {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
}

function goBack() {
  router.back();
}

function isGiftMessage(msg) {
  if (!msg) return false;
  if (msg.type === 'gift') return true;
  if (!msg.content || typeof msg.content !== 'string') return false;
  const trimmed = msg.content.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && parsed.type === 'gift';
  } catch {
    return false;
  }
}

function parseGiftContent(content) {
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content.trim());
      if (parsed && parsed.type === 'gift') {
        return {
          giftName: parsed.giftName || '未知礼物',
          giftIcon: parsed.giftIcon || '🎁',
          charmValue: parsed.charmValue || 0
        };
      }
    } catch {
      // ignore
    }
  }
  return { giftName: '未知礼物', giftIcon: '🎁', charmValue: 0 };
}

async function fetchGiftItems() {
  giftLoading.value = true;
  try {
    const items = await getBackpackItems();
    giftItems.value = items.filter(item => item.category === 'gift');
  } catch (error) {
    console.error('获取礼物列表失败:', error);
  } finally {
    giftLoading.value = false;
  }
}

async function handleSendGift() {
  if (!selectedGift.value || !otherUserId.value) return;
  
  try {
    await showDialog({
      title: '确认赠送',
      message: `确定将「${selectedGift.value.name}」赠送给「${otherUser.value?.nickname || '对方'}」吗？\n对方将获得魅力值+${selectedGift.value.charmValue}`,
      showCancelButton: true,
      confirmButtonText: '赠送',
      cancelButtonText: '取消'
    });
  } catch {
    return;
  }

  try {
    isSendingGift.value = true;
    const result = await sendChatGift(bottleId, otherUserId.value, selectedGift.value.key);
    
    if (result.message) {
      messages.value.push(result.message);
    }
    
    showToast(result._message || '赠送成功');
    showGiftPanel.value = false;
    scrollToBottom();
    await fetchGiftItems();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '赠送礼物失败');
  } finally {
    isSendingGift.value = false;
  }
}

function goToShop() {
  showGiftPanel.value = false;
  router.push('/shop');
}
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 100;
}

.chat-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-avatar {
  flex-shrink: 0;
}

.chat-user-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.chat-nickname {
  font-size: 15px;
  font-weight: bold;
  color: #333;
}

.chat-status {
  font-size: 12px;
  color: #07c160;
}

.bottle-info {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  margin: 12px 16px;
  padding: 12px;
  border-radius: 10px;
  border-left: 3px solid #667eea;
}

.bottle-info-label {
  font-size: 12px;
  color: #667eea;
  font-weight: bold;
  margin-bottom: 6px;
}

.bottle-info-content {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message-item {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 16px;
}

.message-item.is-mine {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-bubble {
  max-width: 70%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-content {
  background: #fff;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.5;
  color: #333;
  word-break: break-word;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.is-mine .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.message-time {
  font-size: 11px;
  color: #999;
  padding: 0 4px;
}

.is-mine .message-time {
  text-align: right;
}

.no-more {
  text-align: center;
  color: #ccc;
  font-size: 12px;
  padding: 20px 0;
}

.empty-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
}

.empty-icon {
  font-size: 60px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
}

.input-area {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #eee;
  position: sticky;
  bottom: 0;
}

.message-input {
  flex: 1;
  border: 1px solid #eee;
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 15px;
  resize: none;
  outline: none;
  max-height: 120px;
  overflow: hidden;
  background: #f7f7f7;
  transition: border-color 0.3s, background 0.3s;
  font-family: inherit;
}

.message-input:focus {
  border-color: #667eea;
  background: #fff;
}

.send-button {
  height: 40px;
  border-radius: 20px;
  padding: 0 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  flex-shrink: 0;
}

.send-button:disabled {
  background: #ccc;
}

.gift-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f5f5f5;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.gift-btn:active {
  background: #e8e8e8;
}

.gift-bubble .message-content {
  background: transparent !important;
  padding: 0 !important;
  box-shadow: none !important;
}

.gift-bubble-mine .message-content {
  background: transparent !important;
  padding: 0 !important;
  box-shadow: none !important;
}

.gift-message {
  background: linear-gradient(135deg, #fff0f5 0%, #ffe0ec 100%);
  border-radius: 16px;
  padding: 14px 16px;
  min-width: 200px;
}

.is-mine .gift-message {
  background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
}

.gift-label {
  font-size: 12px;
  color: #ff6b9d;
  font-weight: 500;
  margin-bottom: 10px;
}

.is-mine .gift-label {
  color: #667eea;
}

.gift-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gift-icon {
  font-size: 40px;
  flex-shrink: 0;
}

.gift-info {
  flex: 1;
  min-width: 0;
}

.gift-name {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.gift-charm {
  font-size: 12px;
  color: #ff6b9d;
  font-weight: 500;
}

.is-mine .gift-charm {
  color: #667eea;
}

.gift-panel {
  padding: 20px;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.popup-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.gift-tip {
  background: linear-gradient(135deg, #fff0f5 0%, #ffe0ec 100%);
  color: #ff6b9d;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 10px;
  margin-bottom: 16px;
  text-align: center;
}

.gift-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-height: 45vh;
  overflow-y: auto;
  padding-bottom: 12px;
}

.gift-card {
  background: #f9f9f9;
  border-radius: 14px;
  padding: 14px 10px;
  text-align: center;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.gift-card:active {
  transform: scale(0.96);
}

.gift-selected {
  background: linear-gradient(135deg, #fff0f5 0%, #ffe0ec 100%);
  border-color: #ff6b9d;
}

.gift-card-icon {
  font-size: 36px;
  margin-bottom: 6px;
}

.gift-card-name {
  font-size: 13px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.gift-card-charm {
  font-size: 11px;
  color: #ff6b9d;
  margin-bottom: 4px;
}

.gift-card-qty {
  font-size: 11px;
  color: #999;
}

.empty-gifts {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #999;
}

.empty-gift-icon {
  font-size: 56px;
  margin-bottom: 14px;
  opacity: 0.4;
}

.empty-gift-text {
  font-size: 16px;
  font-weight: bold;
  color: #666;
  margin-bottom: 4px;
}

.empty-gift-desc {
  font-size: 13px;
}

.gift-footer {
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
}
</style>
