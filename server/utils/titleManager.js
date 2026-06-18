const pool = require('../config/db');
const { generateUUID } = require('./helper');

async function getTitleById(titleId) {
  const [rows] = await pool.execute('SELECT * FROM titles WHERE id = ?', [titleId]);
  return rows.length > 0 ? rows[0] : null;
}

async function getAllTitles() {
  const [rows] = await pool.execute('SELECT * FROM titles ORDER BY sort_order ASC');
  return rows;
}

async function getUserTitles(userId) {
  const [rows] = await pool.execute(`
    SELECT ut.*, t.name, t.description, t.icon, t.color, t.bg_gradient, t.type, t.rarity, 
           t.validity_type, t.validity_value, t.validity_unit
    FROM user_titles ut
    INNER JOIN titles t ON ut.title_id = t.id
    WHERE ut.user_id = ?
    ORDER BY ut.is_equipped DESC, t.sort_order ASC
  `, [userId]);
  
  return rows.map(row => {
    const title = { ...row };
    title.is_expired = title.validity_type === 'duration' && title.expires_at && new Date(title.expires_at) < new Date();
    return title;
  });
}

async function getEquippedTitle(userId) {
  const [rows] = await pool.execute(`
    SELECT ut.*, t.name, t.description, t.icon, t.color, t.bg_gradient, t.type, t.rarity,
           t.validity_type, t.validity_value, t.validity_unit
    FROM user_titles ut
    INNER JOIN titles t ON ut.title_id = t.id
    WHERE ut.user_id = ? AND ut.is_equipped = 1
    LIMIT 1
  `, [userId]);
  
  if (rows.length === 0) return null;
  
  const title = rows[0];
  title.is_expired = title.validity_type === 'duration' && title.expires_at && new Date(title.expires_at) < new Date();
  
  if (title.is_expired) {
    await unequipTitle(userId, title.title_id);
    return null;
  }
  
  return title;
}

async function hasTitle(userId, titleId) {
  const [rows] = await pool.execute(
    'SELECT id, expires_at FROM user_titles WHERE user_id = ? AND title_id = ?',
    [userId, titleId]
  );
  
  if (rows.length === 0) return false;
  
  const record = rows[0];
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return false;
  }
  
  return true;
}

function calculateExpiresAt(title) {
  if (title.validity_type !== 'duration') {
    return null;
  }
  
  const now = new Date();
  const value = title.validity_value || 0;
  const unit = title.validity_unit;
  
  switch (unit) {
    case 'hour':
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    case 'day':
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() + value * 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

async function grantTitle(userId, titleId, source = null) {
  const title = await getTitleById(titleId);
  if (!title) {
    throw new Error('称号不存在');
  }
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [existing] = await connection.execute(
      'SELECT id, expires_at, is_equipped FROM user_titles WHERE user_id = ? AND title_id = ? FOR UPDATE',
      [userId, titleId]
    );
    
    const expiresAt = calculateExpiresAt(title);
    const isFirstTime = existing.length === 0;
    let wasExpired = false;
    
    if (existing.length > 0) {
      const oldRecord = existing[0];
      wasExpired = oldRecord.expires_at && new Date(oldRecord.expires_at) < new Date();
      
      if (title.validity_type === 'duration') {
        const newExpires = expiresAt ? expiresAt : null;
        if (wasExpired) {
          await connection.execute(
            'UPDATE user_titles SET obtained_at = NOW(), expires_at = ? WHERE id = ?',
            [newExpires, oldRecord.id]
          );
        } else if (oldRecord.expires_at) {
          const oldExpires = new Date(oldRecord.expires_at);
          const extendedExpires = newExpires && newExpires > oldExpires ? newExpires : oldExpires;
          await connection.execute(
            'UPDATE user_titles SET expires_at = ? WHERE id = ?',
            [extendedExpires, oldRecord.id]
          );
        }
      }
    } else {
      const recordId = generateUUID();
      await connection.execute(
        'INSERT INTO user_titles (id, user_id, title_id, source, expires_at) VALUES (?, ?, ?, ?, ?)',
        [recordId, userId, titleId, source, expiresAt]
      );
    }
    
    await connection.commit();
    
    if (isFirstTime || wasExpired) {
      await createNotification(userId, 'title_obtained', `获得称号：${title.name}`, 
        `恭喜你获得了「${title.name}」称号！`, 
        { titleId, titleName: title.name, titleIcon: title.icon }
      );
    }
    
    return { title, isFirstTime, wasExpired };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function equipTitle(userId, titleId) {
  const title = await getTitleById(titleId);
  if (!title) {
    throw new Error('称号不存在');
  }
  
  const hasUserTitle = await hasTitle(userId, titleId);
  if (!hasUserTitle) {
    throw new Error('你尚未获得该称号');
  }
  
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    await connection.execute(
      'UPDATE user_titles SET is_equipped = 0 WHERE user_id = ? AND is_equipped = 1',
      [userId]
    );
    
    await connection.execute(
      'UPDATE user_titles SET is_equipped = 1 WHERE user_id = ? AND title_id = ?',
      [userId, titleId]
    );
    
    await connection.execute(
      'UPDATE users SET equipped_title = ? WHERE id = ?',
      [titleId, userId]
    );
    
    await connection.commit();
    
    return title;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function unequipTitle(userId, titleId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [rows] = await connection.execute(
      'SELECT is_equipped FROM user_titles WHERE user_id = ? AND title_id = ?',
      [userId, titleId]
    );
    
    if (rows.length > 0 && rows[0].is_equipped) {
      await connection.execute(
        'UPDATE user_titles SET is_equipped = 0 WHERE user_id = ? AND title_id = ?',
        [userId, titleId]
      );
      
      await connection.execute(
        'UPDATE users SET equipped_title = NULL WHERE id = ? AND equipped_title = ?',
        [userId, titleId]
      );
    }
    
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function removeExpiredTitles() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [expiredRecords] = await connection.execute(`
      SELECT ut.user_id, ut.title_id, t.name 
      FROM user_titles ut
      INNER JOIN titles t ON ut.title_id = t.id
      WHERE t.validity_type = 'duration' 
        AND ut.expires_at IS NOT NULL 
        AND ut.expires_at < NOW()
        AND ut.is_equipped = 1
    `);
    
    for (const record of expiredRecords) {
      await connection.execute(
        'UPDATE users SET equipped_title = NULL WHERE id = ? AND equipped_title = ?',
        [record.user_id, record.title_id]
      );
      
      await createNotification(record.user_id, 'title_expired', `称号过期：${record.name}`,
        `你的「${record.name}」称号已过期`,
        { titleId: record.title_id, titleName: record.name }
      );
    }
    
    await connection.execute(`
      UPDATE user_titles SET is_equipped = 0 
      WHERE title_id IN (
        SELECT id FROM titles WHERE validity_type = 'duration'
      ) AND expires_at IS NOT NULL AND expires_at < NOW()
    `);
    
    await connection.commit();
    
    return expiredRecords.length;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createNotification(userId, type, title, content, extra = null) {
  const notificationId = generateUUID();
  const extraJson = extra ? JSON.stringify(extra) : null;
  
  await pool.execute(
    'INSERT INTO notifications (id, user_id, type, title, content, extra) VALUES (?, ?, ?, ?, ?, ?)',
    [notificationId, userId, type, title, content, extraJson]
  );
  
  return notificationId;
}

async function getNotifications(userId, page = 1, pageSize = 20) {
  const pageNum = parseInt(page);
  const pageSizeNum = parseInt(pageSize);
  const offset = (pageNum - 1) * pageSizeNum;
  
  const [rows] = await pool.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, pageSizeNum, offset]
  );
  
  const [countResult] = await pool.query(
    'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
    [userId]
  );
  
  return {
    list: rows.map(row => ({
      ...row,
      extra: row.extra ? (typeof row.extra === 'string' ? JSON.parse(row.extra) : row.extra) : null
    })),
    total: countResult[0].total,
    page: pageNum,
    pageSize: pageSizeNum
  };
}

async function getUnreadNotificationCount(userId) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return rows[0].count;
}

async function markNotificationRead(userId, notificationId) {
  await pool.execute(
    'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND id = ?',
    [userId, notificationId]
  );
  return true;
}

async function markAllNotificationsRead(userId) {
  await pool.execute(
    'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
    [userId]
  );
  return true;
}

async function checkAchievementTitles(userId) {
  const obtainedTitles = [];
  
  const titles = await getAllTitles();
  const achievementTitles = titles.filter(t => t.type === 'achievement' && t.condition_json);
  
  for (const title of achievementTitles) {
    const alreadyHas = await hasTitle(userId, title.id);
    if (alreadyHas) continue;
    
    const condition = typeof title.condition_json === 'string' 
      ? JSON.parse(title.condition_json) 
      : title.condition_json;
    let achieved = false;
    
    switch (condition.type) {
      case 'continuous_checkin':
        achieved = await checkContinuousCheckin(userId, condition.value);
        break;
      case 'total_messages':
        achieved = await checkTotalMessages(userId, condition.value);
        break;
      case 'total_bottles_thrown':
        achieved = await checkTotalBottlesThrown(userId, condition.value);
        break;
      case 'total_bottles_picked':
        achieved = await checkTotalBottlesPicked(userId, condition.value);
        break;
      case 'all_once_tasks':
        achieved = await checkAllOnceTasks(userId);
        break;
    }
    
    if (achieved) {
      await grantTitle(userId, title.id, condition.type);
      obtainedTitles.push(title);
    }
  }
  
  return obtainedTitles;
}

async function checkContinuousCheckin(userId, days) {
  try {
    const today = new Date();
    const checkinDates = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      checkinDates.push(dateStr);
    }
    
    const [rows] = await pool.execute(
      'SELECT checkin_date FROM checkins WHERE user_id = ? AND checkin_date >= ? ORDER BY checkin_date DESC',
      [userId, checkinDates[checkinDates.length - 1]]
    );
    
    if (rows.length < days) return false;
    
    let continuous = 0;
    for (let i = 0; i < days; i++) {
      const expectedDate = checkinDates[i];
      const found = rows.some(r => {
        const d = typeof r.checkin_date === 'string' ? r.checkin_date.split('T')[0] : 
                  r.checkin_date instanceof Date ? r.checkin_date.toISOString().split('T')[0] : String(r.checkin_date);
        return d === expectedDate;
      });
      
      if (found) {
        continuous++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }
    
    return continuous >= days;
  } catch (error) {
    console.error('检查连续签到失败:', error);
    return false;
  }
}

async function checkTotalMessages(userId, count) {
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM messages WHERE sender_id = ?',
      [userId]
    );
    return rows[0].cnt >= count;
  } catch (error) {
    console.error('检查消息数量失败:', error);
    return false;
  }
}

async function checkTotalBottlesThrown(userId, count) {
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM bottles WHERE sender_id = ?',
      [userId]
    );
    return rows[0].cnt >= count;
  } catch (error) {
    console.error('检查扔瓶数量失败:', error);
    return false;
  }
}

async function checkTotalBottlesPicked(userId, count) {
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM bottles WHERE picker_id = ?',
      [userId]
    );
    return rows[0].cnt >= count;
  } catch (error) {
    console.error('检查捞瓶数量失败:', error);
    return false;
  }
}

async function checkAllOnceTasks(userId) {
  try {
    const [claimed] = await pool.execute(
      "SELECT COUNT(*) as cnt FROM task_claims WHERE user_id = ? AND task_type = 'once'",
      [userId]
    );
    return claimed[0].cnt >= 3;
  } catch (error) {
    console.error('检查任务完成情况失败:', error);
    return false;
  }
}

async function grantRankTitles() {
  const results = { wealth: null, charm: null };
  
  const [wealthRows] = await pool.execute(`
    SELECT id, nickname, coins FROM users 
    WHERE coins > 0 
    ORDER BY coins DESC 
    LIMIT 1
  `);
  
  if (wealthRows.length > 0) {
    const user = wealthRows[0];
    await grantTitle(user.id, 'tycoon', 'wealth_rank_1');
    results.wealth = user;
  }
  
  const [charmRows] = await pool.execute(`
    SELECT id, nickname, charm FROM users 
    WHERE charm > 0 
    ORDER BY charm DESC 
    LIMIT 1
  `);
  
  if (charmRows.length > 0) {
    const user = charmRows[0];
    await grantTitle(user.id, 'heartthrob', 'charm_rank_1');
    results.charm = user;
  }
  
  return results;
}

module.exports = {
  getTitleById,
  getAllTitles,
  getUserTitles,
  getEquippedTitle,
  hasTitle,
  grantTitle,
  equipTitle,
  unequipTitle,
  removeExpiredTitles,
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  checkAchievementTitles,
  checkContinuousCheckin,
  checkTotalMessages,
  checkTotalBottlesThrown,
  checkTotalBottlesPicked,
  checkAllOnceTasks,
  grantRankTitles,
  calculateExpiresAt
};
