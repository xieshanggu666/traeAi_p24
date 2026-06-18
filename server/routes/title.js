const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateResponse } = require('../utils/helper');
const {
  getAllTitles,
  getUserTitles,
  getEquippedTitle,
  equipTitle,
  unequipTitle,
  hasTitle,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  checkAchievementTitles
} = require('../utils/titleManager');

router.get('/list', async (req, res) => {
  try {
    const titles = await getAllTitles();
    res.json(generateResponse(true, titles, '获取称号列表成功'));
  } catch (error) {
    console.error('获取称号列表失败:', error);
    res.status(500).json(generateResponse(false, null, '获取称号列表失败'));
  }
});

router.get('/mine', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userTitles = await getUserTitles(userId);
    const equippedTitle = await getEquippedTitle(userId);
    
    res.json(generateResponse(true, {
      titles: userTitles,
      equipped: equippedTitle
    }, '获取我的称号成功'));
  } catch (error) {
    console.error('获取我的称号失败:', error);
    res.status(500).json(generateResponse(false, null, '获取我的称号失败'));
  }
});

router.get('/equipped', async (req, res) => {
  try {
    const userId = req.user.userId;
    const equippedTitle = await getEquippedTitle(userId);
    
    res.json(generateResponse(true, equippedTitle, '获取当前佩戴称号成功'));
  } catch (error) {
    console.error('获取当前佩戴称号失败:', error);
    res.status(500).json(generateResponse(false, null, '获取当前佩戴称号失败'));
  }
});

router.post('/equip/:titleId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { titleId } = req.params;
    
    const hasUserTitle = await hasTitle(userId, titleId);
    if (!hasUserTitle) {
      return res.status(400).json(generateResponse(false, null, '你尚未获得该称号'));
    }
    
    const title = await equipTitle(userId, titleId);
    
    res.json(generateResponse(true, title, '佩戴成功'));
  } catch (error) {
    console.error('佩戴称号失败:', error);
    res.status(500).json(generateResponse(false, null, error.message || '佩戴失败'));
  }
});

router.post('/unequip/:titleId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { titleId } = req.params;
    
    await unequipTitle(userId, titleId);
    
    res.json(generateResponse(true, null, '卸下成功'));
  } catch (error) {
    console.error('卸下称号失败:', error);
    res.status(500).json(generateResponse(false, null, '卸下失败'));
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    
    const result = await getNotifications(userId, page, pageSize);
    
    res.json(generateResponse(true, result, '获取通知成功'));
  } catch (error) {
    console.error('获取通知失败:', error);
    res.status(500).json(generateResponse(false, null, '获取通知失败'));
  }
});

router.get('/notifications/unread-count', async (req, res) => {
  try {
    const userId = req.user.userId;
    const count = await getUnreadNotificationCount(userId);
    
    res.json(generateResponse(true, { count }, '获取未读通知数成功'));
  } catch (error) {
    console.error('获取未读通知数失败:', error);
    res.status(500).json(generateResponse(false, null, '获取失败'));
  }
});

router.post('/notifications/:id/read', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    await markNotificationRead(userId, id);
    
    res.json(generateResponse(true, null, '标记已读成功'));
  } catch (error) {
    console.error('标记已读失败:', error);
    res.status(500).json(generateResponse(false, null, '标记失败'));
  }
});

router.post('/notifications/read-all', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    await markAllNotificationsRead(userId);
    
    res.json(generateResponse(true, null, '全部已读成功'));
  } catch (error) {
    console.error('全部已读失败:', error);
    res.status(500).json(generateResponse(false, null, '操作失败'));
  }
});

router.post('/check-achievements', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const newTitles = await checkAchievementTitles(userId);
    
    res.json(generateResponse(true, { newTitles }, '检查成就称号成功'));
  } catch (error) {
    console.error('检查成就称号失败:', error);
    res.status(500).json(generateResponse(false, null, '检查失败'));
  }
});

router.get('/user/:userId/title', async (req, res) => {
  try {
    const { userId } = req.params;
    const equippedTitle = await getEquippedTitle(userId);
    
    res.json(generateResponse(true, equippedTitle, '获取用户称号成功'));
  } catch (error) {
    console.error('获取用户称号失败:', error);
    res.status(500).json(generateResponse(false, null, '获取失败'));
  }
});

module.exports = router;
