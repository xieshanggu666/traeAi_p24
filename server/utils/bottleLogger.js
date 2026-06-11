const pool = require('../config/db');
const { generateUUID } = require('./helper');

const OPERATION_TYPES = {
  THROW: 'throw',
  PICK: 'pick',
  REPLY: 'reply',
  RECALL: 'recall',
  PIN: 'pin',
  EXPIRE_CLEANUP: 'expire_cleanup',
  PICK_LIMIT_CLEANUP: 'pick_limit_cleanup',
  RETURN: 'return'
};

async function logOperation(bottleId, userId, operationType, coinCost = 0, detail = null, conn = null) {
  try {
    const db = conn || pool;
    const logId = generateUUID();
    await db.execute(
      'INSERT INTO bottle_operation_logs (id, bottle_id, user_id, operation_type, coin_cost, detail) VALUES (?, ?, ?, ?, ?, ?)',
      [logId, bottleId, userId, operationType, coinCost, detail ? JSON.stringify(detail) : null]
    );
    return logId;
  } catch (error) {
    console.error('记录瓶子操作日志失败:', error);
    return null;
  }
}

async function logCleanup(cleanupType, cleanedCount, startTime, endTime, detail = null, conn = null) {
  try {
    const db = conn || pool;
    const logId = generateUUID();
    await db.execute(
      'INSERT INTO bottle_cleanup_logs (id, cleanup_type, cleaned_count, start_time, end_time, detail) VALUES (?, ?, ?, ?, ?, ?)',
      [logId, cleanupType, cleanedCount, startTime, endTime, detail ? JSON.stringify(detail) : null]
    );
    return logId;
  } catch (error) {
    console.error('记录清理日志失败:', error);
    return null;
  }
}

module.exports = {
  OPERATION_TYPES,
  logOperation,
  logCleanup
};
