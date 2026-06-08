const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('../utils/helper');

const DAILY_LIMIT = 20;

function getLocalDateStr(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function ensureDailyStat(userId, date) {
  const [rows] = await pool.execute(
    'SELECT id FROM daily_stats WHERE user_id = ? AND stat_date = ?',
    [userId, date]
  );
  if (rows.length === 0) {
    const id = generateUUID();
    await pool.execute(
      'INSERT INTO daily_stats (id, user_id, stat_date, usage_seconds, throw_count, pick_count) VALUES (?, ?, ?, 0, 0, 0)',
      [id, userId, date]
    );
  }
}

async function getDailyCount(userId, date, field) {
  const [rows] = await pool.execute(
    `SELECT ${field} as count FROM daily_stats WHERE user_id = ? AND stat_date = ?`,
    [userId, date]
  );
  return rows.length > 0 ? rows[0].count : 0;
}

router.get('/daily-limits', async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = getLocalDateStr();

    const throwCount = await getDailyCount(userId, today, 'throw_count');
    const pickCount = await getDailyCount(userId, today, 'pick_count');

    res.json(generateResponse(true, {
      throwCount,
      pickCount,
      throwLimit: DAILY_LIMIT,
      pickLimit: DAILY_LIMIT,
      throwRemaining: Math.max(0, DAILY_LIMIT - throwCount),
      pickRemaining: Math.max(0, DAILY_LIMIT - pickCount)
    }, '获取成功'));
  } catch (error) {
    console.error('获取每日限制失败:', error);
    res.status(500).json(generateResponse(false, null, '获取每日限制失败'));
  }
});

router.post('/throw', async (req, res) => {
  try {
    const { content } = req.body;
    const senderId = req.user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json(generateResponse(false, null, '内容不能为空'));
    }

    const today = getLocalDateStr();
    await ensureDailyStat(senderId, today);
    const throwCount = await getDailyCount(senderId, today, 'throw_count');

    if (throwCount >= DAILY_LIMIT) {
      return res.status(429).json(generateResponse(false, null, `今日扔瓶子次数已达上限(${DAILY_LIMIT}次)，明天再来吧`));
    }

    const bottleId = generateUUID();

    await pool.execute(
      'INSERT INTO bottles (id, sender_id, content, status) VALUES (?, ?, ?, ?)',
      [bottleId, senderId, content.trim(), 'floating']
    );

    await pool.execute(
      'UPDATE daily_stats SET throw_count = throw_count + 1 WHERE user_id = ? AND stat_date = ?',
      [senderId, today]
    );

    res.json(generateResponse(true, {
      id: bottleId,
      content: content.trim(),
      throwRemaining: Math.max(0, DAILY_LIMIT - throwCount - 1)
    }, '瓶子扔出成功'));
  } catch (error) {
    console.error('扔瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '扔瓶子失败'));
  }
});

router.post('/pick', async (req, res) => {
  try {
    const pickerId = req.user.userId;

    const today = getLocalDateStr();
    await ensureDailyStat(pickerId, today);
    const pickCount = await getDailyCount(pickerId, today, 'pick_count');

    if (pickCount >= DAILY_LIMIT) {
      return res.status(429).json(generateResponse(false, null, `今日捞瓶子次数已达上限(${DAILY_LIMIT}次)，明天再来吧`));
    }

    const [floatingBottles] = await pool.execute(
      'SELECT b.id, b.sender_id, b.content, b.created_at, u.nickname as sender_nickname, u.avatar as sender_avatar ' +
      'FROM bottles b ' +
      'LEFT JOIN users u ON b.sender_id = u.id ' +
      'WHERE b.status = ? AND b.sender_id != ? ' +
      'ORDER BY RAND() LIMIT 1',
      ['floating', pickerId]
    );

    if (floatingBottles.length === 0) {
      return res.json(generateResponse(false, null, '海里暂时没有漂流瓶'));
    }

    const bottle = floatingBottles[0];

    await pool.execute(
      'UPDATE bottles SET status = ?, picker_id = ?, picked_at = NOW() WHERE id = ?',
      ['picked', pickerId, bottle.id]
    );

    await pool.execute(
      'UPDATE daily_stats SET pick_count = pick_count + 1 WHERE user_id = ? AND stat_date = ?',
      [pickerId, today]
    );

    res.json(generateResponse(true, {
      id: bottle.id,
      content: bottle.content,
      senderId: bottle.sender_id,
      senderNickname: bottle.sender_nickname,
      senderAvatar: bottle.sender_avatar,
      createdAt: bottle.created_at,
      pickRemaining: Math.max(0, DAILY_LIMIT - pickCount - 1)
    }, '捞到瓶子了'));
  } catch (error) {
    console.error('捞瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '捞瓶子失败'));
  }
});

router.post('/return', async (req, res) => {
  try {
    const { bottleId } = req.body;

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    await pool.execute(
      'UPDATE bottles SET status = ?, picker_id = NULL, picked_at = NULL WHERE id = ?',
      ['floating', bottleId]
    );

    res.json(generateResponse(true, null, '瓶子已扔回海里'));
  } catch (error) {
    console.error('扔回瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '扔回瓶子失败'));
  }
});

router.post('/reply', async (req, res) => {
  try {
    const { bottleId, content } = req.body;
    const pickerId = req.user.userId;

    if (!bottleId || !content || content.trim().length === 0) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [bottleRows] = await pool.execute(
      'SELECT sender_id FROM bottles WHERE id = ?',
      [bottleId]
    );

    if (bottleRows.length === 0) {
      return res.status(404).json(generateResponse(false, null, '瓶子不存在'));
    }

    const senderId = bottleRows[0].sender_id;

    await pool.execute(
      'UPDATE bottles SET status = ? WHERE id = ?',
      ['replied', bottleId]
    );

    const messageId = generateUUID();
    await pool.execute(
      'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?, ?)',
      [messageId, bottleId, pickerId, senderId, content.trim()]
    );

    res.json(generateResponse(true, {
      messageId,
      bottleId,
      senderId,
      pickerId
    }, '回复成功，已开启私聊'));
  } catch (error) {
    console.error('回复瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '回复瓶子失败'));
  }
});

router.get('/my', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [sentBottles] = await pool.execute(
      'SELECT b.id, b.content, b.status, b.created_at, b.picked_at, ' +
      '"sent" as type, ' +
      'COALESCE(u2.nickname, "等待被捞取") as other_nickname, ' +
      'COALESCE(u2.avatar, "🌊") as other_avatar, ' +
      'u2.id as other_id ' +
      'FROM bottles b ' +
      'LEFT JOIN users u2 ON b.picker_id = u2.id ' +
      'WHERE b.sender_id = ? ' +
      'ORDER BY b.created_at DESC',
      [userId]
    );

    const [repliedBottles] = await pool.execute(
      'SELECT b.id, b.content, b.status, b.created_at, b.picked_at, ' +
      'b.picker_deleted_at, ' +
      '"replied" as type, ' +
      'u1.nickname as other_nickname, ' +
      'u1.avatar as other_avatar, ' +
      'u1.id as other_id ' +
      'FROM bottles b ' +
      'LEFT JOIN users u1 ON b.sender_id = u1.id ' +
      'WHERE b.picker_id = ? AND b.status = "replied" ' +
      'ORDER BY b.created_at DESC',
      [userId]
    );

    let allBottles = [...sentBottles, ...repliedBottles];

    const bottleIds = allBottles.map(b => b.id);
    if (bottleIds.length > 0) {
      const placeholders = bottleIds.map(() => '?').join(',');

      const [latestMessages] = await pool.execute(
        'SELECT m.bottle_id, m.content as latest_message, m.sender_id as latest_sender_id, ' +
        'm.created_at as latest_message_time, u.nickname as latest_sender_nickname ' +
        'FROM messages m ' +
        'LEFT JOIN users u ON m.sender_id = u.id ' +
        'INNER JOIN (' +
        '  SELECT bottle_id, MAX(created_at) as max_created_at ' +
        '  FROM messages WHERE bottle_id IN (' + placeholders + ') ' +
        '  GROUP BY bottle_id' +
        ') mm ON m.bottle_id = mm.bottle_id AND m.created_at = mm.max_created_at',
        bottleIds
      );

      const [unreadCounts] = await pool.execute(
        'SELECT bottle_id, COUNT(*) as unread_count ' +
        'FROM messages ' +
        'WHERE receiver_id = ? AND is_read = 0 AND bottle_id IN (' + placeholders + ') ' +
        'GROUP BY bottle_id',
        [userId, ...bottleIds]
      );

      const messageMap = {};
      latestMessages.forEach(m => {
        messageMap[m.bottle_id] = m;
      });

      const unreadMap = {};
      unreadCounts.forEach(u => {
        unreadMap[u.bottle_id] = u.unread_count;
      });

      allBottles = allBottles.map(bottle => {
        const msg = messageMap[bottle.id];
        return {
          ...bottle,
          latest_message: msg ? msg.latest_message : null,
          latest_sender_id: msg ? msg.latest_sender_id : null,
          latest_sender_nickname: msg ? msg.latest_sender_nickname : null,
          latest_message_time: msg ? msg.latest_message_time : null,
          unread_count: unreadMap[bottle.id] || 0
        };
      });
    }

    allBottles = allBottles.filter(bottle => {
      if (bottle.picker_deleted_at) {
        const isPicker = bottle.type === 'replied';
        if (isPicker) {
          const deletedAt = new Date(bottle.picker_deleted_at).getTime();
          const latestMsgTime = bottle.latest_message_time ? new Date(bottle.latest_message_time).getTime() : 0;
          return latestMsgTime > deletedAt;
        }
      }
      return true;
    });

    allBottles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(generateResponse(true, allBottles, '获取我的瓶子成功'));
  } catch (error) {
    console.error('获取我的瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '获取我的瓶子失败'));
  }
});

router.get('/:bottleId', async (req, res) => {
  try {
    const { bottleId } = req.params;
    const userId = req.user.userId;

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [rows] = await pool.execute(
      'SELECT b.id, b.sender_id, b.picker_id, b.content, b.status, b.created_at, ' +
      'CASE WHEN b.sender_id = ? THEN u2.nickname ELSE u1.nickname END as other_nickname, ' +
      'CASE WHEN b.sender_id = ? THEN u2.avatar ELSE u1.avatar END as other_avatar, ' +
      'CASE WHEN b.sender_id = ? THEN u2.id ELSE u1.id END as other_id ' +
      'FROM bottles b ' +
      'LEFT JOIN users u1 ON b.sender_id = u1.id ' +
      'LEFT JOIN users u2 ON b.picker_id = u2.id ' +
      'WHERE b.id = ? AND (b.sender_id = ? OR b.picker_id = ?)',
      [userId, userId, userId, bottleId, userId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json(generateResponse(false, null, '瓶子不存在或无权限查看'));
    }

    res.json(generateResponse(true, rows[0], '获取瓶子详情成功'));
  } catch (error) {
    console.error('获取瓶子详情失败:', error);
    res.status(500).json(generateResponse(false, null, '获取瓶子详情失败'));
  }
});

router.delete('/:bottleId', async (req, res) => {
  try {
    const { bottleId } = req.params;
    const userId = req.user.userId;

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [rows] = await pool.execute(
      'SELECT sender_id FROM bottles WHERE id = ?',
      [bottleId]
    );

    if (rows.length === 0) {
      return res.status(404).json(generateResponse(false, null, '瓶子不存在'));
    }

    if (rows[0].sender_id !== userId) {
      return res.status(403).json(generateResponse(false, null, '无权删除此瓶子'));
    }

    await pool.execute('DELETE FROM bottles WHERE id = ?', [bottleId]);

    res.json(generateResponse(true, null, '瓶子已删除'));
  } catch (error) {
    console.error('删除瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '删除瓶子失败'));
  }
});

router.post('/soft-delete/:bottleId', async (req, res) => {
  try {
    const { bottleId } = req.params;
    const userId = req.user.userId;

    if (!bottleId) {
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [rows] = await pool.execute(
      'SELECT sender_id, picker_id FROM bottles WHERE id = ?',
      [bottleId]
    );

    if (rows.length === 0) {
      return res.status(404).json(generateResponse(false, null, '瓶子不存在'));
    }

    if (rows[0].sender_id === userId) {
      await pool.execute('DELETE FROM bottles WHERE id = ?', [bottleId]);
      return res.json(generateResponse(true, null, '瓶子已删除'));
    }

    if (rows[0].picker_id === userId) {
      await pool.execute(
        'UPDATE bottles SET picker_deleted_at = NOW() WHERE id = ?',
        [bottleId]
      );
      return res.json(generateResponse(true, null, '已删除'));
    }

    return res.status(403).json(generateResponse(false, null, '无权操作'));
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json(generateResponse(false, null, '删除失败'));
  }
});

module.exports = router;
