import request from '../utils/request';

export const register = (username, password) => {
  return request.post('/user/register', { username, password });
};

export const login = (username, password) => {
  return request.post('/user/login', { username, password });
};

export const getUserInfo = () => {
  return request.get('/user/info');
};

export const updateProfile = (data) => {
  return request.put('/user/profile', data);
};

export const uploadAvatar = (formData) => {
  return request.post('/user/upload-avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000
  });
};

export const logout = () => {
  return request.post('/user/logout');
};

export const uploadBottleImage = (formData) => {
  return request.post('/bottle/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000
  });
};

export const throwBottle = (data) => {
  return request.post('/bottle/throw', data);
};

export const pickBottle = (filters) => {
  return request.post('/bottle/pick', { filters });
};

export const getFilteredBottleCount = (filters) => {
  return request.post('/bottle/pick/count', filters);
};

export const returnBottle = (bottleId) => {
  return request.post('/bottle/return', { bottleId });
};

export const replyBottle = (bottleId, content) => {
  return request.post('/bottle/reply', { bottleId, content });
};

export const getMyBottles = () => {
  return request.get('/bottle/my');
};

export const getBottleDetail = (bottleId) => {
  return request.get(`/bottle/${bottleId}`);
};

export const getMessages = (bottleId) => {
  return request.get(`/message/${bottleId}`);
};

export const sendMessage = (bottleId, receiverId, content, imageUrl, type) => {
  return request.post('/message/send', { bottleId, receiverId, content, imageUrl, type });
};

export const uploadMessageImage = (formData) => {
  return request.post('/message/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000
  });
};

export const getUnreadCount = () => {
  return request.get('/message/unread');
};

export const recallMessage = (messageId) => {
  return request.post(`/message/recall/${messageId}`);
};

export const updateTypingStatus = (bottleId, isTyping) => {
  return request.post('/message/typing', { bottleId, isTyping });
};

export const getTypingStatus = (bottleId) => {
  return request.get(`/message/typing/${bottleId}`);
};

export const deleteBottle = (bottleId) => {
  return request.delete(`/bottle/${bottleId}`);
};

export const softDeleteBottle = (bottleId) => {
  return request.post(`/bottle/soft-delete/${bottleId}`);
};

export const recallBottle = (bottleId) => {
  return request.post(`/bottle/recall/${bottleId}`);
};

export const pinBottle = (bottleId) => {
  return request.post(`/bottle/pin/${bottleId}`);
};

export const getWelfareInfo = () => {
  return request.get('/welfare/info');
};

export const getCoinRecords = (page = 1, pageSize = 20) => {
  return request.get('/welfare/records', { params: { page, pageSize } });
};

export const checkin = () => {
  return request.post('/welfare/checkin');
};

export const getCheckinStatus = (year, month) => {
  return request.get('/welfare/checkin-status', { params: { year, month } });
};

export const claimGift = (giftDays) => {
  return request.post('/welfare/claim-gift', { giftDays });
};

export const getTasks = () => {
  return request.get('/welfare/tasks');
};

export const claimTask = (taskKey) => {
  return request.post('/welfare/claim-task', { taskKey });
};

export const getDailyLimits = () => {
  return request.get('/bottle/daily-limits');
};

export const reportUsage = (seconds) => {
  return request.post('/welfare/report-usage', { seconds });
};

export const getShopProducts = () => {
  return request.get('/shop/products');
};

export const buyProduct = (itemKey) => {
  return request.post('/shop/buy', { itemKey });
};

export const getBackpackItems = () => {
  return request.get('/shop/items');
};

export const useRetroCard = (date) => {
  return request.post('/shop/use-retro-card', { date });
};

export const useThrowCard = () => {
  return request.post('/shop/use-throw-card');
};

export const usePickCard = () => {
  return request.post('/shop/use-pick-card');
};

export const getGiftInfo = () => {
  return request.get('/shop/gift-info');
};

export const sendGift = (receiverId, giftKey) => {
  return request.post('/shop/send-gift', { receiverId, giftKey });
};

export const searchUsers = (keyword) => {
  return request.get('/shop/users/search', { params: { keyword } });
};

export const sendChatGift = (bottleId, receiverId, giftKey) => {
  return request.post('/shop/send-chat-gift', { bottleId, receiverId, giftKey });
};

export const getIntimacy = (bottleId) => {
  return request.get(`/message/intimacy/${bottleId}`);
};

export const getUserIntimacy = (otherUserId) => {
  return request.get(`/message/intimacy/user/${otherUserId}`);
};

export const getSendLimit = (bottleId) => {
  return request.get(`/message/send-limit/${bottleId}`);
};

export const searchFriendUsers = (keyword) => {
  return request.get('/user/search', { params: { keyword } });
};

export const getUserProfile = (userId) => {
  return request.get(`/user/profile/${userId}`);
};

export const sendFriendRequest = (receiverId, message) => {
  return request.post('/user/friend/request', { receiverId, message });
};

export const acceptFriendRequest = (requestId) => {
  return request.post(`/user/friend/accept/${requestId}`);
};

export const rejectFriendRequest = (requestId) => {
  return request.post(`/user/friend/reject/${requestId}`);
};

export const getFriends = () => {
  return request.get('/user/friends');
};

export const getFriendRequests = () => {
  return request.get('/user/friend/requests');
};

export const deleteFriend = (friendId) => {
  return request.delete(`/user/friend/${friendId}`);
};

export const getSkins = () => {
  return request.get('/shop/skins');
};

export const buySkin = (skinId, duration) => {
  return request.post('/shop/skins/buy', { skinId, duration });
};

export const getMySkins = () => {
  return request.get('/shop/skins/mine');
};

export const useSkin = (skinId) => {
  return request.post('/shop/skins/use', { skinId });
};

export const blockUser = (blockedUserId) => {
  return request.post(`/user/blacklist/${blockedUserId}`);
};

export const unblockUser = (blockedUserId) => {
  return request.delete(`/user/blacklist/${blockedUserId}`);
};

export const getBlacklist = () => {
  return request.get('/user/blacklist');
};

export const checkBlockStatus = (otherUserId) => {
  return request.get(`/user/blacklist/check/${otherUserId}`);
};

export const getAvatarFrames = () => {
  return request.get('/shop/avatar-frames');
};

export const buyAvatarFrame = (frameId) => {
  return request.post('/shop/avatar-frames/buy', { frameId });
};

export const useAvatarFrame = (frameId) => {
  return request.post('/shop/avatar-frames/use', { frameId });
};

export const getMyAvatarFrames = () => {
  return request.get('/shop/avatar-frames/mine');
};

export const getChatSkins = () => {
  return request.get('/shop/chat-skins');
};

export const buyChatSkin = (skinId) => {
  return request.post('/shop/chat-skins/buy', { skinId });
};

export const useChatSkin = (skinId) => {
  return request.post('/shop/chat-skins/use', { skinId });
};

export const getMyChatSkins = () => {
  return request.get('/shop/chat-skins/mine');
};

export const getWealthRank = () => {
  return request.get('/user/rank/wealth');
};

export const getCharmRank = () => {
  return request.get('/user/rank/charm');
};

export const getTitles = () => {
  return request.get('/title/list');
};

export const getMyTitles = () => {
  return request.get('/title/mine');
};

export const getEquippedTitle = () => {
  return request.get('/title/equipped');
};

export const equipTitle = (titleId) => {
  return request.post(`/title/equip/${titleId}`);
};

export const unequipTitle = (titleId) => {
  return request.post(`/title/unequip/${titleId}`);
};

export const getNotifications = (page = 1, pageSize = 20) => {
  return request.get('/title/notifications', { params: { page, pageSize } });
};

export const getUnreadNotificationCount = () => {
  return request.get('/title/notifications/unread-count');
};

export const markNotificationRead = (id) => {
  return request.post(`/title/notifications/${id}/read`);
};

export const markAllNotificationsRead = () => {
  return request.post('/title/notifications/read-all');
};

export const checkAchievementTitles = () => {
  return request.post('/title/check-achievements');
};

export const getUserTitle = (userId) => {
  return request.get(`/title/user/${userId}/title`);
};
