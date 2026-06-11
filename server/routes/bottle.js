const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('../utils/helper');
const { OPERATION_TYPES, logOperation } = require('../utils/bottleLogger');
const { BOTTLE_EXPIRE_DAYS, MAX_PICK_COUNT } = require('../utils/bottleScheduler');

const DAILY_LIMIT = 20;
const RECALL_TIME_LIMIT_MINUTES = 5;
const RECALL_COIN_COST = 10;
const PIN_COIN_COST = 50;

const VALID_TAGS = ['情绪倾诉', '交友', '求助', '树洞', '闲聊', '考研搭子', '游戏组队'];

const bottleStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads', 'bottles'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.userId}-${Date.now()}${ext}`);
  }
});

const bottleUpload = multer({
  storage: bottleStorage,
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

async function addCoins(userId, amount, type, source, conn) {
  const db = conn || pool;
  await db.execute(
    'UPDATE users SET coins = coins + ? WHERE id = ?',
    [amount, userId]
  );
  const recordId = generateUUID();
  await db.execute(
    'INSERT INTO coin_records (id, user_id, amount, type, source) VALUES (?, ?, ?, ?, ?)',
    [recordId, userId, amount, type, source]
  );
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

router.post('/upload-image', (req, res) => {
  bottleUpload.single('image')(req, res, async function (err) {
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
      const imageUrl = `/uploads/bottles/${req.file.filename}`;
      res.json(generateResponse(true, { imageUrl }, '图片上传成功'));
    } catch (error) {
      console.error('图片上传失败:', error);
      res.status(500).json(generateResponse(false, null, '图片上传失败'));
    }
  });
});

router.post('/throw', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { content, tag, imageUrl, targetGender, targetMinAge, targetMaxAge } = req.body;
    const senderId = req.user.userId;

    if (!content || content.trim().length === 0) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '内容不能为空'));
    }

    if (tag && !VALID_TAGS.includes(tag)) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '标签无效'));
    }

    if (targetGender && !['all', 'male', 'female'].includes(targetGender)) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '目标性别无效'));
    }

    const validatedMinAge = targetMinAge ? parseInt(targetMinAge) : null;
    const validatedMaxAge = targetMaxAge ? parseInt(targetMaxAge) : null;

    if (validatedMinAge !== null && validatedMaxAge !== null && validatedMinAge > validatedMaxAge) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '最小年龄不能大于最大年龄'));
    }

    const today = getLocalDateStr();
    await ensureDailyStat(senderId, today);
    const throwCount = await getDailyCount(senderId, today, 'throw_count');

    if (throwCount >= DAILY_LIMIT) {
      await conn.rollback();
      return res.status(429).json(generateResponse(false, null, `今日扔瓶子次数已达上限(${DAILY_LIMIT}次)，明天再来吧`));
    }

    const bottleId = generateUUID();

    await conn.execute(
      `INSERT INTO bottles (id, sender_id, content, tag, image_url, target_gender, target_min_age, target_max_age, status, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ${BOTTLE_EXPIRE_DAYS} DAY))`,
      [bottleId, senderId, content.trim(), tag || null, imageUrl || null, targetGender || 'all', validatedMinAge, validatedMaxAge, 'floating']
    );

    await conn.execute(
      'UPDATE daily_stats SET throw_count = throw_count + 1 WHERE user_id = ? AND stat_date = ?',
      [senderId, today]
    );

    await logOperation(bottleId, senderId, OPERATION_TYPES.THROW, 0, {
      content: content.trim().substring(0, 100),
      tag: tag || null
    }, conn);

    await conn.commit();

    res.json(generateResponse(true, {
      id: bottleId,
      content: content.trim(),
      tag: tag || null,
      imageUrl: imageUrl || null,
      targetGender: targetGender || 'all',
      targetMinAge: validatedMinAge,
      targetMaxAge: validatedMaxAge,
      expiresInDays: BOTTLE_EXPIRE_DAYS,
      throwRemaining: Math.max(0, DAILY_LIMIT - throwCount - 1)
    }, '瓶子扔出成功'));
  } catch (error) {
    console.error('扔瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '扔瓶子失败'));
  } finally {
    conn.release();
  }
});

function buildFilterQuery(filters, pickerId, isCount = false, pickerInfo = null) {
  const conditions = ['b.status = ?', 'b.sender_id != ?', 'b.is_deleted = 0', 'b.pick_count < ?'];
  const params = ['floating', pickerId, MAX_PICK_COUNT];

  if (pickerInfo) {
    if (pickerInfo.gender) {
      conditions.push('(b.target_gender = ? OR b.target_gender = ? OR b.target_gender IS NULL)');
      params.push('all', pickerInfo.gender);
    }

    if (pickerInfo.age !== null && pickerInfo.age !== undefined) {
      conditions.push('(b.target_min_age IS NULL OR b.target_min_age <= ?)');
      params.push(pickerInfo.age);
      conditions.push('(b.target_max_age IS NULL OR b.target_max_age >= ?)');
      params.push(pickerInfo.age);
    }
  }

  if (filters) {
    if (filters.tag && filters.tag !== 'all') {
      conditions.push('b.tag = ?');
      params.push(filters.tag);
    }

    if (filters.gender && filters.gender !== 'all') {
      const genderMap = {
        'male': '男',
        'female': '女',
        '男': '男',
        '女': '女'
      };
      const genderValue = genderMap[filters.gender] || filters.gender;
      conditions.push('u.gender = ?');
      params.push(genderValue);
    }

    const hasAgeFilter = (filters.minAge !== undefined && filters.minAge !== null && filters.minAge !== 18) ||
                       (filters.maxAge !== undefined && filters.maxAge !== null && filters.maxAge !== 60);

    if (hasAgeFilter) {
      if (filters.minAge !== undefined && filters.minAge !== null) {
        const minBirthday = new Date();
        minBirthday.setFullYear(minBirthday.getFullYear() - filters.minAge);
        conditions.push('u.birthday IS NOT NULL AND u.birthday <= ?');
        params.push(minBirthday.toISOString().split('T')[0]);
      }

      if (filters.maxAge !== undefined && filters.maxAge !== null) {
        const maxBirthday = new Date();
        maxBirthday.setFullYear(maxBirthday.getFullYear() - filters.maxAge - 1);
        maxBirthday.setDate(maxBirthday.getDate() + 1);
        conditions.push('u.birthday IS NOT NULL AND u.birthday >= ?');
        params.push(maxBirthday.toISOString().split('T')[0]);
      }
    }

    if (filters.timeRange && filters.timeRange !== 'all') {
      const hoursMap = {
        '24h': 24,
        '3d': 72,
        '7d': 168
      };
      if (hoursMap[filters.timeRange]) {
        conditions.push(`b.created_at >= DATE_SUB(NOW(), INTERVAL ${hoursMap[filters.timeRange]} HOUR)`);
      }
    }
  }

  const whereClause = conditions.join(' AND ');
  const selectFields = isCount
    ? 'COUNT(*) as total'
    : 'b.id, b.sender_id, b.content, b.tag, b.image_url, b.target_gender, b.target_min_age, b.target_max_age, b.created_at, b.expires_at, b.pick_count, b.is_pinned, b.pinned_at, u.nickname as sender_nickname, u.avatar as sender_avatar, u.gender as sender_gender, u.birthday as sender_birthday';

  return {
    query: `SELECT ${selectFields} FROM bottles b LEFT JOIN users u ON b.sender_id = u.id WHERE ${whereClause}`,
    params
  };
}

function calculateAge(birthday) {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 18 && age <= 100 ? age : null;
}

async function getPickerInfo(pickerId) {
  const [users] = await pool.execute(
    'SELECT gender, birthday FROM users WHERE id = ?',
    [pickerId]
  );
  if (users.length === 0) return null;
  const user = users[0];
  const genderMap = {
    '男': 'male',
    '女': 'female',
    'male': 'male',
    'female': 'female'
  };
  return {
    gender: genderMap[user.gender] || null,
    age: calculateAge(user.birthday)
  };
}

async function hasPickedBottle(bottleId, pickerId, conn) {
  const db = conn || pool;
  const [rows] = await db.execute(
    'SELECT id FROM bottle_pick_records WHERE bottle_id = ? AND picker_id = ?',
    [bottleId, pickerId]
  );
  return rows.length > 0;
}

router.post('/pick/count', async (req, res) => {
  try {
    const pickerId = req.user.userId;
    const filters = req.body || {};

    const pickerInfo = await getPickerInfo(pickerId);
    const { query, params } = buildFilterQuery(filters, pickerId, true, pickerInfo);
    const [result] = await pool.execute(query, params);

    res.json(generateResponse(true, {
      count: result[0].total || 0
    }, '获取筛选数量成功'));
  } catch (error) {
    console.error('获取筛选数量失败:', error);
    res.status(500).json(generateResponse(false, null, '获取筛选数量失败'));
  }
});

async function getPinnedBottles(filters, pickerId, pickerInfo) {
  const conditions = [
    'b.status = ?', 
    'b.sender_id != ?', 
    'b.is_deleted = 0', 
    'b.is_pinned = 1',
    'b.pick_count < ?'
  ];
  const params = ['floating', pickerId, MAX_PICK_COUNT];

  if (pickerInfo) {
    if (pickerInfo.gender) {
      conditions.push('(b.target_gender = ? OR b.target_gender = ? OR b.target_gender IS NULL)');
      params.push('all', pickerInfo.gender);
    }

    if (pickerInfo.age !== null && pickerInfo.age !== undefined) {
      conditions.push('(b.target_min_age IS NULL OR b.target_min_age <= ?)');
      params.push(pickerInfo.age);
      conditions.push('(b.target_max_age IS NULL OR b.target_max_age >= ?)');
      params.push(pickerInfo.age);
    }
  }

  if (filters) {
    if (filters.tag && filters.tag !== 'all') {
      conditions.push('b.tag = ?');
      params.push(filters.tag);
    }

    if (filters.gender && filters.gender !== 'all') {
      const genderMap = {
        'male': '男',
        'female': '女',
        '男': '男',
        '女': '女'
      };
      const genderValue = genderMap[filters.gender] || filters.gender;
      conditions.push('u.gender = ?');
      params.push(genderValue);
    }
  }

  const whereClause = conditions.join(' AND ');
  const selectFields = 'b.id, b.sender_id, b.content, b.tag, b.image_url, b.target_gender, b.target_min_age, b.target_max_age, b.created_at, b.expires_at, b.pick_count, b.is_pinned, b.pinned_at, u.nickname as sender_nickname, u.avatar as sender_avatar, u.gender as sender_gender, u.birthday as sender_birthday';

  const query = `SELECT ${selectFields} FROM bottles b LEFT JOIN users u ON b.sender_id = u.id WHERE ${whereClause} ORDER BY b.pinned_at DESC`;
  
  const [rows] = await pool.execute(query, params);
  return rows;
}

router.post('/pick', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const pickerId = req.user.userId;
    const filters = req.body.filters || {};

    const today = getLocalDateStr();
    await ensureDailyStat(pickerId, today);
    const pickCount = await getDailyCount(pickerId, today, 'pick_count');

    if (pickCount >= DAILY_LIMIT) {
      await conn.rollback();
      return res.status(429).json(generateResponse(false, null, `今日捞瓶子次数已达上限(${DAILY_LIMIT}次)，明天再来吧`));
    }

    const pickerInfo = await getPickerInfo(pickerId);

    let bottle = null;
    let isPinned = false;

    const pinnedBottles = await getPinnedBottles(filters, pickerId, pickerInfo);
    
    const availablePinnedBottles = [];
    for (const pb of pinnedBottles) {
      const picked = await hasPickedBottle(pb.id, pickerId, conn);
      if (!picked) {
        availablePinnedBottles.push(pb);
      }
    }

    if (availablePinnedBottles.length > 0) {
      const randomIndex = Math.floor(Math.random() * availablePinnedBottles.length);
      bottle = availablePinnedBottles[randomIndex];
      isPinned = true;
    } else {
      const { query, params } = buildFilterQuery(filters, pickerId, false, pickerInfo);
      const fullQuery = `${query} ORDER BY RAND() LIMIT 1`;

      const [floatingBottles] = await conn.execute(fullQuery, params);

      if (floatingBottles.length === 0) {
        await conn.rollback();
        return res.json(generateResponse(false, null, '海里暂时没有符合条件的漂流瓶'));
      }

      bottle = floatingBottles[0];
    }

    const alreadyPicked = await hasPickedBottle(bottle.id, pickerId, conn);
    if (alreadyPicked) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '你已经捞过这个瓶子了'));
    }

    const pickRecordId = generateUUID();
    await conn.execute(
      'INSERT INTO bottle_pick_records (id, bottle_id, picker_id) VALUES (?, ?, ?)',
      [pickRecordId, bottle.id, pickerId]
    );

    const [updatedBottle] = await conn.execute(
      'UPDATE bottles SET pick_count = pick_count + 1 WHERE id = ?',
      [bottle.id]
    );

    await conn.execute(
      'UPDATE daily_stats SET pick_count = pick_count + 1 WHERE user_id = ? AND stat_date = ?',
      [pickerId, today]
    );

    await logOperation(bottle.id, pickerId, OPERATION_TYPES.PICK, 0, {
      isPinned,
      pickCountAfter: (bottle.pick_count || 0) + 1
    }, conn);

    await conn.commit();

    const newPickCount = (bottle.pick_count || 0) + 1;
    const isMaxPick = newPickCount >= MAX_PICK_COUNT;

    res.json(generateResponse(true, {
      id: bottle.id,
      content: bottle.content,
      tag: bottle.tag,
      imageUrl: bottle.image_url,
      targetGender: bottle.target_gender,
      targetMinAge: bottle.target_min_age,
      targetMaxAge: bottle.target_max_age,
      senderId: bottle.sender_id,
      senderNickname: bottle.sender_nickname,
      senderAvatar: bottle.sender_avatar,
      senderGender: bottle.sender_gender,
      senderBirthday: bottle.sender_birthday,
      createdAt: bottle.created_at,
      expiresAt: bottle.expires_at,
      pickCount: newPickCount,
      isPinned: !!bottle.is_pinned,
      pinnedAt: bottle.pinned_at,
      isMaxPick,
      maxPickCount: MAX_PICK_COUNT,
      pickRemaining: Math.max(0, DAILY_LIMIT - pickCount - 1)
    }, isPinned ? '捞到置顶瓶子了！' : '捞到瓶子了'));
  } catch (error) {
    await conn.rollback();
    console.error('捞瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '捞瓶子失败'));
  } finally {
    conn.release();
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

    await logOperation(bottleId, null, OPERATION_TYPES.RETURN, 0, {
      note: '扔回海里'
    });

    res.json(generateResponse(true, null, '瓶子已扔回海里'));
  } catch (error) {
    console.error('扔回瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '扔回瓶子失败'));
  }
});

router.post('/reply', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { bottleId, content } = req.body;
    const pickerId = req.user.userId;

    if (!bottleId || !content || content.trim().length === 0) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [bottleRows] = await conn.execute(
      'SELECT sender_id, status FROM bottles WHERE id = ? AND is_deleted = 0',
      [bottleId]
    );

    if (bottleRows.length === 0) {
      await conn.rollback();
      return res.status(404).json(generateResponse(false, null, '瓶子不存在'));
    }

    const senderId = bottleRows[0].sender_id;

    await conn.execute(
      'UPDATE bottles SET status = ? WHERE id = ?',
      ['replied', bottleId]
    );

    const messageId = generateUUID();
    await conn.execute(
      'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?, ?)',
      [messageId, bottleId, pickerId, senderId, content.trim()]
    );

    await logOperation(bottleId, pickerId, OPERATION_TYPES.REPLY, 0, {
      content: content.trim().substring(0, 100)
    }, conn);

    await conn.commit();

    res.json(generateResponse(true, {
      messageId,
      bottleId,
      senderId,
      pickerId
    }, '回复成功，已开启私聊'));
  } catch (error) {
    await conn.rollback();
    console.error('回复瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '回复瓶子失败'));
  } finally {
    conn.release();
  }
});

router.post('/recall/:bottleId', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { bottleId } = req.params;
    const userId = req.user.userId;

    if (!bottleId) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [bottleRows] = await conn.execute(
      `SELECT id, sender_id, status, created_at, pick_count 
       FROM bottles 
       WHERE id = ? AND is_deleted = 0`,
      [bottleId]
    );

    if (bottleRows.length === 0) {
      await conn.rollback();
      return res.status(404).json(generateResponse(false, null, '瓶子不存在'));
    }

    const bottle = bottleRows[0];

    if (bottle.sender_id !== userId) {
      await conn.rollback();
      return res.status(403).json(generateResponse(false, null, '无权撤回此瓶子'));
    }

    const createdAt = new Date(bottle.created_at);
    const now = new Date();
    const timeDiffMinutes = (now - createdAt) / (1000 * 60);

    if (timeDiffMinutes > RECALL_TIME_LIMIT_MINUTES) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, `只能撤回${RECALL_TIME_LIMIT_MINUTES}分钟内发布的瓶子`));
    }

    const [messageCount] = await conn.execute(
      'SELECT COUNT(*) as count FROM messages WHERE bottle_id = ?',
      [bottleId]
    );

    if (messageCount[0].count > 0) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '瓶子已有回复，无法撤回'));
    }

    const [userRows] = await conn.execute(
      'SELECT coins FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );

    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    if (userRows[0].coins < RECALL_COIN_COST) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '漂流币不足'));
    }

    await conn.execute(
      'UPDATE users SET coins = coins - ? WHERE id = ?',
      [RECALL_COIN_COST, userId]
    );

    const coinRecordId = generateUUID();
    await conn.execute(
      'INSERT INTO coin_records (id, user_id, amount, type, source) VALUES (?, ?, ?, ?, ?)',
      [coinRecordId, userId, -RECALL_COIN_COST, 'bottle_recall', '撤回漂流瓶']
    );

    const today = getLocalDateStr();
    await ensureDailyStat(userId, today);
    await conn.execute(
      'UPDATE daily_stats SET throw_count = GREATEST(0, throw_count - 1) WHERE user_id = ? AND stat_date = ?',
      [userId, today]
    );

    await conn.execute(
      'DELETE FROM bottle_pick_records WHERE bottle_id = ?',
      [bottleId]
    );

    await conn.execute(
      'UPDATE bottles SET is_deleted = 1 WHERE id = ?',
      [bottleId]
    );

    const logId = generateUUID();
    await conn.execute(
      'INSERT INTO bottle_operation_logs (id, bottle_id, user_id, operation_type, coin_cost, detail) VALUES (?, ?, ?, ?, ?, ?)',
      [logId, bottleId, userId, OPERATION_TYPES.RECALL, RECALL_COIN_COST, JSON.stringify({
        recallTime: timeDiffMinutes.toFixed(2) + '分钟',
        returnedThrowCount: true,
        reason: 'user_initiated'
      })]
    );

    const [updatedUser] = await conn.execute(
      'SELECT coins FROM users WHERE id = ?',
      [userId]
    );

    await conn.commit();

    res.json(generateResponse(true, {
      bottleId,
      remainingCoins: updatedUser[0].coins,
      coinCost: RECALL_COIN_COST,
      throwCountReturned: true
    }, '瓶子撤回成功，已返还1次扔瓶子次数'));
  } catch (error) {
    await conn.rollback();
    console.error('撤回瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '撤回瓶子失败'));
  } finally {
    conn.release();
  }
});

router.post('/pin/:bottleId', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { bottleId } = req.params;
    const userId = req.user.userId;

    if (!bottleId) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [bottleRows] = await conn.execute(
      `SELECT id, sender_id, status, is_pinned, pick_count 
       FROM bottles 
       WHERE id = ? AND is_deleted = 0`,
      [bottleId]
    );

    if (bottleRows.length === 0) {
      await conn.rollback();
      return res.status(404).json(generateResponse(false, null, '瓶子不存在'));
    }

    const bottle = bottleRows[0];

    if (bottle.sender_id !== userId) {
      await conn.rollback();
      return res.status(403).json(generateResponse(false, null, '无权置顶此瓶子'));
    }

    if (bottle.status !== 'floating') {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '只能置顶漂浮中的瓶子'));
    }

    if (bottle.is_pinned) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '瓶子已经是置顶状态'));
    }

    if (bottle.pick_count >= MAX_PICK_COUNT) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '瓶子捞取次数已达上限，无法置顶'));
    }

    const [userRows] = await conn.execute(
      'SELECT coins FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );

    if (userRows.length === 0) {
      await conn.rollback();
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    if (userRows[0].coins < PIN_COIN_COST) {
      await conn.rollback();
      return res.status(400).json(generateResponse(false, null, '漂流币不足'));
    }

    await conn.execute(
      'UPDATE users SET coins = coins - ? WHERE id = ?',
      [PIN_COIN_COST, userId]
    );

    const coinRecordId = generateUUID();
    await conn.execute(
      'INSERT INTO coin_records (id, user_id, amount, type, source) VALUES (?, ?, ?, ?, ?)',
      [coinRecordId, userId, -PIN_COIN_COST, 'bottle_pin', '置顶漂流瓶']
    );

    await conn.execute(
      'UPDATE bottles SET is_pinned = 1, pinned_at = NOW() WHERE id = ?',
      [bottleId]
    );

    const logId = generateUUID();
    await conn.execute(
      'INSERT INTO bottle_operation_logs (id, bottle_id, user_id, operation_type, coin_cost, detail) VALUES (?, ?, ?, ?, ?, ?)',
      [logId, bottleId, userId, OPERATION_TYPES.PIN, PIN_COIN_COST, JSON.stringify({
        statusBefore: bottle.status,
        isPinnedBefore: bottle.is_pinned
      })]
    );

    const [updatedUser] = await conn.execute(
      'SELECT coins FROM users WHERE id = ?',
      [userId]
    );

    await conn.commit();

    res.json(generateResponse(true, {
      bottleId,
      isPinned: true,
      pinnedAt: new Date(),
      remainingCoins: updatedUser[0].coins,
      coinCost: PIN_COIN_COST
    }, '瓶子置顶成功'));
  } catch (error) {
    await conn.rollback();
    console.error('置顶瓶子失败:', error);
    res.status(500).json(generateResponse(false, null, '置顶瓶子失败'));
  } finally {
    conn.release();
  }
});

router.get('/my', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [sentBottles] = await pool.execute(
      'SELECT b.id, b.content, b.status, b.created_at, b.picked_at, b.pick_count, b.is_pinned, b.pinned_at, b.expires_at, ' +
      '"sent" as type, ' +
      'COALESCE(u2.nickname, "等待被捞取") as other_nickname, ' +
      'COALESCE(u2.avatar, "🌊") as other_avatar, ' +
      'u2.id as other_id ' +
      'FROM bottles b ' +
      'LEFT JOIN users u2 ON b.picker_id = u2.id ' +
      'WHERE b.sender_id = ? AND b.is_deleted = 0 ' +
      'ORDER BY b.created_at DESC',
      [userId]
    );

    const [repliedBottles] = await pool.execute(
      'SELECT b.id, b.content, b.status, b.created_at, b.picked_at, b.pick_count, b.is_pinned, b.pinned_at, ' +
      'b.picker_deleted_at, ' +
      '"replied" as type, ' +
      'u1.nickname as other_nickname, ' +
      'u1.avatar as other_avatar, ' +
      'u1.id as other_id ' +
      'FROM bottles b ' +
      'LEFT JOIN users u1 ON b.sender_id = u1.id ' +
      'WHERE b.picker_id = ? AND b.status = "replied" AND b.is_deleted = 0 ' +
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
      'SELECT b.id, b.sender_id, b.picker_id, b.content, b.status, b.created_at, b.expires_at, b.pick_count, b.is_pinned, b.pinned_at, ' +
      'CASE WHEN b.sender_id = ? THEN u2.nickname ELSE u1.nickname END as other_nickname, ' +
      'CASE WHEN b.sender_id = ? THEN u2.avatar ELSE u1.avatar END as other_avatar, ' +
      'CASE WHEN b.sender_id = ? THEN u2.id ELSE u1.id END as other_id ' +
      'FROM bottles b ' +
      'LEFT JOIN users u1 ON b.sender_id = u1.id ' +
      'LEFT JOIN users u2 ON b.picker_id = u2.id ' +
      'WHERE b.id = ? AND (b.sender_id = ? OR b.picker_id = ?) AND b.is_deleted = 0',
      [userId, userId, userId, bottleId, userId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json(generateResponse(false, null, '瓶子不存在或无权限查看'));
    }

    const bottle = rows[0];
    
    if (bottle.sender_id === userId) {
      const createdAt = new Date(bottle.created_at);
      const now = new Date();
      const timeDiffMinutes = (now - createdAt) / (1000 * 60);
      bottle.canRecall = timeDiffMinutes <= RECALL_TIME_LIMIT_MINUTES && bottle.status === 'floating' && bottle.pick_count === 0;
      bottle.recallTimeRemaining = Math.max(0, RECALL_TIME_LIMIT_MINUTES - timeDiffMinutes);
      bottle.recallCoinCost = RECALL_COIN_COST;
      bottle.canPin = bottle.status === 'floating' && !bottle.is_pinned && bottle.pick_count < MAX_PICK_COUNT;
      bottle.pinCoinCost = PIN_COIN_COST;
    }

    bottle.maxPickCount = MAX_PICK_COUNT;

    res.json(generateResponse(true, bottle, '获取瓶子详情成功'));
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
      'SELECT sender_id FROM bottles WHERE id = ? AND is_deleted = 0',
      [bottleId]
    );

    if (rows.length === 0) {
      return res.status(404).json(generateResponse(false, null, '瓶子不存在'));
    }

    if (rows[0].sender_id !== userId) {
      return res.status(403).json(generateResponse(false, null, '无权删除此瓶子'));
    }

    await pool.execute('UPDATE bottles SET is_deleted = 1 WHERE id = ?', [bottleId]);

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
      'SELECT sender_id, picker_id FROM bottles WHERE id = ? AND is_deleted = 0',
      [bottleId]
    );

    if (rows.length === 0) {
      return res.status(404).json(generateResponse(false, null, '瓶子不存在'));
    }

    if (rows[0].sender_id === userId) {
      await pool.execute('UPDATE bottles SET is_deleted = 1 WHERE id = ?', [bottleId]);
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
