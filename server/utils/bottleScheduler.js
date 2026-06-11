const cron = require('node-cron');
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('./helper');
const { logCleanup, OPERATION_TYPES } = require('./bottleLogger');

const BOTTLE_EXPIRE_DAYS = 7;
const MAX_PICK_COUNT = 5;

async function cleanupExpiredBottles() {
  const conn = await pool.getConnection();
  const startTime = new Date();
  let cleanedCount = 0;
  let detail = {};

  try {
    await conn.beginTransaction();

    const [expiredBottles] = await conn.execute(
      `SELECT id, sender_id, content, created_at 
       FROM bottles 
       WHERE status = 'floating' 
         AND is_deleted = 0 
         AND expires_at IS NOT NULL 
         AND expires_at < NOW()
       FOR UPDATE`,
      []
    );

    detail.expiredCount = expiredBottles.length;

    if (expiredBottles.length > 0) {
      const bottleIds = expiredBottles.map(b => b.id);
      const placeholders = bottleIds.map(() => '?').join(',');

      await conn.execute(
        `DELETE FROM bottle_pick_records WHERE bottle_id IN (${placeholders})`,
        bottleIds
      );

      await conn.execute(
        `DELETE FROM messages WHERE bottle_id IN (${placeholders})`,
        bottleIds
      );

      const [result] = await conn.execute(
        `DELETE FROM bottles WHERE id IN (${placeholders})`,
        bottleIds
      );

      cleanedCount = result.affectedRows || 0;

      for (const bottle of expiredBottles) {
        const logId = generateUUID();
        await conn.execute(
          'INSERT INTO bottle_operation_logs (id, bottle_id, user_id, operation_type, coin_cost, detail) VALUES (?, ?, ?, ?, ?, ?)',
          [logId, bottle.id, null, OPERATION_TYPES.EXPIRE_CLEANUP, 0, JSON.stringify({
            senderId: bottle.sender_id,
            createdAt: bottle.created_at,
            reason: 'expired'
          })]
        );
      }
    }

    detail.cleanedCount = cleanedCount;

    await conn.commit();

    const endTime = new Date();
    await logCleanup(OPERATION_TYPES.EXPIRE_CLEANUP, cleanedCount, startTime, endTime, detail);

    console.log(`[定时任务] 过期瓶子清理完成，共清理 ${cleanedCount} 个瓶子`);
    return { success: true, cleanedCount, detail };
  } catch (error) {
    await conn.rollback();
    console.error('[定时任务] 过期瓶子清理失败:', error);
    return { success: false, error: error.message };
  } finally {
    conn.release();
  }
}

async function cleanupPickLimitBottles() {
  const conn = await pool.getConnection();
  const startTime = new Date();
  let cleanedCount = 0;
  let detail = {};

  try {
    await conn.beginTransaction();

    const [limitBottles] = await conn.execute(
      `SELECT b.id, b.sender_id, b.pick_count, b.created_at
       FROM bottles b
       WHERE b.status = 'floating' 
         AND b.is_deleted = 0
         AND b.pick_count >= ?
       FOR UPDATE`,
      [MAX_PICK_COUNT]
    );

    detail.limitCount = limitBottles.length;

    if (limitBottles.length > 0) {
      const bottleIds = limitBottles.map(b => b.id);
      const placeholders = bottleIds.map(() => '?').join(',');

      const [result] = await conn.execute(
        `UPDATE bottles SET status = 'closed' WHERE id IN (${placeholders})`,
        bottleIds
      );

      cleanedCount = result.affectedRows || 0;

      for (const bottle of limitBottles) {
        const logId = generateUUID();
        await conn.execute(
          'INSERT INTO bottle_operation_logs (id, bottle_id, user_id, operation_type, coin_cost, detail) VALUES (?, ?, ?, ?, ?, ?)',
          [logId, bottle.id, null, OPERATION_TYPES.PICK_LIMIT_CLEANUP, 0, JSON.stringify({
            senderId: bottle.sender_id,
            pickCount: bottle.pick_count,
            reason: 'pick_limit_reached'
          })]
        );
      }
    }

    detail.cleanedCount = cleanedCount;

    await conn.commit();

    const endTime = new Date();
    await logCleanup(OPERATION_TYPES.PICK_LIMIT_CLEANUP, cleanedCount, startTime, endTime, detail);

    console.log(`[定时任务] 捞取次数上限瓶子处理完成，共处理 ${cleanedCount} 个瓶子`);
    return { success: true, cleanedCount, detail };
  } catch (error) {
    await conn.rollback();
    console.error('[定时任务] 捞取次数上限瓶子处理失败:', error);
    return { success: false, error: error.message };
  } finally {
    conn.release();
  }
}

function startScheduledTasks() {
  const expireTask = cron.schedule('0 2 * * *', async () => {
    console.log('[定时任务] 开始执行过期瓶子清理...');
    await cleanupExpiredBottles();
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });

  const pickLimitTask = cron.schedule('*/30 * * * *', async () => {
    console.log('[定时任务] 开始执行捞取次数上限检查...');
    await cleanupPickLimitBottles();
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });

  console.log('定时任务已启动');
  console.log(' - 过期瓶子清理: 每日凌晨2点执行');
  console.log(' - 捞取次数检查: 每30分钟执行一次');

  return { expireTask, pickLimitTask };
}

module.exports = {
  BOTTLE_EXPIRE_DAYS,
  MAX_PICK_COUNT,
  cleanupExpiredBottles,
  cleanupPickLimitBottles,
  startScheduledTasks
};
