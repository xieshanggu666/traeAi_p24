<template>
  <div class="chat-page">
    <div class="chat-header">
      <van-icon name="arrow-left" size="24" @click="goBack" />
      <div class="chat-user-info">
        <span class="chat-avatar">{{ otherUser?.avatar || '🐱' }}</span>
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
        <span class="message-avatar" v-if="msg.sender_id !== currentUserId">
          {{ otherUser?.avatar || msg.sender_avatar }}
        </span>
        <template v-if="msg.sender_id !== currentUserId">
          <div class="message-bubble">
            <div class="message-content">{{ msg.content }}</div>
            <div class="message-time">{{ formatTime(msg.created_at) }}</div>
          </div>
        </template>
        <template v-else>
          <div class="message-bubble">
            <div class="message-content">{{ msg.content }}</div>
            <div class="message-time">{{ formatTime(msg.created_at) }}</div>
          </div>
          <span class="message-avatar mine">
            {{ currentUser?.avatar }}
          </span>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import { getUser } from '../utils/storage';
import { getMessages, sendMessage as apiSendMessage, getBottleDetail } from '../api';

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
    console.error('初始化聊天失败:', error);
    showToast('加载聊天信息失败');
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
    console.error('发送消息失败:', error);
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
  font-size: 32px;
  background: #f0f7ff;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
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
  font-size: 28px;
  background: #f0f7ff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-avatar.mine {
  background: #fff0e6;
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
</style>
