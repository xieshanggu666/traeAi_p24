<template>
  <div class="page-container">
    <div class="wave-bg"></div>
    <div class="content-wrapper">
      <div class="nav-bar">
        <van-icon name="arrow-left" size="24" color="#fff" @click="goBack" />
        <span class="nav-title">捞瓶子</span>
        <div style="width: 24px;"></div>
      </div>

      <div class="pick-area" v-if="!bottle && !isPicking">
        <div class="net-animation">
          <div class="net">
            <span class="net-icon">🥅</span>
          </div>
        </div>
        <div class="pick-hint">点击下方按钮捞取漂流瓶</div>
      </div>

      <div class="picking-animation" v-else-if="isPicking">
        <div class="net-swing">
          <span class="net-icon">🥅</span>
        </div>
        <div class="picking-text">正在捞取中...</div>
      </div>

      <div class="bottle-detail" v-else-if="bottle && !showReply">
        <div class="bottle-card">
          <div class="bottle-header">
            <div class="sender-info">
              <span class="sender-avatar">{{ bottle.senderAvatar }}</span>
              <div class="sender-detail">
                <div class="sender-nickname">{{ bottle.senderNickname }}</div>
                <div class="bottle-time">{{ formatTime(bottle.createdAt) }}</div>
              </div>
            </div>
            <span class="bottle-tag">🍾 漂流瓶</span>
          </div>

          <div class="bottle-content">
            {{ bottle.content }}
          </div>

          <div class="bottle-actions">
            <van-button 
              type="default" 
              block 
              class="action-btn return-btn"
              :disabled="isReturning"
              :loading="isReturning"
              loading-text="扔回中..."
              @click="returnBottle"
            >
              🌊 扔回海里
            </van-button>
            <van-button 
              type="primary" 
              block 
              class="action-btn reply-btn"
              @click="showReply = true"
            >
              💬 回复TA
            </van-button>
          </div>
        </div>
      </div>

      <div class="reply-card" v-else-if="showReply">
        <div class="reply-header">
          <van-icon name="arrow-left" size="20" @click="showReply = false" />
          <span class="reply-title">回复TA</span>
          <div style="width: 20px;"></div>
        </div>

        <div class="original-content">
          <div class="original-label">对方的瓶子：</div>
          <div class="original-text">{{ bottle.content }}</div>
        </div>

        <textarea
          v-model="replyContent"
          class="reply-input"
          placeholder="写下你想说的话..."
          maxlength="500"
          :disabled="isReplying"
        ></textarea>
        <div class="char-count">{{ replyContent.length }}/500</div>

        <van-button
          type="primary"
          block
          size="large"
          class="send-btn"
          :disabled="!canReply || isReplying"
          :loading="isReplying"
          loading-text="发送中..."
          @click="replyBottle"
        >
          发送回复
        </van-button>
      </div>

      <div class="empty-state" v-else-if="showEmpty">
        <div class="empty-icon">🌊</div>
        <div class="empty-text">海里暂时没有漂流瓶</div>
        <div class="empty-desc">过一会儿再来试试吧</div>
      </div>

      <div class="pick-button-area" v-if="!bottle && !isPicking && !showEmpty">
        <van-button
          type="primary"
          size="large"
          block
          class="pick-btn"
          @click="pickBottle"
        >
          🌊 捞一个
        </van-button>
        <div class="pick-tip">每天可以捞取无数个瓶子哦</div>
      </div>

      <div class="pick-button-area" v-if="showEmpty && !bottle">
        <van-button
          type="primary"
          size="large"
          block
          class="pick-btn"
          @click="resetAndPick"
        >
          🔄 再捞一次
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
import { pickBottle as apiPickBottle, returnBottle as apiReturnBottle, replyBottle as apiReplyBottle } from '../api';

const router = useRouter();
const bottle = ref(null);
const isPicking = ref(false);
const isReturning = ref(false);
const isReplying = ref(false);
const showReply = ref(false);
const showEmpty = ref(false);
const replyContent = ref('');

const canReply = computed(() => {
  return replyContent.value.trim().length > 0;
});

function formatTime(time) {
  if (!time) return '';
  const date = new Date(time);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

async function pickBottle() {
  isPicking.value = true;
  showEmpty.value = false;

  try {
    const result = await apiPickBottle();
    bottle.value = result;
  } catch (error) {
    if (error.message === '海里暂时没有漂流瓶') {
      showEmpty.value = true;
    }
    console.error('捞瓶子失败:', error);
  } finally {
    isPicking.value = false;
  }
}

async function returnBottle() {
  if (!bottle.value) return;

  isReturning.value = true;

  try {
    await apiReturnBottle(bottle.value.id);
    showToast('已扔回海里');
    bottle.value = null;
    showReply.value = false;
  } catch (error) {
    console.error('扔回瓶子失败:', error);
  } finally {
    isReturning.value = false;
  }
}

async function replyBottle() {
  if (!canReply.value) {
    showToast('请先写下回复内容');
    return;
  }

  if (!bottle.value) {
    showToast('信息异常，请刷新重试');
    return;
  }

  isReplying.value = true;

  try {
    const result = await apiReplyBottle(bottle.value.id, replyContent.value);
    showToast('回复成功，已开启私聊');
    router.push(`/chat/${bottle.value.id}`);
  } catch (error) {
    console.error('回复瓶子失败:', error);
  } finally {
    isReplying.value = false;
  }
}

function resetAndPick() {
  showEmpty.value = false;
  pickBottle();
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

.pick-area {
  text-align: center;
  padding: 60px 0;
}

.net-animation {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
}

.net {
  font-size: 100px;
  animation: netFloat 2s ease-in-out infinite;
}

@keyframes netFloat {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-15px) rotate(5deg); }
}

.pick-hint {
  color: #fff;
  font-size: 16px;
  opacity: 0.9;
}

.picking-animation {
  text-align: center;
  padding: 80px 0;
}

.net-swing {
  font-size: 100px;
  animation: swing 0.5s ease-in-out infinite;
}

@keyframes swing {
  0%, 100% { transform: rotate(-20deg); }
  50% { transform: rotate(20deg); }
}

.picking-text {
  color: #fff;
  font-size: 18px;
  margin-top: 30px;
}

.bottle-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.bottle-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.sender-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sender-avatar {
  font-size: 36px;
  background: #f0f7ff;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sender-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sender-nickname {
  font-size: 15px;
  font-weight: bold;
  color: #333;
}

.bottle-time {
  font-size: 12px;
  color: #999;
}

.bottle-tag {
  font-size: 12px;
  color: #1989fa;
  background: #e8f3ff;
  padding: 4px 10px;
  border-radius: 12px;
}

.bottle-content {
  background: #fafafa;
  border-radius: 12px;
  padding: 20px;
  font-size: 15px;
  line-height: 1.8;
  color: #333;
  min-height: 120px;
}

.bottle-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.action-btn {
  flex: 1;
  border-radius: 10px;
}

.return-btn {
  color: #666;
}

.reply-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.reply-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.reply-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.original-content {
  background: #f0f7ff;
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 15px;
}

.original-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.original-text {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
}

.reply-input {
  width: 100%;
  min-height: 100px;
  border: 2px solid #eee;
  border-radius: 12px;
  padding: 15px;
  font-size: 15px;
  resize: none;
  outline: none;
  transition: border-color 0.3s;
  font-family: inherit;
}

.reply-input:focus {
  border-color: #1989fa;
}

.char-count {
  text-align: right;
  color: #999;
  font-size: 12px;
  margin-top: 8px;
}

.send-btn {
  margin-top: 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}

.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #fff;
}

.empty-icon {
  font-size: 80px;
  margin-bottom: 20px;
  opacity: 0.8;
}

.empty-text {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  opacity: 0.8;
}

.pick-button-area {
  position: fixed;
  bottom: 30px;
  left: 20px;
  right: 20px;
  max-width: 710px;
  margin: 0 auto;
  z-index: 10;
}

.pick-btn {
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  height: 54px;
  font-size: 17px;
}

.pick-tip {
  text-align: center;
  color: #fff;
  font-size: 12px;
  margin-top: 10px;
  opacity: 0.8;
}
</style>
