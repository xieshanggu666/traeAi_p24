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

let hasUserIntimacyTable = null;

async function checkUserIntimacyTable() {
  if (hasUserIntimacyTable !== null) return hasUserIntimacyTable;
  try {
    await pool.execute('SELECT 1 FROM user_intimacy LIMIT 0');
    hasUserIntimacyTable = true;
  } catch {
    hasUserIntimacyTable = false;
  }
  return hasUserIntimacyTable;
}

function normalizeUserPair(userIdA, userIdB) {
  if (userIdA < userIdB) {
    return { user_id1: userIdA, user_id2: userIdB };
  }
  return { user_id1: userIdB, user_id2: userIdA };
}

async function getBottleUserPair(bottleId) {
  const [rows] = await pool.execute(
    'SELECT sender_id, picker_id FROM bottles WHERE id = ?',
    [bottleId]
  );
  if (rows.length === 0) return null;
  const { sender_id, picker_id } = rows[0];
  if (!sender_id || !picker_id) return null;
  return normalizeUserPair(sender_id, picker_id);
}

async function ensureUserIntimacy(userIdA, userIdB) {
  const { user_id1, user_id2 } = normalizeUserPair(userIdA, userIdB);
  const [rows] = await pool.execute(
    'SELECT id FROM user_intimacy WHERE user_id1 = ? AND user_id2 = ?',
    [user_id1, user_id2]
  );
  if (rows.length === 0) {
    const id = generateUUID();
    await pool.execute(
      'INSERT INTO user_intimacy (id, user_id1, user_id2, intimacy_value) VALUES (?, ?, ?, 0)',
      [id, user_id1, user_id2]
    );
  }
}

async function addIntimacyByUserPair(userIdA, userIdB, amount) {
  const tableExists = await checkUserIntimacyTable();
  if (!tableExists) return;
  await ensureUserIntimacy(userIdA, userIdB);
  const { user_id1, user_id2 } = normalizeUserPair(userIdA, userIdB);
  await pool.execute(
    'UPDATE user_intimacy SET intimacy_value = intimacy_value + ? WHERE user_id1 = ? AND user_id2 = ?',
    [amount, user_id1, user_id2]
  );
}

async function addIntimacy(bottleId, amount) {
  const pair = await getBottleUserPair(bottleId);
  if (!pair) return;
  await addIntimacyByUserPair(pair.user_id1, pair.user_id2, amount);
}

async function getIntimacyByUserPair(userIdA, userIdB) {
  const tableExists = await checkUserIntimacyTable();
  if (!tableExists) return 0;
  const { user_id1, user_id2 } = normalizeUserPair(userIdA, userIdB);
  const [rows] = await pool.execute(
    'SELECT intimacy_value FROM user_intimacy WHERE user_id1 = ? AND user_id2 = ?',
    [user_id1, user_id2]
  );
  return rows.length > 0 ? rows[0].intimacy_value : 0;
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

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const pair = await getBottleUserPair(bottleId);
    if (!pair) {
      return res.json(generateResponse(true, { intimacyValue: 0 }, '获取成功'));
    }

    const intimacyValue = await getIntimacyByUserPair(pair.user_id1, pair.user_id2);

    res.json(generateResponse(true, { intimacyValue }, '获取成功'));
  } catch (error) {
    console.error('获取亲密值失败:', error);
    res.status(500).json(generateResponse(false, null, '获取亲密值失败'));
  }
});

router.get('/intimacy/user/:otherUserId', async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.user.userId;

    if (!otherUserId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const intimacyValue = await getIntimacyByUserPair(userId, otherUserId);

    res.json(generateResponse(true, { intimacyValue }, '获取成功'));
  } catch (error) {
    console.error('获取用户亲密值失败:', error);
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
