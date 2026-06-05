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
