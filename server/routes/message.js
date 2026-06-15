const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('../utils/helper');
const { isBlockedBy, hasBlocked } = require('./user');

const messageImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads', 'messages'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.userId}-${Date.now()}${ext}`);
  }
});

const messageImageUpload = multer({
  storage: messageImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG、PNG、GIF、WebP 格式的图片'));
    }
  }
});

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

let hasRecalledColumn = null;

async function checkRecalledColumn() {
  if (hasRecalledColumn !== null) return hasRecalledColumn;
  try {
    await pool.execute('SELECT is_recalled FROM messages LIMIT 0');
    hasRecalledColumn = true;
  } catch {
    hasRecalledColumn = false;
  }
  return hasRecalledColumn;
}

let hasImageUrlColumn = null;

async function checkImageUrlColumn() {
  if (hasImageUrlColumn !== null) return hasImageUrlColumn;
  try {
    await pool.execute('SELECT image_url FROM messages LIMIT 0');
    hasImageUrlColumn = true;
  } catch {
    hasImageUrlColumn = false;
  }
  return hasImageUrlColumn;
}

let hasIsBlockedColumn = null;

async function checkIsBlockedColumn() {
  if (hasIsBlockedColumn !== null) return hasIsBlockedColumn;
  try {
    await pool.execute('SELECT is_blocked FROM messages LIMIT 0');
    hasIsBlockedColumn = true;
  } catch {
    hasIsBlockedColumn = false;
  }
  return hasIsBlockedColumn;
}

let hasTypingStatusTable = null;

async function checkTypingStatusTable() {
  if (hasTypingStatusTable !== null) return hasTypingStatusTable;
  try {
    await pool.execute('SELECT 1 FROM typing_status LIMIT 0');
    hasTypingStatusTable = true;
  } catch {
    hasTypingStatusTable = false;
  }
  return hasTypingStatusTable;
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
    const recalledCol = await checkRecalledColumn();
    const imageUrlCol = await checkImageUrlColumn();
    const isBlockedCol = await checkIsBlockedColumn();
    const selectType = typeCol ? ', m.type' : '';
    const selectRecalled = recalledCol ? ', m.is_recalled, m.recalled_at' : '';
    const selectImageUrl = imageUrlCol ? ', m.image_url' : '';
    const selectIsBlocked = isBlockedCol ? ', m.is_blocked' : '';

    let query = 
      'SELECT m.id, m.bottle_id, m.sender_id, m.receiver_id, m.content' + selectImageUrl + selectType + ', m.is_read' + selectRecalled + selectIsBlocked + ', m.created_at, ' +
      'u.nickname as sender_nickname, u.avatar as sender_avatar ' +
      'FROM messages m ' +
      'LEFT JOIN users u ON m.sender_id = u.id ' +
      'WHERE m.bottle_id = ? AND (m.sender_id = ? OR m.receiver_id = ?)';

    const params = [bottleId, userId, userId];

    if (isBlockedCol) {
      query += ' AND NOT (m.receiver_id = ? AND m.is_blocked = 1)';
      params.push(userId);
    }

    if (pickerDeletedAt) {
      query += ' AND m.created_at > ?';
      params.push(pickerDeletedAt);
    }

    await pool.execute(
      'UPDATE messages SET is_read = 1 WHERE bottle_id = ? AND receiver_id = ? AND is_read = 0' +
      (isBlockedCol ? ' AND is_blocked = 0' : '') +
      (pickerDeletedAt ? ' AND created_at > ?' : ''),
      pickerDeletedAt ? [bottleId, userId, pickerDeletedAt] : [bottleId, userId]
    );

    query += ' ORDER BY m.created_at ASC';

    const [messages] = await pool.execute(query, params);

    res.json(generateResponse(true, messages, '获取消息成功'));
  } catch (error) {
    console.error('获取消息失败:', error);
    res.status(500).json(generateResponse(false, null, '获取消息失败'));
  }
});

router.post('/send', async (req, res) => {
  try {
    const { bottleId, receiverId, content, imageUrl, type } = req.body;
    const senderId = req.user.userId;

    const hasImage = imageUrl && imageUrl.trim().length > 0;
    const hasContent = content && content.trim().length > 0;

    if (!bottleId || !receiverId || (!hasContent && !hasImage)) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const blocked = await isBlockedBy(senderId, receiverId);
    const iBlocked = await hasBlocked(senderId, receiverId);

    if (iBlocked) {
      return res.status(403).json(generateResponse(false, null, '您已拉黑对方，无法发送消息'));
    }

    const consecutiveCount = await getConsecutiveCount(bottleId, senderId);
    if (consecutiveCount >= CONSECUTIVE_LIMIT) {
      return res.status(429).json(generateResponse(false, null, '对方尚未回复，请等待对方回复后再发送消息'));
    }

    const messageId = generateUUID();
    const msgType = type || (hasImage && !hasContent ? 'image' : 'text');
    const typeCol = await checkTypeColumn();
    const imageUrlCol = await checkImageUrlColumn();
    const isBlockedCol = await checkIsBlockedColumn();

    const finalContent = content ? content.trim() : '';
    const finalImageUrl = imageUrl ? imageUrl.trim() : null;
    const isBlocked = blocked ? 1 : 0;

    let insertQuery = 'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content';
    let placeholders = '?, ?, ?, ?, ?';
    const values = [messageId, bottleId, senderId, receiverId, finalContent];

    if (imageUrlCol) {
      insertQuery += ', image_url';
      placeholders += ', ?';
      values.push(finalImageUrl);
    }
    if (typeCol) {
      insertQuery += ', type';
      placeholders += ', ?';
      values.push(msgType);
    }
    if (isBlockedCol) {
      insertQuery += ', is_blocked';
      placeholders += ', ?';
      values.push(isBlocked);
    }

    insertQuery += `) VALUES (${placeholders})`;

    await pool.execute(insertQuery, values);

    if (!blocked) {
      await addIntimacy(bottleId, 1);
    }

    const selectType = typeCol ? ', m.type' : '';
    const selectRecalled = (await checkRecalledColumn()) ? ', m.is_recalled, m.recalled_at' : '';
    const selectImageUrl = imageUrlCol ? ', m.image_url' : '';
    const selectIsBlocked = isBlockedCol ? ', m.is_blocked' : '';
    const [message] = await pool.execute(
      'SELECT m.id, m.bottle_id, m.sender_id, m.receiver_id, m.content' + selectImageUrl + selectType + ', m.is_read' + selectRecalled + selectIsBlocked + ', m.created_at, ' +
      'u.nickname as sender_nickname, u.avatar as sender_avatar ' +
      'FROM messages m ' +
      'LEFT JOIN users u ON m.sender_id = u.id ' +
      'WHERE m.id = ?',
      [messageId]
    );

    res.json(generateResponse(true, message[0], blocked ? '对方已拒收您的消息' : '消息发送成功'));
  } catch (error) {
    console.error('发送消息失败:', error);
    res.status(500).json(generateResponse(false, null, '发送消息失败'));
  }
});

router.post('/upload-image', (req, res) => {
  messageImageUpload.single('image')(req, res, async function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json(generateResponse(false, null, '图片大小不能超过5MB'));
      }
      return res.status(400).json(generateResponse(false, null, err.message || '上传失败'));
    }

    if (!req.file) {
      return res.status(400).json(generateResponse(false, null, '请选择图片'));
    }

    try {
      const imageUrl = `/uploads/messages/${req.file.filename}`;
      res.json(generateResponse(true, { imageUrl }, '图片上传成功'));
    } catch (error) {
      console.error('图片上传失败:', error);
      res.status(500).json(generateResponse(false, null, '图片上传失败'));
    }
  });
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

    const isBlockedCol = await checkIsBlockedColumn();
    let query = 'SELECT COUNT(*) as unread_count FROM messages WHERE receiver_id = ? AND is_read = 0';
    const params = [userId];

    if (isBlockedCol) {
      query += ' AND is_blocked = 0';
    }

    const [count] = await pool.execute(query, params);

    res.json(generateResponse(true, {
      unreadCount: count[0].unread_count
    }, '获取未读消息数成功'));
  } catch (error) {
    console.error('获取未读消息数失败:', error);
    res.status(500).json(generateResponse(false, null, '获取未读消息数失败'));
  }
});

const RECALL_WINDOW_MINUTES = 3;

router.post('/recall/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    if (!messageId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const recalledCol = await checkRecalledColumn();
    if (!recalledCol) {
      return res.status(400).json(generateResponse(false, null, '数据库尚未升级，请联系管理员'));
    }

    const selectRecalled = ', m.is_recalled, m.recalled_at';
    const [messages] = await pool.execute(
      'SELECT m.id, m.bottle_id, m.sender_id, m.receiver_id, m.content, m.is_read' + selectRecalled + ', m.created_at ' +
      'FROM messages m WHERE m.id = ?',
      [messageId]
    );

    if (messages.length === 0) {
      return res.status(404).json(generateResponse(false, null, '消息不存在'));
    }

    const msg = messages[0];

    if (msg.sender_id !== userId) {
      return res.status(403).json(generateResponse(false, null, '只能撤回自己发送的消息'));
    }

    if (msg.is_recalled) {
      return res.status(400).json(generateResponse(false, null, '该消息已被撤回'));
    }

    const createdAt = new Date(msg.created_at).getTime();
    const now = Date.now();
    const diffMinutes = (now - createdAt) / (1000 * 60);

    if (diffMinutes > RECALL_WINDOW_MINUTES) {
      return res.status(400).json(generateResponse(false, null, `只能撤回${RECALL_WINDOW_MINUTES}分钟内的消息`));
    }

    await pool.execute(
      'UPDATE messages SET is_recalled = 1, recalled_at = NOW() WHERE id = ?',
      [messageId]
    );

    res.json(generateResponse(true, {
      messageId,
      is_recalled: 1,
      recalled_at: new Date().toISOString()
    }, '消息撤回成功'));
  } catch (error) {
    console.error('撤回消息失败:', error);
    res.status(500).json(generateResponse(false, null, '撤回消息失败'));
  }
});

router.post('/typing', async (req, res) => {
  try {
    const { bottleId, isTyping } = req.body;
    const userId = req.user.userId;

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const tableExists = await checkTypingStatusTable();
    if (!tableExists) {
      return res.json(generateResponse(true, { success: false }, '数据库尚未升级'));
    }

    const pair = await getBottleUserPair(bottleId);
    if (!pair) {
      return res.status(404).json(generateResponse(false, null, '瓶子不存在或未配对'));
    }

    const otherUserId = pair.user_id1 === userId ? pair.user_id2 : pair.user_id1;

    const [existing] = await pool.execute(
      'SELECT id FROM typing_status WHERE bottle_id = ? AND user_id = ?',
      [bottleId, userId]
    );

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE typing_status SET is_typing = ?, last_typing_at = ? WHERE id = ?',
        [isTyping ? 1 : 0, isTyping ? new Date() : null, existing[0].id]
      );
    } else {
      const id = generateUUID();
      await pool.execute(
        'INSERT INTO typing_status (id, bottle_id, user_id, other_user_id, is_typing, last_typing_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, bottleId, userId, otherUserId, isTyping ? 1 : 0, isTyping ? new Date() : null]
      );
    }

    res.json(generateResponse(true, { success: true }, '状态更新成功'));
  } catch (error) {
    console.error('更新打字状态失败:', error);
    res.status(500).json(generateResponse(false, null, '更新打字状态失败'));
  }
});

router.get('/typing/:bottleId', async (req, res) => {
  try {
    const { bottleId } = req.params;
    const userId = req.user.userId;

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const tableExists = await checkTypingStatusTable();
    if (!tableExists) {
      return res.json(generateResponse(true, { isTyping: false }, '数据库尚未升级'));
    }

    const pair = await getBottleUserPair(bottleId);
    if (!pair) {
      return res.json(generateResponse(true, { isTyping: false }, '瓶子不存在或未配对'));
    }

    const otherUserId = pair.user_id1 === userId ? pair.user_id2 : pair.user_id1;

    const [rows] = await pool.execute(
      'SELECT is_typing, last_typing_at FROM typing_status WHERE bottle_id = ? AND user_id = ?',
      [bottleId, otherUserId]
    );

    let isTyping = false;
    if (rows.length > 0 && rows[0].is_typing && rows[0].last_typing_at) {
      const lastTyping = new Date(rows[0].last_typing_at).getTime();
      const now = Date.now();
      if (now - lastTyping < 8000) {
        isTyping = true;
      } else {
        await pool.execute(
          'UPDATE typing_status SET is_typing = 0, last_typing_at = NULL WHERE bottle_id = ? AND user_id = ?',
          [bottleId, otherUserId]
        );
      }
    }

    res.json(generateResponse(true, { isTyping }, '获取成功'));
  } catch (error) {
    console.error('获取打字状态失败:', error);
    res.status(500).json(generateResponse(false, null, '获取打字状态失败'));
  }
});

module.exports = router;
