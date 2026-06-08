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

export const throwBottle = (content) => {
  return request.post('/bottle/throw', { content });
};

export const pickBottle = () => {
  return request.post('/bottle/pick');
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

export const sendMessage = (bottleId, receiverId, content) => {
  return request.post('/message/send', { bottleId, receiverId, content });
};

export const getUnreadCount = () => {
  return request.get('/message/unread');
};

export const deleteBottle = (bottleId) => {
  return request.delete(`/bottle/${bottleId}`);
};

export const softDeleteBottle = (bottleId) => {
  return request.post(`/bottle/soft-delete/${bottleId}`);
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
