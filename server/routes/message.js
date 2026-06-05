const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('../utils/helper');

router.get('/:bottleId', async (req, res) => {
  try {
    const { bottleId } = req.params;
    const userId = req.user.userId;

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [bottleRows] = await pool.execute(
      'SELECT picker_id, picker_deleted_at FROM bottles WHERE id = ?',
      [bottleId]
    );

    let pickerDeletedAt = null;
    if (bottleRows.length > 0 && bottleRows[0].picker_id === userId && bottleRows[0].picker_deleted_at) {
      pickerDeletedAt = bottleRows[0].picker_deleted_at;
    }

    let query = 
      'SELECT m.id, m.bottle_id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at, ' +
      'u.nickname as sender_nickname, u.avatar as sender_avatar ' +
      'FROM messages m ' +
      'LEFT JOIN users u ON m.sender_id = u.id ' +
      'WHERE m.bottle_id = ? AND (m.sender_id = ? OR m.receiver_id = ?)';

    const params = [bottleId, userId, userId];

    if (pickerDeletedAt) {
      query += ' AND m.created_at > ?';
      params.push(pickerDeletedAt);
    }

    query += ' ORDER BY m.created_at ASC';

    const [messages] = await pool.execute(query, params);

    await pool.execute(
      'UPDATE messages SET is_read = 1 WHERE bottle_id = ? AND receiver_id = ? AND is_read = 0' +
      (pickerDeletedAt ? ' AND created_at > ?' : ''),
      pickerDeletedAt ? [bottleId, userId, pickerDeletedAt] : [bottleId, userId]
    );

    res.json(generateResponse(true, messages, '获取消息成功'));
  } catch (error) {
    console.error('获取消息失败:', error);
    res.status(500).json(generateResponse(false, null, '获取消息失败'));
  }
});

router.post('/send', async (req, res) => {
  try {
    const { bottleId, receiverId, content } = req.body;
    const senderId = req.user.userId;

    if (!bottleId || !receiverId || !content || content.trim().length === 0) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const messageId = generateUUID();

    await pool.execute(
      'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?, ?)',
      [messageId, bottleId, senderId, receiverId, content.trim()]
    );

    const [message] = await pool.execute(
      'SELECT m.id, m.bottle_id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at, ' +
      'u.nickname as sender_nickname, u.avatar as sender_avatar ' +
      'FROM messages m ' +
      'LEFT JOIN users u ON m.sender_id = u.id ' +
      'WHERE m.id = ?',
      [messageId]
    );

    res.json(generateResponse(true, message[0], '消息发送成功'));
  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(500).json(generateResponse(false, null, '发送消息失败'));
  }
});

router.get('/unread', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [count] = await pool.execute(
      'SELECT COUNT(*) as unread_count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [userId]
    );

    res.json(generateResponse(true, {
      unreadCount: count[0].unread_count
    }, '获取未读消息数成功'));
  } catch (error) {
    console.error('获取未读消息数失败:', error);
    res.status(500).json(generateResponse(false, null, '获取未读消息数失败'));
  }
});

module.exports = router;
