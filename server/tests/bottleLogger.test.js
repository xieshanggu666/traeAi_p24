const { OPERATION_TYPES, logOperation, logCleanup } = require('../utils/bottleLogger');
const pool = require('../config/db');
const { generateUUID } = require('../utils/helper');

describe('bottleLogger 日志工具', () => {
  let testBottleId = null;
  let testUserId = null;
  let testLogId = null;

  beforeAll(async () => {
    testBottleId = generateUUID();
    testUserId = generateUUID();
  });

  afterAll(async () => {
    if (testLogId) {
      await pool.execute('DELETE FROM bottle_operation_logs WHERE id = ?', [testLogId]);
    }
  });

  test('OPERATION_TYPES 应该包含所有操作类型', () => {
    expect(OPERATION_TYPES.THROW).toBe('throw');
    expect(OPERATION_TYPES.PICK).toBe('pick');
    expect(OPERATION_TYPES.REPLY).toBe('reply');
    expect(OPERATION_TYPES.RECALL).toBe('recall');
    expect(OPERATION_TYPES.PIN).toBe('pin');
    expect(OPERATION_TYPES.EXPIRE_CLEANUP).toBe('expire_cleanup');
    expect(OPERATION_TYPES.PICK_LIMIT_CLEANUP).toBe('pick_limit_cleanup');
    expect(OPERATION_TYPES.RETURN).toBe('return');
  });

  test('logOperation 应该成功记录操作日志', async () => {
    const logId = await logOperation(
      testBottleId,
      testUserId,
      OPERATION_TYPES.THROW,
      0,
      { test: 'data' }
    );

    expect(logId).toBeTruthy();
    testLogId = logId;

    const [logs] = await pool.execute(
      'SELECT * FROM bottle_operation_logs WHERE id = ?',
      [logId]
    );

    expect(logs.length).toBe(1);
    expect(logs[0].bottle_id).toBe(testBottleId);
    expect(logs[0].user_id).toBe(testUserId);
    expect(logs[0].operation_type).toBe('throw');
    expect(logs[0].coin_cost).toBe(0);
  });

  test('logCleanup 应该成功记录清理日志', async () => {
    const startTime = new Date();
    const endTime = new Date();
    const logId = await logCleanup(
      OPERATION_TYPES.EXPIRE_CLEANUP,
      5,
      startTime,
      endTime,
      { cleaned: 5 }
    );

    expect(logId).toBeTruthy();

    const [logs] = await pool.execute(
      'SELECT * FROM bottle_cleanup_logs WHERE id = ?',
      [logId]
    );

    expect(logs.length).toBe(1);
    expect(logs[0].cleanup_type).toBe('expire_cleanup');
    expect(logs[0].cleaned_count).toBe(5);

    await pool.execute('DELETE FROM bottle_cleanup_logs WHERE id = ?', [logId]);
  });

  test('logOperation 不传 detail 参数应该正常工作', async () => {
    const logId = await logOperation(
      testBottleId,
      testUserId,
      OPERATION_TYPES.PICK
    );

    expect(logId).toBeTruthy();

    await pool.execute('DELETE FROM bottle_operation_logs WHERE id = ?', [logId]);
  });
});
