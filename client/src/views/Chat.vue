<template>
  <div class="chat-page">
    <div class="chat-header">
      <van-icon name="arrow-left" size="24" @click="goBack" />
      <div class="chat-user-info" @click="showUserProfile(otherUserId)">
        <AvatarDisplay :avatar="otherUser?.avatar || '🐱'" :size="44" class="chat-avatar" />
        <div class="chat-user-detail">
          <div class="chat-nickname">{{ otherUser?.nickname || '匿名用户' }}</div>
          <div class="chat-status" :class="{ 'typing-status': otherIsTyping }">
            <template v-if="otherIsTyping">
              <span class="typing-dots">
                <span></span><span></span><span></span>
              </span>
              对方正在输入
            </template>
            <template v-else>匿名聊天中</template>
          </div>
        </div>
      </div>
      <div class="header-right">
        <div class="add-friend-btn" v-if="intimacyValue >= 100 && !isFriend && !hasPendingRequest" @click="handleAddFriend">
          <van-icon name="add-o" size="14" />
          <span>加好友</span>
        </div>
        <div class="intimacy-display" v-if="intimacyValue > 0">
          <span class="intimacy-heart">❤</span>
          <span class="intimacy-value">{{ intimacyValue }}</span>
        </div>
      </div>
    </div>

    <div class="bottle-info" v-if="bottleDetail">
      <div class="bottle-info-label">🍾 漂流瓶内容</div>
      <div class="bottle-info-content">{{ bottleDetail.content }}</div>
    </div>

    <div class="blocked-warning" v-if="iBlocked || blockedMe">
      <template v-if="iBlocked">
        <van-icon name="warning-o" size="14" />
        <span>您已拉黑对方，无法进行任何互动</span>
      </template>
      <template v-else-if="blockedMe">
        <van-icon name="warning-o" size="14" />
        <span>对方已拉黑您，消息将被拒收</span>
      </template>
    </div>

    <div class="message-list" ref="messageListRef">
      <div 
        class="message-item" 
        v-for="msg in messages" 
        :key="msg.id"
        :class="{ 'is-mine': msg.sender_id === currentUserId }"
      >
        <AvatarDisplay 
          :avatar="otherUser?.avatar || msg.sender_avatar" 
          :size="36" 
          :avatarFrame="otherAvatarFrame"
          class="message-avatar clickable-avatar" 
          v-if="msg.sender_id !== currentUserId && !msg.is_recalled" 
          @click="showUserProfile(otherUserId)" 
        />
        <template v-if="msg.sender_id !== currentUserId">
          <div v-if="msg.is_recalled" class="recalled-message recalled-other recalled-center">
            <span class="recalled-text">对方撤回了一条消息</span>
          </div>
          <div v-else class="message-bubble" :class="{ 'gift-bubble-mine': isGiftMessage(msg), 'image-bubble': isImageMessage(msg), 'special-effect-bubble': isGiftMessage(msg) && parseGiftContent(msg.content).isSpecialEffect }">
            <template v-if="isGiftMessage(msg)">
              <div class="gift-message" :class="{ 'special-gift-message': parseGiftContent(msg.content).isSpecialEffect }">
                <div class="gift-label">🎁 赠送了礼物 <van-tag v-if="parseGiftContent(msg.content).isSpecialEffect" type="danger" size="mini" round>特效</van-tag></div>
                <div class="gift-content">
                  <span class="gift-icon" :class="{ 'special-gift-icon-anim': parseGiftContent(msg.content).isSpecialEffect }">{{ parseGiftContent(msg.content).giftIcon }}</span>
                  <div class="gift-info">
                    <div class="gift-name">{{ parseGiftContent(msg.content).giftName }}</div>
                    <div class="gift-charm">魅力值 +{{ parseGiftContent(msg.content).charmValue }}</div>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="isImageMessage(msg)">
              <img :src="msg.image_url || msg.content" class="message-image" @click="previewImage(msg.image_url || msg.content)" />
            </template>
            <template v-else>
              <div class="message-content" :style="getOtherMsgSkinStyle()">{{ msg.content }}</div>
            </template>
            <div class="message-footer">
              <div class="message-time">{{ formatTime(msg.created_at) }}</div>
            </div>
          </div>
        </template>
        <template v-else>
          <div v-if="msg.is_recalled" class="recalled-message recalled-mine recalled-center">
            <span class="recalled-text">你撤回了一条消息</span>
          </div>
          <template v-else>
            <div class="blocked-indicator" v-if="msg.is_blocked">
              <van-icon name="warning" size="16" class="blocked-icon" />
              <span class="blocked-tip">对方拒收</span>
            </div>
            <div 
              class="message-bubble" 
              :class="{ 'gift-bubble-mine': isGiftMessage(msg), 'bubble-contextmenu': contextMenuMsgId === msg.id, 'image-bubble-mine': isImageMessage(msg), 'msg-blocked': msg.is_blocked }"
              @contextmenu.prevent="showContextMenu($event, msg)"
              @longpress="handleLongPress(msg)"
            >
              <template v-if="isGiftMessage(msg)">
                <div class="gift-message" :class="{ 'special-gift-message': parseGiftContent(msg.content).isSpecialEffect }">
                  <div class="gift-label">🎁 赠送了礼物 <van-tag v-if="parseGiftContent(msg.content).isSpecialEffect" type="danger" size="mini" round>特效</van-tag></div>
                  <div class="gift-content">
                    <span class="gift-icon" :class="{ 'special-gift-icon-anim': parseGiftContent(msg.content).isSpecialEffect }">{{ parseGiftContent(msg.content).giftIcon }}</span>
                    <div class="gift-info">
                      <div class="gift-name">{{ parseGiftContent(msg.content).giftName }}</div>
                      <div class="gift-charm">魅力值 +{{ parseGiftContent(msg.content).charmValue }}</div>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else-if="isImageMessage(msg)">
                <img :src="msg.image_url || msg.content" class="message-image" @click="previewImage(msg.image_url || msg.content)" />
              </template>
              <template v-else>
                <div class="message-content" :style="getSelfMsgSkinStyle()">{{ msg.content }}</div>
              </template>
              <div class="message-footer">
                <div class="message-time">{{ formatTime(msg.created_at) }}</div>
                <div class="message-read-status" :class="{ 'read': msg.is_read }" v-if="!msg.is_blocked">
                  <template v-if="msg.is_read">
                    <span class="read-double-check">
                      <van-icon name="success" size="14" />
                      <van-icon name="success" size="14" class="double-second" />
                    </span>
                  </template>
                  <template v-else>
                    <van-icon name="checked" size="14" class="read-icon-single" />
                  </template>
                </div>
              </div>
            </div>
            <AvatarDisplay :avatar="currentUser?.avatar" :size="36" :avatarFrame="myAvatarFrame" class="message-avatar mine clickable-avatar" @click="showUserProfile(currentUserId)" />
          </template>
        </template>
      </div>

      <div class="consecutive-warning" v-if="isConsecutiveLimited">
        <span class="consecutive-warning-icon">💬</span>
        <span>对方尚未回复，请等待对方回复后再发送消息</span>
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

    <div class="quick-reply-chat-panel" v-if="showQuickReply">
      <div class="quick-reply-chat-header">
        <div class="quick-reply-chat-tabs">
          <div 
            v-for="(category, index) in quickReplyCategories" 
            :key="index"
            class="quick-tab-chat"
            :class="{ active: activeQuickCategory === index }"
            @click="activeQuickCategory = index"
          >
            {{ category.name }}
          </div>
        </div>
        <van-icon name="cross" size="18" @click="showQuickReply = false" class="close-quick-btn" />
      </div>
      <div class="quick-reply-chat-list">
        <div 
          v-for="(msg, msgIndex) in quickReplyCategories[activeQuickCategory].messages" 
          :key="msgIndex"
          class="quick-reply-chat-item"
          @click="useQuickReply(msg)"
        >
          {{ msg }}
        </div>
      </div>
    </div>

    <div 
      v-if="showRecallMenu" 
      class="context-menu-mask" 
      @click="hideContextMenu"
    >
      <div 
        class="context-menu" 
        :style="{ top: contextMenuPos.top + 'px', left: contextMenuPos.left + 'px' }"
        @click.stop
      >
        <div 
          class="context-menu-item recall-item"
          :class="{ disabled: !canRecallSelectedMsg }"
          @click="handleRecallMessage"
        >
          <van-icon name="replay" size="16" />
          <span>撤回</span>
          <span v-if="!canRecallSelectedMsg" class="recall-tip">{{ recallDisabledReason }}</span>
        </div>
      </div>
    </div>

    <div class="pending-image-panel" v-if="pendingImagePreview">
      <div class="pending-image-wrap">
        <img :src="pendingImagePreview" class="pending-image-preview" />
        <van-loading v-if="isUploadingImage" class="pending-image-loading" color="#667eea">上传中...</van-loading>
        <div class="pending-image-remove" @click="removePendingImage" v-if="!isUploadingImage">
          <van-icon name="cross" size="14" />
        </div>
      </div>
    </div>

    <div class="input-area">
      <div class="image-btn" @click="triggerImageSelect" :class="{ disabled: iBlocked }">
        <van-icon name="photograph" size="24" color="#667eea" />
      </div>
      <div class="gift-btn" @click="showGiftPanel = true" :class="{ disabled: iBlocked }">
        <van-icon name="gift-o" size="24" color="#667eea" />
      </div>
      <div class="quick-reply-chat-btn" @click="showQuickReply = !showQuickReply" :class="{ active: showQuickReply, disabled: iBlocked }">
        <van-icon name="chat-o" size="24" color="#667eea" />
      </div>
      <textarea
        v-model="messageContent"
        class="message-input"
        :placeholder="iBlocked ? '您已拉黑对方，请先解除拉黑...' : (isConsecutiveLimited ? '等待对方回复...' : '输入消息...')"
        rows="1"
        @keydown.enter.exact.prevent="sendMessage"
        @input="onMessageInput"
        @focus="showQuickReply = false; handleTypingInput()"
        @blur="sendTypingStatus(false)"
        ref="textareaRef"
        :disabled="isConsecutiveLimited || iBlocked"
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
            :disabled="!selectedGift || isSendingGift || iBlocked"
            :loading="isSendingGift"
            @click="handleSendGift"
          >
            {{ iBlocked ? '您已拉黑对方，无法赠送' : (selectedGift ? `赠送「${selectedGift.name}」` : '请选择礼物') }}
          </van-button>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="showProfilePopup" round position="bottom" :style="{ maxHeight: '80vh' }">
      <div class="profile-panel" v-if="profileUser">
        <div class="popup-header">
          <div class="popup-title">👤 用户信息</div>
          <van-icon name="cross" size="20" @click="showProfilePopup = false" />
        </div>
        <div class="profile-header">
          <AvatarDisplay :avatar="profileUser.avatar" :size="72" :avatarFrame="profileUser.avatarFrame" class="profile-avatar" />
          <div class="profile-info">
            <div class="profile-nickname-row">
              <span class="profile-nickname">{{ profileUser.nickname }}</span>
              <span class="gender-icon" v-if="profileUser.gender === '男'">♂</span>
              <span class="gender-icon gender-female" v-else-if="profileUser.gender === '女'">♀</span>
            </div>
            <div class="profile-title-row" v-if="profileUser.equippedTitle">
              <TitleBadge :title="profileUser.equippedTitle" size="small" />
            </div>
            <div class="profile-username" v-if="profileUser.username">@{{ profileUser.username }}</div>
            <div class="profile-user-id">ID: {{ profileUser.id }}</div>
          </div>
        </div>
        <div class="profile-section">
          <div class="profile-section-title">个人介绍</div>
          <div class="profile-bio" v-if="profileUser.bio">{{ profileUser.bio }}</div>
          <div class="profile-no-bio" v-else>这个人很懒，什么都没写</div>
        </div>
        <div class="profile-section" v-if="profileUser.created_at">
          <div class="profile-section-title">注册时间</div>
          <div class="profile-value">{{ formatProfileDate(profileUser.created_at) }}</div>
        </div>
        <div class="profile-footer" v-if="!isProfileSelf && otherUserId === profileUser.id">
          <div class="profile-footer-btns">
            <van-button
              v-if="!profileUser.iBlocked"
              type="danger"
              plain
              block
              round
              :loading="blockingUser"
              class="block-btn"
              @click="handleBlockUser"
            >
              <van-icon name="shield-o" size="14" />
              <span>拉黑对方</span>
            </van-button>
            <van-button
              v-else
              type="success"
              plain
              block
              round
              :loading="blockingUser"
              class="block-btn"
              @click="handleUnblockUser"
            >
              <van-icon name="passed" size="14" />
              <span>解除拉黑</span>
            </van-button>
            <van-button
              type="primary"
              block
              round
              :disabled="isFriend || hasPendingRequest || intimacyValue < 100 || profileUser.iBlocked || profileUser.blockedMe"
              :loading="addingFriend"
              @click="handleAddFriend"
              class="add-friend-footer-btn"
            >
              <template v-if="isFriend">已是好友</template>
              <template v-else-if="hasPendingRequest">已发送申请</template>
              <template v-else-if="profileUser.iBlocked">您已拉黑对方</template>
              <template v-else-if="profileUser.blockedMe">对方已拉黑您</template>
              <template v-else-if="intimacyValue < 100">亲密度需≥100 ({{ intimacyValue }}/100)</template>
              <template v-else>添加好友</template>
            </van-button>
          </div>
        </div>
        <div class="profile-footer" v-else-if="isProfileSelf">
          <div class="self-hint">这是你自己</div>
        </div>
      </div>
    </van-popup>

    <van-dialog
      v-model:show="showRequestDialog"
      title="添加好友"
      show-cancel-button
      confirm-button-text="发送"
      cancel-button-text="取消"
      @confirm="confirmSendRequest"
    >
      <div style="padding: 12px 0;">
        <div class="dialog-tip">给 <strong>{{ otherUser?.nickname || '对方' }}</strong> 发送好友申请</div>
        <van-field
          v-model="requestMessage"
          type="textarea"
          rows="3"
          placeholder="可以写点什么（选填）"
          maxlength="200"
          show-word-limit
          autosize
        />
      </div>
    </van-dialog>

    <div class="special-effect-overlay" v-if="showSpecialEffect" @click="closeSpecialEffect">
      <div class="effect-container">
        <div class="effect-gift-display">
          <div class="effect-gift-icon">{{ specialEffectData.giftIcon }}</div>
          <div class="effect-gift-name">{{ specialEffectData.giftName }}</div>
        </div>
        <div class="effect-particles">
          <span
            v-for="i in effectParticles"
            :key="i.id"
            class="particle"
            :style="i.style"
          >{{ i.emoji }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast, showDialog } from 'vant';
import { getUser } from '../utils/storage';
import { getMessages, sendMessage as apiSendMessage, getBottleDetail, getBackpackItems, sendChatGift, getIntimacy, getUserIntimacy, getUserProfile, sendFriendRequest, recallMessage, updateTypingStatus, getTypingStatus, uploadMessageImage, blockUser, unblockUser, checkBlockStatus, getMyChatSkins, getMyAvatarFrames } from '../api';
import AvatarDisplay from '../components/AvatarDisplay.vue';
import TitleBadge from '../components/TitleBadge.vue';

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
const showQuickReply = ref(false);
const activeQuickCategory = ref(0);
const intimacyValue = ref(0);
const isFriend = ref(false);
const hasPendingRequest = ref(false);
const showProfilePopup = ref(false);
const profileUser = ref(null);
const isProfileSelf = ref(false);
const showRequestDialog = ref(false);
const requestMessage = ref('');
const addingFriend = ref(false);
const showRecallMenu = ref(false);
const contextMenuMsgId = ref(null);
const contextMenuPos = ref({ top: 0, left: 0 });
const selectedMessage = ref(null);
const otherIsTyping = ref(false);
const iBlocked = ref(false);
const blockedMe = ref(false);
const isUploadingImage = ref(false);
const imageFileInput = ref(null);
const blockingUser = ref(false);
const showSpecialEffect = ref(false);
const specialEffectData = ref({ giftIcon: '', giftName: '', effectType: '' });
const effectParticles = ref([]);
const knownMessageIds = ref(new Set());
let specialEffectTimer = null;
let typingTimer = null;
let typingSendTimer = null;
let lastTypingSent = false;

const chatSkin = ref(null);
const myAvatarFrame = ref(null);
const otherAvatarFrame = ref(null);
const otherChatSkin = ref(null);

const CONSECUTIVE_LIMIT = 5;
const RECALL_WINDOW_MINUTES = 3;

function getSelfMsgSkinStyle() {
  if (!chatSkin.value) return {};
  const style = {};
  if (chatSkin.value.bubble_bg_mine) {
    style.background = chatSkin.value.bubble_bg_mine;
  }
  if (chatSkin.value.text_color_mine) {
    style.color = chatSkin.value.text_color_mine;
  }
  return style;
}

function getOtherMsgSkinStyle() {
  if (!otherChatSkin.value) return {};
  const style = {};
  if (otherChatSkin.value.bubble_bg_mine) {
    style.background = otherChatSkin.value.bubble_bg_mine;
  }
  if (otherChatSkin.value.text_color_mine) {
    style.color = otherChatSkin.value.text_color_mine;
  }
  return style;
}

const consecutiveCount = computed(() => {
  if (!currentUserId.value || messages.value.length === 0) return 0;
  let count = 0;
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].sender_id === currentUserId.value) {
      if (messages.value[i].is_blocked) {
        continue;
      }
      count++;
    } else {
      break;
    }
  }
  return count;
});

const isConsecutiveLimited = computed(() => {
  if (isFriend.value) return false;
  return consecutiveCount.value >= CONSECUTIVE_LIMIT;
});

const canRecallSelectedMsg = computed(() => {
  if (!selectedMessage.value) return false;
  if (selectedMessage.value.sender_id !== currentUserId.value) return false;
  if (selectedMessage.value.is_recalled) return false;
  const createdAt = new Date(selectedMessage.value.created_at).getTime();
  const now = Date.now();
  const diffMinutes = (now - createdAt) / (1000 * 60);
  return diffMinutes <= RECALL_WINDOW_MINUTES;
});

const recallDisabledReason = computed(() => {
  if (!selectedMessage.value) return '';
  if (selectedMessage.value.sender_id !== currentUserId.value) return '非本人消息';
  if (selectedMessage.value.is_recalled) return '已撤回';
  const createdAt = new Date(selectedMessage.value.created_at).getTime();
  const now = Date.now();
  const diffMinutes = (now - createdAt) / (1000 * 60);
  if (diffMinutes > RECALL_WINDOW_MINUTES) return '超过3分钟';
  return '';
});

const quickReplyCategories = [
  {
    name: '打招呼',
    messages: [
      '你好呀~',
      '嗨，很高兴认识你！',
      '哈喽，在吗？',
      '你好，看到你的消息了',
      'Hi~ 缘分让我们相遇',
      '你好呀，想和你聊聊'
    ]
  },
  {
    name: '心情',
    messages: [
      '我今天心情很好！',
      '今天有点累，想找人聊聊',
      '最近压力有点大...',
      '分享一件开心的小事给你',
      '今天遇到了很有趣的事',
      '突然想找个人说说话'
    ]
  },
  {
    name: '兴趣',
    messages: [
      '你平时喜欢做什么？',
      '有什么好看的剧推荐吗？',
      '最近在听什么歌？',
      '你喜欢旅游吗？',
      '平时喜欢看什么类型的电影？',
      '有什么爱好吗？'
    ]
  },
  {
    name: '晚安',
    messages: [
      '晚安，好梦~',
      '早点休息吧，晚安',
      '晚安，明天又是美好的一天',
      '愿你有个好梦，晚安',
      '很晚了，早点睡哦，晚安',
      '晚安，陌生人'
    ]
  }
];

let timer = null;

const canSend = computed(() => {
  return (messageContent.value.trim().length > 0 || pendingImageUrl.value) && otherUserId.value && !isConsecutiveLimited.value && !iBlocked.value;
});

const pendingImageUrl = ref(null);
const pendingImagePreview = ref(null);

onMounted(() => {
  currentUser.value = getUser();
  if (!currentUser.value) {
    showToast('用户信息异常，请刷新重试');
    router.back();
    return;
  }
  
  initChat();
  timer = setInterval(fetchMessages, 3000);
  typingTimer = setInterval(fetchTypingStatus, 2000);
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
  if (typingTimer) clearInterval(typingTimer);
  if (typingSendTimer) clearTimeout(typingSendTimer);
  sendTypingStatus(false);
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
    
    await Promise.all([fetchMessages(), fetchIntimacy(), fetchFriendStatus(), fetchBlockStatus(), fetchChatSkin(), fetchMyAvatarFrame(), fetchOtherUserSkin()]);
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    loading.value = false;
  }
}

async function fetchChatSkin() {
  try {
    const result = await getMyChatSkins();
    chatSkin.value = result.activeSkin || null;
  } catch (error) {
    console.error('获取聊天皮肤失败:', error);
  }
}

async function fetchMyAvatarFrame() {
  try {
    const result = await getMyAvatarFrames();
    myAvatarFrame.value = result.activeFrame || null;
  } catch (error) {
    console.error('获取头像框失败:', error);
  }
}

async function fetchOtherUserSkin() {
  if (!otherUserId.value) return;
  try {
    const profile = await getUserProfile(otherUserId.value);
    otherAvatarFrame.value = profile.avatarFrame || null;
    otherChatSkin.value = profile.chatSkin || null;
  } catch (error) {
    console.error('获取对方用户皮肤失败:', error);
  }
}

async function fetchBlockStatus() {
  if (!otherUserId.value) return;
  try {
    const result = await checkBlockStatus(otherUserId.value);
    iBlocked.value = result.iBlocked || false;
    blockedMe.value = result.blockedMe || false;
  } catch (error) {
    console.error('获取拉黑状态失败:', error);
  }
}

async function fetchFriendStatus() {
  if (!otherUserId.value) return;
  try {
    const profile = await getUserProfile(otherUserId.value);
    isFriend.value = profile.isFriend || false;
    hasPendingRequest.value = profile.hasPendingRequest || false;
  } catch (error) {
    console.error('获取好友状态失败:', error);
  }
}

async function fetchMessages() {
  try {
    const result = await getMessages(bottleId);
    const isFirstLoad = knownMessageIds.value.size === 0;
    const newIncoming = [];

    for (const msg of result) {
      if (!knownMessageIds.value.has(msg.id)) {
        if (!isFirstLoad && msg.sender_id !== currentUserId.value && isGiftMessage(msg)) {
          newIncoming.push(msg);
        }
        knownMessageIds.value.add(msg.id);
      }
    }

    messages.value = result;

    for (const msg of newIncoming) {
      const parsed = parseGiftContent(msg.content);
      if (parsed.isSpecialEffect && parsed.effectType) {
        triggerSpecialEffect(parsed.giftIcon, parsed.giftName, parsed.effectType);
        break;
      }
    }
  } catch (error) {
    console.error('获取消息失败:', error);
  }
}

async function fetchTypingStatus() {
  if (!bottleId) return;
  try {
    const result = await getTypingStatus(bottleId);
    otherIsTyping.value = result.isTyping || false;
  } catch (error) {
    console.error('获取打字状态失败:', error);
  }
}

async function sendTypingStatus(isTyping) {
  if (!bottleId) return;
  try {
    await updateTypingStatus(bottleId, isTyping);
    lastTypingSent = isTyping;
  } catch (error) {
    console.error('发送打字状态失败:', error);
  }
}

function handleTypingInput() {
  const hasContent = messageContent.value.trim().length > 0;
  if (hasContent && !lastTypingSent) {
    sendTypingStatus(true);
  }
  if (typingSendTimer) clearTimeout(typingSendTimer);
  typingSendTimer = setTimeout(() => {
    sendTypingStatus(false);
  }, 3000);
}

function showContextMenu(event, msg) {
  if (msg.sender_id !== currentUserId.value || msg.is_recalled) return;
  event.preventDefault();
  selectedMessage.value = msg;
  contextMenuMsgId.value = msg.id;
  const rect = event.target.getBoundingClientRect();
  contextMenuPos.value = {
    top: rect.top - 50,
    left: Math.max(10, rect.left - 40)
  };
  showRecallMenu.value = true;
}

function handleLongPress(msg) {
  if (msg.sender_id !== currentUserId.value || msg.is_recalled) return;
  selectedMessage.value = msg;
  contextMenuMsgId.value = msg.id;
  const msgIndex = messages.value.findIndex(m => m.id === msg.id);
  const approximateTop = 200 + msgIndex * 60;
  contextMenuPos.value = {
    top: approximateTop,
    left: window.innerWidth - 120
  };
  showRecallMenu.value = true;
}

function hideContextMenu() {
  showRecallMenu.value = false;
  contextMenuMsgId.value = null;
  selectedMessage.value = null;
}

async function handleRecallMessage() {
  if (!canRecallSelectedMsg.value || !selectedMessage.value) return;
  try {
    await showDialog({
      title: '确认撤回',
      message: '确定要撤回这条消息吗？',
      showCancelButton: true,
      confirmButtonText: '撤回',
      cancelButtonText: '取消'
    });
  } catch {
    hideContextMenu();
    return;
  }
  try {
    await recallMessage(selectedMessage.value.id);
    const msg = messages.value.find(m => m.id === selectedMessage.value.id);
    if (msg) {
      msg.is_recalled = 1;
      msg.recalled_at = new Date().toISOString();
    }
    showToast('撤回成功');
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '撤回失败');
  } finally {
    hideContextMenu();
  }
}

async function fetchIntimacy() {
  if (!otherUserId.value) return;
  try {
    const result = await getUserIntimacy(otherUserId.value);
    intimacyValue.value = result.intimacyValue || 0;
  } catch (error) {
    console.error('获取亲密值失败:', error);
  }
}

function onMessageInput() {
  adjustTextareaHeight();
  handleTypingInput();
}

async function sendMessage() {
  if (!canSend.value) return;

  isSending.value = true;
  sendTypingStatus(false);
  if (typingSendTimer) clearTimeout(typingSendTimer);

  try {
    const result = await apiSendMessage(
      bottleId,
      otherUserId.value,
      messageContent.value,
      pendingImageUrl.value,
      pendingImageUrl.value && !messageContent.value.trim() ? 'image' : 'text'
    );
    messages.value.push(result);
    if (!result.is_blocked) {
      intimacyValue.value += 1;
    } else {
      showToast('对方已拒收您的消息');
    }
    messageContent.value = '';
    pendingImageUrl.value = null;
    pendingImagePreview.value = null;
    resetTextareaHeight();
    scrollToBottom();
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '出现异常');
  } finally {
    isSending.value = false;
  }
}

function triggerImageSelect() {
  if (iBlocked.value) {
    showToast('您已拉黑对方，无法互动');
    return;
  }
  if (blockedMe.value) {
    showToast('对方已拉黑您，无法互动');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = handleImageSelect;
  input.click();
}

async function handleImageSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('图片大小不能超过5MB');
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('只支持 JPG、PNG、GIF、WebP 格式的图片');
    return;
  }

  isUploadingImage.value = true;

  const reader = new FileReader();
  reader.onload = (ev) => {
    pendingImagePreview.value = ev.target.result;
  };
  reader.readAsDataURL(file);

  try {
    const formData = new FormData();
    formData.append('image', file);
    const result = await uploadMessageImage(formData);
    pendingImageUrl.value = result.imageUrl;
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '图片上传失败');
    pendingImagePreview.value = null;
    pendingImageUrl.value = null;
  } finally {
    isUploadingImage.value = false;
  }
}

function removePendingImage() {
  pendingImageUrl.value = null;
  pendingImagePreview.value = null;
}

function isImageMessage(msg) {
  if (!msg) return false;
  if (msg.type === 'image') return true;
  if (msg.image_url && !msg.content) return true;
  return false;
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
          charmValue: parsed.charmValue || 0,
          isSpecialEffect: parsed.isSpecialEffect || false,
          effectType: parsed.effectType || null
        };
      }
    } catch {
      // ignore
    }
  }
  return { giftName: '未知礼物', giftIcon: '🎁', charmValue: 0, isSpecialEffect: false, effectType: null };
}

async function fetchGiftItems() {
  giftLoading.value = true;
  try {
    const items = await getBackpackItems();
    giftItems.value = items.filter(item => item.category === 'gift' || item.category === 'special_gift');
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

    intimacyValue.value += selectedGift.value.charmValue * 2;

    if (result.isSpecialEffect && result.effectType) {
      triggerSpecialEffect(result.giftIcon || selectedGift.value.icon, result.giftName || selectedGift.value.name, result.effectType);
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

const EFFECT_EMOJIS = {
  galaxy: ['✨', '⭐', '🌟', '💫', '🌠'],
  firework: ['🎆', '🎇', '💥', '✨', '🌟'],
  rose_rain: ['🌹', '🌸', '💐', '❤️', '💕'],
  meteor: ['☄️', '💫', '⭐', '✨', '🌠'],
  bubble: ['🫧', '💫', '✨', '🫧', '💧']
};

function triggerSpecialEffect(giftIcon, giftName, effectType) {
  specialEffectData.value = { giftIcon, giftName, effectType };
  showSpecialEffect.value = true;
  generateParticles(effectType);
  if (specialEffectTimer) clearTimeout(specialEffectTimer);
  specialEffectTimer = setTimeout(() => {
    closeSpecialEffect();
  }, 5000);
}

function generateParticles(effectType) {
  const emojis = EFFECT_EMOJIS[effectType] || EFFECT_EMOJIS.galaxy;
  const particles = [];
  for (let i = 0; i < 40; i++) {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const x = Math.random() * 100;
    const startY = effectType === 'rose_rain' ? -10 : Math.random() * 50;
    const endY = effectType === 'rose_rain' ? 110 : (effectType === 'meteor' ? 110 : -20);
    const size = 16 + Math.random() * 28;
    const duration = 2 + Math.random() * 3;
    const delay = Math.random() * 2;
    const leftDrift = -30 + Math.random() * 60;
    const rotation = Math.random() * 360;

    let animName = 'particleFall';
    if (effectType === 'galaxy') animName = 'particleTwinkle';
    if (effectType === 'meteor') animName = 'particleShoot';
    if (effectType === 'bubble') animName = 'particleFloat';
    if (effectType === 'firework') animName = 'particleBurst';

    particles.push({
      id: i,
      emoji,
      style: {
        left: x + '%',
        top: startY + '%',
        fontSize: size + 'px',
        animation: `${animName} ${duration}s ease-in-out ${delay}s infinite`,
        '--leftDrift': leftDrift + 'px',
        '--endY': endY + '%',
        '--rotation': rotation + 'deg'
      }
    });
  }
  effectParticles.value = particles;
}

function closeSpecialEffect() {
  showSpecialEffect.value = false;
  effectParticles.value = [];
  if (specialEffectTimer) {
    clearTimeout(specialEffectTimer);
    specialEffectTimer = null;
  }
}

function useQuickReply(msg) {
  messageContent.value = msg;
  showQuickReply.value = false;
  nextTick(() => {
    adjustTextareaHeight();
  });
}

async function showUserProfile(userId) {
  if (!userId) return;
  showProfilePopup.value = true;
  profileUser.value = null;
  isProfileSelf.value = userId === currentUserId.value;
  try {
    if (isProfileSelf.value) {
      profileUser.value = {
        ...currentUser.value,
        isFriend: false,
        hasPendingRequest: false
      };
    } else {
      const profile = await getUserProfile(userId);
      profileUser.value = profile;
      if (userId === otherUserId.value) {
        isFriend.value = profile.isFriend || false;
        hasPendingRequest.value = profile.hasPendingRequest || false;
      }
    }
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '获取用户信息失败');
    showProfilePopup.value = false;
  }
}

function handleAddFriend() {
  if (isFriend.value) {
    showToast('对方已经是你的好友了');
    return;
  }
  if (hasPendingRequest.value) {
    showToast('已发送过好友申请');
    return;
  }
  if (intimacyValue.value < 100) {
    showToast(`亲密度需达到100才能添加好友（当前：${intimacyValue.value}）`);
    return;
  }
  requestMessage.value = '';
  showRequestDialog.value = true;
}

async function confirmSendRequest() {
  if (!otherUserId.value) return;
  addingFriend.value = true;
  try {
    await sendFriendRequest(otherUserId.value, requestMessage.value.trim() || undefined);
    showToast('好友申请已发送');
    showRequestDialog.value = false;
    hasPendingRequest.value = true;
    if (profileUser.value && profileUser.value.id === otherUserId.value) {
      profileUser.value.hasPendingRequest = true;
    }
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '发送失败');
  } finally {
    addingFriend.value = false;
  }
}

function formatProfileDate(time) {
  if (!time) return '';
  const date = new Date(time);
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function handleBlockUser() {
  if (!otherUserId.value) return;
  try {
    await showDialog({
      title: '确认拉黑',
      message: `确定要拉黑「${otherUser.value?.nickname || '对方'}」吗？\n拉黑后将无法进行任何互动。`,
      showCancelButton: true,
      confirmButtonText: '确认拉黑',
      cancelButtonText: '取消',
      confirmButtonColor: '#ee0a24'
    });
  } catch {
    return;
  }
  try {
    blockingUser.value = true;
    await blockUser(otherUserId.value);
    iBlocked.value = true;
    if (profileUser.value && profileUser.value.id === otherUserId.value) {
      profileUser.value.iBlocked = true;
    }
    showToast('已拉黑对方');
    showProfilePopup.value = false;
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '拉黑失败');
  } finally {
    blockingUser.value = false;
  }
}

async function handleUnblockUser() {
  if (!otherUserId.value) return;
  try {
    blockingUser.value = true;
    await unblockUser(otherUserId.value);
    iBlocked.value = false;
    if (profileUser.value && profileUser.value.id === otherUserId.value) {
      profileUser.value.iBlocked = false;
    }
    showToast('已解除拉黑');
  } catch (error) {
    showToast(error.businessMessage || error.httpMessage || '解除拉黑失败');
  } finally {
    blockingUser.value = false;
  }
}

function previewImage(src) {
  if (!src) return;
  const fullSrc = src.startsWith('http') || src.startsWith('data:') ? src : src;
  const imgWindow = window.open('', '_blank');
  if (imgWindow) {
    imgWindow.document.write(`<img src="${fullSrc}" style="max-width:100%;display:block;margin:auto;" />`);
  }
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

.intimacy-display {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #fff0f5 0%, #ffe0ec 100%);
  border-radius: 14px;
  flex-shrink: 0;
}

.intimacy-heart {
  font-size: 14px;
  color: #ff4d6a;
  animation: heartbeat 1.5s ease-in-out infinite;
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.intimacy-value {
  font-size: 13px;
  font-weight: bold;
  color: #ff4d6a;
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
  justify-content: flex-end;
}

.message-item.is-mine .message-bubble {
  align-items: flex-end;
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

.consecutive-warning {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  margin: 8px 0;
  background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
  border-radius: 20px;
  font-size: 12px;
  color: #f57c00;
  text-align: center;
}

.consecutive-warning-icon {
  font-size: 14px;
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

.message-input:disabled {
  background: #f0f0f0;
  color: #999;
  cursor: not-allowed;
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
  background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
  border-radius: 16px;
  padding: 14px 16px;
  min-width: 200px;
}

.is-mine .gift-message {
  background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
}

.gift-label {
  font-size: 12px;
  color: #667eea;
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
  color: #667eea;
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

.quick-reply-chat-panel {
  background: #fff;
  border-top: 1px solid #eee;
  padding: 12px 16px 0;
}

.quick-reply-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.quick-reply-chat-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  flex: 1;
}

.quick-tab-chat {
  flex-shrink: 0;
  padding: 6px 12px;
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-tab-chat.active {
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.close-quick-btn {
  color: #999;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: 10px;
}

.quick-reply-chat-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 160px;
  overflow-y: auto;
  padding-bottom: 12px;
}

.quick-reply-chat-item {
  flex: 0 0 calc(50% - 4px);
  padding: 10px 12px;
  background: #f7f7f7;
  border: 1px solid #eee;
  border-radius: 8px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.quick-reply-chat-item:active {
  background: #667eea;
  color: #fff;
  transform: scale(0.98);
}

.quick-reply-chat-btn {
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

.quick-reply-chat-btn:active {
  background: #e8e8e8;
}

.quick-reply-chat-btn.active {
  background: #667eea20;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.add-friend-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 5px 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 14px;
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.add-friend-btn:active {
  opacity: 0.8;
}

.clickable-avatar {
  cursor: pointer;
  transition: transform 0.15s;
}

.clickable-avatar:active {
  transform: scale(0.95);
}

.chat-user-info {
  cursor: pointer;
}

.profile-panel {
  padding: 20px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 0 20px;
  border-bottom: 1px solid #f0f0f0;
}

.profile-avatar {
  font-size: 48px;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border-radius: 50%;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-nickname-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.profile-title-row {
  margin-bottom: 4px;
}

.profile-nickname {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.gender-icon {
  font-size: 16px;
  color: #4a9eff;
  font-weight: bold;
}

.gender-female {
  color: #ff6b9d;
}

.profile-username {
  font-size: 13px;
  color: #999;
  margin-bottom: 2px;
}

.profile-user-id {
  font-size: 11px;
  color: #bbb;
  word-break: break-all;
}

.profile-section {
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
}

.profile-section:last-of-type {
  border-bottom: none;
}

.profile-section-title {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.profile-bio {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.profile-no-bio {
  font-size: 13px;
  color: #bbb;
}

.profile-value {
  font-size: 14px;
  color: #333;
}

.profile-footer {
  padding-top: 20px;
}

.self-hint {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 10px;
}

.dialog-tip {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
  text-align: center;
}

.typing-status {
  color: #667eea;
}

.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-right: 4px;
}

.typing-dots span {
  width: 4px;
  height: 4px;
  background: #667eea;
  border-radius: 50%;
  animation: typingBounce 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typingBounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.recalled-message {
  max-width: 70%;
  padding: 8px 16px;
  background: transparent;
  border-radius: 16px;
  display: flex;
  align-items: center;
}

.recalled-other {
  justify-content: flex-start;
}

.recalled-mine {
  justify-content: flex-end;
}

.recalled-center {
  margin: 0 auto;
  max-width: 100%;
  justify-content: center;
}

.recalled-text {
  font-size: 12px;
  color: #999;
  font-style: italic;
  background: #f0f0f0;
  padding: 6px 14px;
  border-radius: 12px;
}

.message-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 0 4px;
}

.message-read-status {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  opacity: 0.6;
  height: 16px;
}

.message-read-status.read {
  opacity: 1;
}

.read-icon-single {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
}

.read-double-check {
  display: inline-flex;
  align-items: center;
  position: relative;
  height: 16px;
}

.read-double-check .van-icon {
  color: #7ed6ff;
  font-size: 12px;
}

.read-double-check .double-second {
  margin-left: -6px;
}

.bubble-contextmenu {
  box-shadow: 0 0 0 2px #667eea40;
}

.context-menu-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
}

.context-menu {
  position: fixed;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 100px;
  z-index: 2001;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.context-menu-item:active {
  background: #f5f5f5;
}

.context-menu-item.recall-item {
  color: #ff4d4f;
}

.context-menu-item.disabled {
  color: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.recall-tip {
  font-size: 11px;
  color: #ccc;
  margin-left: 4px;
}

.blocked-warning {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  margin: 8px 16px;
  background: linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%);
  border-radius: 10px;
  font-size: 12px;
  color: #cf1322;
  text-align: center;
}

.pending-image-panel {
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #f0f0f0;
}

.pending-image-wrap {
  position: relative;
  display: inline-block;
}

.pending-image-preview {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #eee;
}

.pending-image-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  font-size: 12px;
}

.pending-image-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  background: #ff4d4f;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.image-btn {
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

.image-btn:active {
  background: #e8e8e8;
}

.image-btn.disabled,
.gift-btn.disabled,
.quick-reply-chat-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message-image {
  max-width: 200px;
  max-height: 260px;
  border-radius: 12px;
  cursor: pointer;
  display: block;
}

.image-bubble .message-content,
.image-bubble-mine .message-content {
  padding: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.is-mine .image-bubble-mine .message-image {
  border: 2px solid #667eea;
}

.image-bubble .message-image {
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.blocked-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 6px;
  font-size: 12px;
  color: #ff4d4f;
  flex-shrink: 0;
  align-self: flex-end;
  margin-bottom: 4px;
}

.blocked-icon {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.message-item.is-mine {
  flex-direction: row;
}

.msg-blocked {
  opacity: 0.85;
}

.profile-footer-btns {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.block-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.add-friend-footer-btn {
  margin-top: 0 !important;
}

.special-effect-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: overlayFadeIn 0.3s ease-out;
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.effect-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.effect-gift-display {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 10;
  animation: giftDisplayPop 0.5s ease-out;
}

@keyframes giftDisplayPop {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  60% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

.effect-gift-icon {
  font-size: 100px;
  animation: giftIconPulse 1.5s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(255, 107, 157, 0.8));
}

@keyframes giftIconPulse {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(255, 107, 157, 0.8)); }
  50% { transform: scale(1.2); filter: drop-shadow(0 0 40px rgba(255, 107, 157, 1)); }
}

.effect-gift-name {
  color: #fff;
  font-size: 24px;
  font-weight: bold;
  margin-top: 16px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  animation: giftNameGlow 1.5s ease-in-out infinite alternate;
}

@keyframes giftNameGlow {
  from { text-shadow: 0 2px 8px rgba(255, 107, 157, 0.5); }
  to { text-shadow: 0 2px 20px rgba(255, 107, 157, 1), 0 0 40px rgba(255, 215, 0, 0.5); }
}

.effect-particles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.particle {
  position: absolute;
  pointer-events: none;
  will-change: transform, opacity;
}

@keyframes particleFall {
  0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(calc(100vh)) translateX(var(--leftDrift)) rotate(var(--rotation)); opacity: 0; }
}

@keyframes particleTwinkle {
  0%, 100% { transform: translateY(0) scale(0.5); opacity: 0.3; }
  50% { transform: translateY(-20px) scale(1.5); opacity: 1; }
}

@keyframes particleShoot {
  0% { transform: translateY(0) translateX(0) scale(1); opacity: 1; }
  100% { transform: translateY(calc(80vh)) translateX(var(--leftDrift)) scale(0.3); opacity: 0; }
}

@keyframes particleFloat {
  0% { transform: translateY(0) scale(0.8); opacity: 0.8; }
  50% { transform: translateY(-30px) scale(1.2); opacity: 1; }
  100% { transform: translateY(-60px) scale(0.5); opacity: 0; }
}

@keyframes particleBurst {
  0% { transform: translate(0, 0) scale(0); opacity: 1; }
  50% { opacity: 1; }
  100% { transform: translate(var(--leftDrift), calc(var(--endY) - 50%)) scale(1); opacity: 0; }
}

.special-gift-message {
  background: linear-gradient(135deg, #667eea20 0%, #764ba220 50%, #ff6b9d15 100%) !important;
  border: 1px solid #667eea40;
}

.is-mine .special-gift-message {
  background: linear-gradient(135deg, #667eea20 0%, #764ba220 50%, #ff6b9d15 100%) !important;
  border: 1px solid #667eea40;
}

.special-effect-bubble {
  box-shadow: 0 0 12px rgba(102, 126, 234, 0.3);
}

.special-gift-icon-anim {
  animation: specialGiftIconBounce 1s ease-in-out infinite;
}

@keyframes specialGiftIconBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
</style>
