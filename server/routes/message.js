const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('../utils/helper');

let hasTypeColumn = null;

async function checkTypeColumn() {
  if (hasTypeColumn !== null) return hasTypeColumn;
  try {
    await pool.execute('SELECT type FROM messages LIMIT 0');
    hasTypeColumn = true;
  } catch {
    hasTypeColumn = false;
  }
  return hasTypeColumn;
}

let hasIntimacyTable = null;

async function checkIntimacyTable() {
  if (hasIntimacyTable !== null) return hasIntimacyTable;
  try {
    await pool.execute('SELECT 1 FROM bottle_intimacy LIMIT 0');
    hasIntimacyTable = true;
  } catch {
    hasIntimacyTable = false;
  }
  return hasIntimacyTable;
}

async function ensureIntimacy(bottleId) {
  const [rows] = await pool.execute(
    'SELECT id FROM bottle_intimacy WHERE bottle_id = ?',
    [bottleId]
  );
  if (rows.length === 0) {
    const id = generateUUID();
    await pool.execute(
      'INSERT INTO bottle_intimacy (id, bottle_id, intimacy_value) VALUES (?, ?, 0)',
      [id, bottleId]
    );
  }
}

async function addIntimacy(bottleId, amount) {
  const tableExists = await checkIntimacyTable();
  if (!tableExists) return;
  await ensureIntimacy(bottleId);
  await pool.execute(
    'UPDATE bottle_intimacy SET intimacy_value = intimacy_value + ? WHERE bottle_id = ?',
    [amount, bottleId]
  );
}

async function getConsecutiveCount(bottleId, userId) {
  const [msgs] = await pool.execute(
    'SELECT sender_id FROM messages WHERE bottle_id = ? ORDER BY created_at DESC LIMIT 10',
    [bottleId]
  );
  let count = 0;
  for (const msg of msgs) {
    if (msg.sender_id === userId) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

const CONSECUTIVE_LIMIT = 5;

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

    const typeCol = await checkTypeColumn();
    const selectType = typeCol ? ', m.type' : '';

    let query = 
      'SELECT m.id, m.bottle_id, m.sender_id, m.receiver_id, m.content' + selectType + ', m.is_read, m.created_at, ' +
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

    const consecutiveCount = await getConsecutiveCount(bottleId, senderId);
    if (consecutiveCount >= CONSECUTIVE_LIMIT) {
      return res.status(429).json(generateResponse(false, null, '对方尚未回复，请等待对方回复后再发送消息'));
    }

    const messageId = generateUUID();
    const type = req.body.type || 'text';
    const typeCol = await checkTypeColumn();

    if (typeCol) {
      await pool.execute(
        'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content, type) VALUES (?, ?, ?, ?, ?, ?)',
        [messageId, bottleId, senderId, receiverId, content.trim(), type]
      );
    } else {
      await pool.execute(
        'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?, ?)',
        [messageId, bottleId, senderId, receiverId, content.trim()]
      );
    }

    await addIntimacy(bottleId, 1);

    const selectType = typeCol ? ', m.type' : '';
    const [message] = await pool.execute(
      'SELECT m.id, m.bottle_id, m.sender_id, m.receiver_id, m.content' + selectType + ', m.is_read, m.created_at, ' +
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

router.get('/intimacy/:bottleId', async (req, res) => {
  try {
    const { bottleId } = req.params;
    const userId = req.user.userId;

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const tableExists = await checkIntimacyTable();
    if (!tableExists) {
      return res.json(generateResponse(true, { intimacyValue: 0 }, '获取成功'));
    }

    const [rows] = await pool.execute(
      'SELECT intimacy_value FROM bottle_intimacy WHERE bottle_id = ?',
      [bottleId]
    );

    res.json(generateResponse(true, {
      intimacyValue: rows.length > 0 ? rows[0].intimacy_value : 0
    }, '获取成功'));
  } catch (error) {
    console.error('获取亲密值失败:', error);
    res.status(500).json(generateResponse(false, null, '获取亲密值失败'));
  }
});

router.get('/send-limit/:bottleId', async (req, res) => {
  try {
    const { bottleId } = req.params;
    const userId = req.user.userId;

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const consecutiveCount = await getConsecutiveCount(bottleId, userId);
    const canSend = consecutiveCount < CONSECUTIVE_LIMIT;

    res.json(generateResponse(true, {
      consecutiveCount,
      limit: CONSECUTIVE_LIMIT,
      canSend,
      remaining: Math.max(0, CONSECUTIVE_LIMIT - consecutiveCount)
    }, '获取成功'));
  } catch (error) {
    console.error('获取发送限制失败:', error);
    res.status(500).json(generateResponse(false, null, '获取发送限制失败'));
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
