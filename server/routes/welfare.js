const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('../utils/helper');

const ONCE_TASKS = [
  { key: 'profile_complete', name: '完成个人信息填写', reward: 50, type: 'once' },
  { key: 'first_throw', name: '第一次扔漂流瓶', reward: 20, type: 'once' },
  { key: 'first_pick', name: '第一次捞漂流瓶', reward: 20, type: 'once' }
];

const DAILY_TASKS = [
  { key: 'daily_10min', name: '今日使用页面10分钟', reward: 10, type: 'daily', requireSeconds: 600 },
  { key: 'daily_30min', name: '今日使用页面30分钟', reward: 40, type: 'daily', requireSeconds: 1800 },
  { key: 'daily_60min', name: '今日使用页面60分钟', reward: 100, type: 'daily', requireSeconds: 3600 },
  { key: 'daily_throw_10', name: '扔十个漂流瓶', reward: 100, type: 'daily', requireCount: 10 },
  { key: 'daily_pick_10', name: '捞十个漂流瓶', reward: 100, type: 'daily', requireCount: 10 }
];

const GIFTS = [
  { days: 7, minAmount: 70, maxAmount: 210 },
  { days: 14, minAmount: 140, maxAmount: 420 },
  { days: 21, minAmount: 280, maxAmount: 840 }
];

function getLocalDateStr(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDbDate(dbValue) {
  if (typeof dbValue === 'string') return dbValue.split('T')[0];
  if (dbValue instanceof Date) return getLocalDateStr(dbValue);
  return String(dbValue);
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

async function addCoins(userId, amount, type, source) {
  await pool.execute(
    'UPDATE users SET coins = coins + ? WHERE id = ?',
    [amount, userId]
  );
  const recordId = generateUUID();
  await pool.execute(
    'INSERT INTO coin_records (id, user_id, amount, type, source) VALUES (?, ?, ?, ?, ?)',
    [recordId, userId, amount, type, source]
  );
}

function getMonthRange(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { startDate, endDate };
}

router.get('/info', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [users] = await pool.execute(
      'SELECT coins FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    const today = getLocalDateStr();
    const [todayRecords] = await pool.execute(
      'SELECT COALESCE(SUM(amount), 0) as today_coins FROM coin_records WHERE user_id = ? AND DATE(created_at) = ?',
      [userId, today]
    );

    res.json(generateResponse(true, {
      totalCoins: users[0].coins,
      todayCoins: todayRecords[0].today_coins
    }));
  } catch (error) {
    console.error('获取福利信息失败:', error);
    res.status(500).json(generateResponse(false, null, '获取福利信息失败'));
  }
});

router.get('/records', async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    const [records] = await pool.execute(
      'SELECT id, amount, type, source, created_at FROM coin_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, pageSize, offset]
    );

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM coin_records WHERE user_id = ?',
      [userId]
    );

    res.json(generateResponse(true, {
      records,
      total: countResult[0].total,
      page,
      pageSize
    }));
  } catch (error) {
    console.error('获取漂流币记录失败:', error);
    res.status(500).json(generateResponse(false, null, '获取漂流币记录失败'));
  }
});

router.post('/checkin', async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = getLocalDateStr();

    const [existing] = await pool.execute(
      'SELECT id FROM checkins WHERE user_id = ? AND checkin_date = ?',
      [userId, today]
    );

    if (existing.length > 0) {
      return res.status(200).json(generateResponse(true, { amount: 0, alreadyCheckedIn: true }, '今日已签到'));
    }

    const checkinId = generateUUID();
    await pool.execute(
      'INSERT INTO checkins (id, user_id, checkin_date) VALUES (?, ?, ?)',
      [checkinId, userId, today]
    );

    await addCoins(userId, 10, 'checkin', '每日签到奖励');

    res.json(generateResponse(true, { amount: 10 }, '签到成功，获得10漂流币'));
  } catch (error) {
    console.error('签到失败:', error);
    res.status(500).json(generateResponse(false, null, '签到失败'));
  }
});

router.get('/checkin-status', async (req, res) => {
  try {
    const userId = req.user.userId;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    const { startDate, endDate } = getMonthRange(year, month);

    const [checkins] = await pool.execute(
      'SELECT checkin_date FROM checkins WHERE user_id = ? AND checkin_date >= ? AND checkin_date < ?',
      [userId, startDate, endDate]
    );

    const checkinDates = checkins.map(c => formatDbDate(c.checkin_date));

    const { startDate: monthStart, endDate: monthEnd } = getMonthRange(year, month);
    const [giftClaims] = await pool.execute(
      'SELECT gift_days, month FROM gift_claims WHERE user_id = ? AND month = ?',
      [userId, `${year}-${String(month).padStart(2, '0')}`]
    );

    const claimedGifts = giftClaims.map(g => g.gift_days);

    res.json(generateResponse(true, {
      checkinDates,
      claimedGifts,
      year,
      month
    }));
  } catch (error) {
    console.error('获取签到状态失败:', error);
    res.status(500).json(generateResponse(false, null, '获取签到状态失败'));
  }
});

router.post('/claim-gift', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { giftDays } = req.body;

    const gift = GIFTS.find(g => g.days === giftDays);
    if (!gift) {
      return res.status(400).json(generateResponse(false, null, '无效的礼包'));
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { startDate, endDate } = getMonthRange(now.getFullYear(), now.getMonth() + 1);

    const [existing] = await pool.execute(
      'SELECT id FROM gift_claims WHERE user_id = ? AND gift_days = ? AND month = ?',
      [userId, giftDays, currentMonth]
    );

    if (existing.length > 0) {
      return res.status(400).json(generateResponse(false, null, '该礼包本月已领取'));
    }

    const [checkins] = await pool.execute(
      'SELECT COUNT(*) as count FROM checkins WHERE user_id = ? AND checkin_date >= ? AND checkin_date < ?',
      [userId, startDate, endDate]
    );

    if (checkins[0].count < giftDays) {
      return res.status(400).json(generateResponse(false, null, `本月签到不足${giftDays}天，无法领取`));
    }

    const amount = Math.floor(Math.random() * (gift.maxAmount - gift.minAmount + 1)) + gift.minAmount;
    const claimId = generateUUID();

    await pool.execute(
      'INSERT INTO gift_claims (id, user_id, gift_days, month, amount) VALUES (?, ?, ?, ?, ?)',
      [claimId, userId, giftDays, currentMonth, amount]
    );

    await addCoins(userId, amount, 'gift', `${giftDays}天签到礼包`);

    res.json(generateResponse(true, { amount, giftDays }, `领取成功，获得${amount}漂流币`));
  } catch (error) {
    console.error('领取礼包失败:', error);
    res.status(500).json(generateResponse(false, null, '领取礼包失败'));
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = getLocalDateStr();

    const [onceClaims] = await pool.execute(
      'SELECT task_key FROM task_claims WHERE user_id = ? AND task_type = ?',
      [userId, 'once']
    );
    const claimedOnceKeys = onceClaims.map(c => c.task_key);

    const [dailyClaims] = await pool.execute(
      'SELECT task_key FROM task_claims WHERE user_id = ? AND task_type = ? AND DATE(created_at) = ?',
      [userId, 'daily', today]
    );
    const claimedDailyKeys = dailyClaims.map(c => c.task_key);

    const [users] = await pool.execute(
      'SELECT gender, birthday, bio FROM users WHERE id = ?',
      [userId]
    );

    const [thrownBottles] = await pool.execute(
      'SELECT COUNT(*) as count FROM bottles WHERE sender_id = ?',
      [userId]
    );

    const [pickStats] = await pool.execute(
      'SELECT COALESCE(SUM(pick_count), 0) as total FROM daily_stats WHERE user_id = ?',
      [userId]
    );

    const [dailyStatsRows] = await pool.execute(
      'SELECT usage_seconds, throw_count, pick_count FROM daily_stats WHERE user_id = ? AND stat_date = ?',
      [userId, today]
    );
    const dailyStats = dailyStatsRows.length > 0 ? dailyStatsRows[0] : { usage_seconds: 0, throw_count: 0, pick_count: 0 };

    const onceTasks = ONCE_TASKS.map(task => {
      let completed = false;
      switch (task.key) {
        case 'profile_complete':
          completed = !!(users[0]?.gender && users[0]?.birthday && users[0]?.bio);
          break;
        case 'first_throw':
          completed = thrownBottles[0].count > 0;
          break;
        case 'first_pick':
          completed = pickStats[0].total > 0;
          break;
      }
      return {
        ...task,
        completed,
        claimed: claimedOnceKeys.includes(task.key)
      };
    });

    const dailyTasks = DAILY_TASKS.map(task => {
      let completed = false;
      let progress = 0;
      switch (task.key) {
        case 'daily_10min':
          progress = Math.min(dailyStats.usage_seconds, task.requireSeconds);
          completed = dailyStats.usage_seconds >= task.requireSeconds;
          break;
        case 'daily_30min':
          progress = Math.min(dailyStats.usage_seconds, task.requireSeconds);
          completed = dailyStats.usage_seconds >= task.requireSeconds;
          break;
        case 'daily_60min':
          progress = Math.min(dailyStats.usage_seconds, task.requireSeconds);
          completed = dailyStats.usage_seconds >= task.requireSeconds;
          break;
        case 'daily_throw_10':
          progress = Math.min(dailyStats.throw_count, task.requireCount);
          completed = dailyStats.throw_count >= task.requireCount;
          break;
        case 'daily_pick_10':
          progress = Math.min(dailyStats.pick_count, task.requireCount);
          completed = dailyStats.pick_count >= task.requireCount;
          break;
      }
      return {
        ...task,
        completed,
        claimed: claimedDailyKeys.includes(task.key),
        progress
      };
    });

    res.json(generateResponse(true, { onceTasks, dailyTasks }));
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json(generateResponse(false, null, '获取任务列表失败'));
  }
});

router.post('/claim-task', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskKey } = req.body;

    const allTasks = [...ONCE_TASKS, ...DAILY_TASKS];
    const task = allTasks.find(t => t.key === taskKey);
    if (!task) {
      return res.status(400).json(generateResponse(false, null, '无效的任务'));
    }

    const today = getLocalDateStr();

    if (task.type === 'once') {
      const [existing] = await pool.execute(
        'SELECT id FROM task_claims WHERE user_id = ? AND task_key = ? AND task_type = ?',
        [userId, taskKey, 'once']
      );
      if (existing.length > 0) {
        return res.status(400).json(generateResponse(false, null, '该任务奖励已领取'));
      }
    } else {
      const [existing] = await pool.execute(
        'SELECT id FROM task_claims WHERE user_id = ? AND task_key = ? AND task_type = ? AND DATE(created_at) = ?',
        [userId, taskKey, 'daily', today]
      );
      if (existing.length > 0) {
        return res.status(400).json(generateResponse(false, null, '今日该任务奖励已领取'));
      }
    }

    if (task.type === 'once') {
      const [users] = await pool.execute(
        'SELECT gender, birthday, bio FROM users WHERE id = ?',
        [userId]
      );
      const [thrownBottles] = await pool.execute(
        'SELECT COUNT(*) as count FROM bottles WHERE sender_id = ?',
        [userId]
      );
      const [pickStats] = await pool.execute(
        'SELECT COALESCE(SUM(pick_count), 0) as total FROM daily_stats WHERE user_id = ?',
        [userId]
      );

      let completed = false;
      switch (taskKey) {
        case 'profile_complete':
          completed = !!(users[0]?.gender && users[0]?.birthday && users[0]?.bio);
          break;
        case 'first_throw':
          completed = thrownBottles[0].count > 0;
          break;
        case 'first_pick':
          completed = pickStats[0].total > 0;
          break;
      }

      if (!completed) {
        return res.status(400).json(generateResponse(false, null, '任务未完成'));
      }
    } else {
      const [dailyStatsRows] = await pool.execute(
        'SELECT usage_seconds, throw_count, pick_count FROM daily_stats WHERE user_id = ? AND stat_date = ?',
        [userId, today]
      );
      const dailyStats = dailyStatsRows.length > 0 ? dailyStatsRows[0] : { usage_seconds: 0, throw_count: 0, pick_count: 0 };

      let completed = false;
      switch (taskKey) {
        case 'daily_10min':
          completed = dailyStats.usage_seconds >= task.requireSeconds;
          break;
        case 'daily_30min':
          completed = dailyStats.usage_seconds >= task.requireSeconds;
          break;
        case 'daily_60min':
          completed = dailyStats.usage_seconds >= task.requireSeconds;
          break;
        case 'daily_throw_10':
          completed = dailyStats.throw_count >= task.requireCount;
          break;
        case 'daily_pick_10':
          completed = dailyStats.pick_count >= task.requireCount;
          break;
      }

      if (!completed) {
        return res.status(400).json(generateResponse(false, null, '任务未完成'));
      }
    }

    const claimId = generateUUID();
    await pool.execute(
      'INSERT INTO task_claims (id, user_id, task_key, task_type, amount) VALUES (?, ?, ?, ?, ?)',
      [claimId, userId, taskKey, task.type, task.reward]
    );

    await addCoins(userId, task.reward, 'task', task.name);

    res.json(generateResponse(true, { amount: task.reward, taskKey }, `领取成功，获得${task.reward}漂流币`));
  } catch (error) {
    console.error('领取任务奖励失败:', error);
    res.status(500).json(generateResponse(false, null, '领取任务奖励失败'));
  }
});

router.post('/report-usage', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { seconds } = req.body;

    if (!seconds || seconds <= 0) {
      return res.json(generateResponse(true, null));
    }

    const today = getLocalDateStr();
    await ensureDailyStat(userId, today);

    await pool.execute(
      'UPDATE daily_stats SET usage_seconds = usage_seconds + ? WHERE user_id = ? AND stat_date = ?',
      [seconds, userId, today]
    );

    res.json(generateResponse(true, null));
  } catch (error) {
    console.error('上报使用时长失败:', error);
    res.status(500).json(generateResponse(false, null, '上报使用时长失败'));
  }
});

module.exports = router;
