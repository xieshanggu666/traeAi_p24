const { BOTTLE_EXPIRE_DAYS, MAX_PICK_COUNT, cleanupExpiredBottles, cleanupPickLimitBottles } = require('../utils/bottleScheduler');
const pool = require('../config/db');
const { generateUUID } = require('../utils/helper');

describe('bottleScheduler 定时任务模块', () => {
  let testUserId = null;

  beforeAll(async () => {
    testUserId = generateUUID();
    
    await pool.execute(
      'INSERT INTO users (id, username, password, nickname, avatar, coins) VALUES (?, ?, ?, ?, ?, ?)',
      [testUserId, `scheduler_test_${Date.now()}`, 'password', 'test', '🐱', 1000]
    );
  });

  afterAll(async () => {
    await pool.execute('DELETE FROM bottles WHERE sender_id = ?', [testUserId]);
    await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
  });

  test('BOTTLE_EXPIRE_DAYS 应该等于7', () => {
    expect(BOTTLE_EXPIRE_DAYS).toBe(7);
  });

  test('MAX_PICK_COUNT 应该等于5', () => {
    expect(MAX_PICK_COUNT).toBe(5);
  });

  test('cleanupExpiredBottles 应该是一个函数', () => {
    expect(typeof cleanupExpiredBottles).toBe('function');
  });

  test('cleanupPickLimitBottles 应该是一个函数', () => {
    expect(typeof cleanupPickLimitBottles).toBe('function');
  });

  test('cleanupExpiredBottles 应该能够正常执行', async () => {
    const result = await cleanupExpiredBottles();
    expect(result.success).toBe(true);
    expect(typeof result.cleanedCount).toBe('number');
    expect(result.cleanedCount).toBeGreaterThanOrEqual(0);
  });

  test('cleanupPickLimitBottles 应该能够正常执行', async () => {
    const result = await cleanupPickLimitBottles();
    expect(result.success).toBe(true);
    expect(typeof result.cleanedCount).toBe('number');
    expect(result.cleanedCount).toBeGreaterThanOrEqual(0);
  });

  test('应该清理已过期的漂流瓶', async () => {
    const bottleId = generateUUID();
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() - 3);

    await pool.execute(
      `INSERT INTO bottles (id, sender_id, content, status, created_at, expires_at, is_deleted) 
       VALUES (?, ?, ?, 'floating', ?, ?, 0)`,
      [bottleId, testUserId, '过期测试瓶子', pastDate, expireDate]
    );

    const result = await cleanupExpiredBottles();
    expect(result.success).toBe(true);

    const [rows] = await pool.execute(
      'SELECT * FROM bottles WHERE id = ?',
      [bottleId]
    );

    expect(rows.length).toBe(0);
  });
});
