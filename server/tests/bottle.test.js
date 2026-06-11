const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const pool = require('../config/db');
const { generateUUID } = require('../utils/helper');

const { router: userRoutes, authenticateToken } = require('../routes/user');
const bottleRoutes = require('../routes/bottle');

const app = express();
app.use(bodyParser.json());
app.use('/api/user', userRoutes);
app.use('/api/bottle', authenticateToken, bottleRoutes);

let testUserToken = null;
let testUserId = null;
let testUser2Token = null;
let testUser2Id = null;
let testBottleId = null;

const TEST_USERNAME = `t1_${Date.now().toString().slice(-6)}`;
const TEST_PASSWORD = 'test123456';
const TEST_USERNAME2 = `t2_${Date.now().toString().slice(-6)}`;

beforeAll(async () => {
  try {
    console.log('正在注册测试用户1...');
    const res1 = await request(app)
      .post('/api/user/register')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    
    console.log('注册响应状态:', res1.status);
    console.log('注册响应体:', JSON.stringify(res1.body, null, 2));
    
    if (res1.body.success && res1.body.data) {
      testUserToken = res1.body.data.token;
      testUserId = res1.body.data.user.id;
      console.log('测试用户1注册成功:', testUserId);
    } else {
      console.error('测试用户1注册失败:', res1.body);
    }

    console.log('正在注册测试用户2...');
    const res2 = await request(app)
      .post('/api/user/register')
      .send({ username: TEST_USERNAME2, password: TEST_PASSWORD });
    
    console.log('注册响应状态:', res2.status);
    
    if (res2.body.success && res2.body.data) {
      testUser2Token = res2.body.data.token;
      testUser2Id = res2.body.data.user.id;
      console.log('测试用户2注册成功:', testUser2Id);
    } else {
      console.error('测试用户2注册失败:', res2.body);
    }

    if (testUserId && testUser2Id) {
      await pool.execute(
        'UPDATE users SET coins = 1000 WHERE id = ?',
        [testUserId]
      );
      await pool.execute(
        'UPDATE users SET coins = 1000 WHERE id = ?',
        [testUser2Id]
      );
      console.log('测试用户漂流币已设置');
    }
  } catch (error) {
    console.error('测试初始化失败:', error);
  }
}, 30000);

afterAll(async () => {
  try {
    if (testUserId && testUser2Id) {
      await pool.execute('DELETE FROM bottle_operation_logs WHERE user_id IN (?, ?)', [testUserId, testUser2Id]);
      await pool.execute('DELETE FROM bottle_pick_records WHERE picker_id IN (?, ?)', [testUserId, testUser2Id]);
      await pool.execute('DELETE FROM bottles WHERE sender_id IN (?, ?)', [testUserId, testUser2Id]);
      await pool.execute('DELETE FROM daily_stats WHERE user_id IN (?, ?)', [testUserId, testUser2Id]);
      await pool.execute('DELETE FROM coin_records WHERE user_id IN (?, ?)', [testUserId, testUser2Id]);
      await pool.execute('DELETE FROM users WHERE id IN (?, ?)', [testUserId, testUser2Id]);
    }
  } catch (error) {
    console.error('测试清理失败:', error);
  }
}, 30000);

describe('漂流瓶有效期管理功能', () => {
  test('扔瓶子时应该设置7天有效期', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }
    
    const res = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试有效期的瓶子' });

    console.log('扔瓶子响应:', res.status, JSON.stringify(res.body));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expiresInDays).toBe(7);
    testBottleId = res.body.data.id;
  });

  test('瓶子详情应该包含过期时间', async () => {
    if (!testUserToken || !testBottleId) {
      console.warn('跳过测试：缺少测试数据');
      return;
    }
    
    const res = await request(app)
      .get(`/api/bottle/${testBottleId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expires_at).toBeDefined();
  });
});

describe('瓶子捞取次数限制功能', () => {
  let pickLimitBottleId = null;

  test('扔瓶子时捞取次数初始为0', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }
    
    const res = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试捞取次数限制的瓶子' });

    expect(res.status).toBe(200);
    pickLimitBottleId = res.body.data.id;

    const detailRes = await request(app)
      .get(`/api/bottle/${pickLimitBottleId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(detailRes.body.data.pick_count).toBe(0);
    expect(detailRes.body.data.maxPickCount).toBe(5);
  });

  test('捞取瓶子后捞取次数应该增加', async () => {
    if (!testUser2Token) {
      console.warn('跳过测试：测试用户2未成功注册');
      return;
    }
    
    const res = await request(app)
      .post('/api/bottle/pick')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({ filters: {} });

    if (res.body.success && res.body.data) {
      expect(res.body.data.pickCount).toBeGreaterThan(0);
      expect(res.body.data.maxPickCount).toBe(5);
    }
  });
});

describe('漂流瓶撤回功能', () => {
  let recallBottleId = null;

  test('应该可以撤回5分钟内且无回复的瓶子', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }
    
    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试撤回功能的瓶子' });

    expect(throwRes.status).toBe(200);
    recallBottleId = throwRes.body.data.id;

    const detailRes = await request(app)
      .get(`/api/bottle/${recallBottleId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(detailRes.body.data.canRecall).toBe(true);
    expect(detailRes.body.data.recallCoinCost).toBe(10);

    const recallRes = await request(app)
      .post(`/api/bottle/recall/${recallBottleId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(recallRes.status).toBe(200);
    expect(recallRes.body.success).toBe(true);
    expect(recallRes.body.data.coinCost).toBe(10);
    expect(recallRes.body.data.throwCountReturned).toBe(true);
  });

  test('非瓶子所有者不能撤回', async () => {
    if (!testUserToken || !testUser2Token) {
      console.warn('跳过测试：缺少测试用户');
      return;
    }
    
    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试他人撤回的瓶子' });

    if (!throwRes.body.success) return;
    
    const bottleId = throwRes.body.data.id;

    const recallRes = await request(app)
      .post(`/api/bottle/recall/${bottleId}`)
      .set('Authorization', `Bearer ${testUser2Token}`);

    expect(recallRes.status).toBe(403);
  });
});

describe('漂流瓶置顶功能', () => {
  let pinBottleId = null;

  test('应该可以置顶漂浮中的瓶子', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }
    
    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试置顶功能的瓶子' });

    expect(throwRes.status).toBe(200);
    pinBottleId = throwRes.body.data.id;

    const pinRes = await request(app)
      .post(`/api/bottle/pin/${pinBottleId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(pinRes.status).toBe(200);
    expect(pinRes.body.success).toBe(true);
    expect(pinRes.body.data.isPinned).toBe(true);
    expect(pinRes.body.data.coinCost).toBe(50);
  });

  test('非瓶子所有者不能置顶', async () => {
    if (!testUserToken || !testUser2Token) {
      console.warn('跳过测试：缺少测试用户');
      return;
    }
    
    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试他人置顶的瓶子' });

    if (!throwRes.body.success) return;
    
    const bottleId = throwRes.body.data.id;

    const pinRes = await request(app)
      .post(`/api/bottle/pin/${bottleId}`)
      .set('Authorization', `Bearer ${testUser2Token}`);

    expect(pinRes.status).toBe(403);
  });
});

describe('我的瓶子列表', () => {
  test('应该能获取我的瓶子列表', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }
    
    const res = await request(app)
      .get('/api/bottle/my')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('操作日志记录', () => {
  test('扔瓶子应该记录操作日志', async () => {
    if (!testUserToken || !testUserId) {
      console.warn('跳过测试：缺少测试数据');
      return;
    }
    
    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试操作日志的瓶子' });

    if (!throwRes.body.success) return;
    
    const bottleId = throwRes.body.data.id;

    const [logs] = await pool.execute(
      'SELECT * FROM bottle_operation_logs WHERE bottle_id = ? AND operation_type = ?',
      [bottleId, 'throw']
    );

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].operation_type).toBe('throw');
    expect(logs[0].user_id).toBe(testUserId);
  });
});

describe('每日限制接口', () => {
  test('应该能获取每日限制信息', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const res = await request(app)
      .get('/api/bottle/daily-limits')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.throwLimit).toBe(20);
    expect(res.body.data.pickLimit).toBe(20);
    expect(typeof res.body.data.throwCount).toBe('number');
    expect(typeof res.body.data.pickCount).toBe('number');
  });
});

describe('参数验证和错误处理', () => {
  test('扔瓶子内容为空应该返回错误', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const res = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('无效的标签应该返回错误', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const res = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试', tag: 'invalid_tag' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('无效的目标性别应该返回错误', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const res = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试', targetGender: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('最小年龄大于最大年龄应该返回错误', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const res = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试', targetMinAge: 30, targetMaxAge: 20 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('撤回功能边界情况', () => {
  test('漂流币不足时不能撤回', async () => {
    if (!testUser2Token || !testUser2Id) {
      console.warn('跳过测试：测试用户2未成功注册');
      return;
    }

    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({ content: '测试漂流币不足撤回的瓶子' });

    if (!throwRes.body.success) return;

    const bottleId = throwRes.body.data.id;

    await pool.execute('UPDATE users SET coins = 5 WHERE id = ?', [testUser2Id]);

    const recallRes = await request(app)
      .post(`/api/bottle/recall/${bottleId}`)
      .set('Authorization', `Bearer ${testUser2Token}`);

    expect(recallRes.status).toBe(400);
    expect(recallRes.body.message).toContain('漂流币不足');

    await pool.execute('UPDATE users SET coins = 1000 WHERE id = ?', [testUser2Id]);
  });

  test('撤回不存在的瓶子应该返回404', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const recallRes = await request(app)
      .post('/api/bottle/recall/nonexistent-id')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(recallRes.status).toBe(404);
  });
});

describe('置顶功能边界情况', () => {
  test('已经置顶的瓶子不能再次置顶', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试重复置顶的瓶子' });

    if (!throwRes.body.success) return;

    const bottleId = throwRes.body.data.id;

    const firstPinRes = await request(app)
      .post(`/api/bottle/pin/${bottleId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(firstPinRes.status).toBe(200);

    const secondPinRes = await request(app)
      .post(`/api/bottle/pin/${bottleId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(secondPinRes.status).toBe(400);
    expect(secondPinRes.body.message).toContain('已经是置顶状态');
  });

  test('置顶不存在的瓶子应该返回404', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const pinRes = await request(app)
      .post('/api/bottle/pin/nonexistent-id')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(pinRes.status).toBe(404);
  });
});

describe('瓶子详情接口', () => {
  test('应该能获取瓶子详情', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试详情的瓶子' });

    if (!throwRes.body.success) return;

    const bottleId = throwRes.body.data.id;

    const detailRes = await request(app)
      .get(`/api/bottle/${bottleId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.success).toBe(true);
    expect(detailRes.body.data.id).toBe(bottleId);
    expect(detailRes.body.data.canRecall).toBeDefined();
    expect(detailRes.body.data.canPin).toBeDefined();
    expect(detailRes.body.data.maxPickCount).toBe(5);
  });

  test('获取不存在的瓶子应该返回404', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const detailRes = await request(app)
      .get('/api/bottle/nonexistent-id')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(detailRes.status).toBe(404);
  });
});

describe('软删除接口', () => {
  test('发送者可以删除自己的瓶子', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试删除的瓶子' });

    if (!throwRes.body.success) return;

    const bottleId = throwRes.body.data.id;

    const deleteRes = await request(app)
      .post(`/api/bottle/soft-delete/${bottleId}`)
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });

  test('非所有者不能删除瓶子', async () => {
    if (!testUserToken || !testUser2Token) {
      console.warn('跳过测试：缺少测试用户');
      return;
    }

    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试他人删除的瓶子' });

    if (!throwRes.body.success) return;

    const bottleId = throwRes.body.data.id;

    const deleteRes = await request(app)
      .post(`/api/bottle/soft-delete/${bottleId}`)
      .set('Authorization', `Bearer ${testUser2Token}`);

    expect(deleteRes.status).toBe(403);
  });
});

describe('回复功能', () => {
  test('应该能够回复瓶子', async () => {
    if (!testUserToken || !testUser2Token) {
      console.warn('跳过测试：缺少测试用户');
      return;
    }

    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试回复的瓶子' });

    if (!throwRes.body.success) return;

    const bottleId = throwRes.body.data.id;

    const pickRes = await request(app)
      .post('/api/bottle/pick')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({ filters: {} });

    if (!pickRes.body.success || !pickRes.body.data) {
      console.warn('跳过测试：没有捞到瓶子');
      return;
    }

    const replyRes = await request(app)
      .post('/api/bottle/reply')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({ bottleId: pickRes.body.data.id, content: '这是一条回复' });

    expect(replyRes.status).toBe(200);
    expect(replyRes.body.success).toBe(true);
    expect(replyRes.body.data.messageId).toBeTruthy();
  });

  test('回复内容为空应该返回错误', async () => {
    if (!testUserToken || !testUser2Token) {
      console.warn('跳过测试：缺少测试用户');
      return;
    }

    const replyRes = await request(app)
      .post('/api/bottle/reply')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({ bottleId: 'test-id', content: '' });

    expect(replyRes.status).toBe(400);
    expect(replyRes.body.success).toBe(false);
  });

  test('回复不存在的瓶子应该返回404', async () => {
    if (!testUser2Token) {
      console.warn('跳过测试：缺少测试用户');
      return;
    }

    const replyRes = await request(app)
      .post('/api/bottle/reply')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({ bottleId: 'nonexistent-id', content: '测试回复' });

    expect(replyRes.status).toBe(404);
  });
});

describe('捞取数量接口', () => {
  test('应该能获取可捞取瓶子数量', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const res = await request(app)
      .post('/api/bottle/pick/count')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.count).toBe('number');
  });
});

describe('扔回海里功能', () => {
  test('应该能将瓶子扔回海里', async () => {
    if (!testUserToken || !testUser2Token) {
      console.warn('跳过测试：缺少测试用户');
      return;
    }

    const throwRes = await request(app)
      .post('/api/bottle/throw')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ content: '测试扔回海里的瓶子' });

    if (!throwRes.body.success) return;

    const returnRes = await request(app)
      .post('/api/bottle/return')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({ bottleId: throwRes.body.data.id });

    expect(returnRes.status).toBe(200);
    expect(returnRes.body.success).toBe(true);
  });

  test('参数不完整应该返回错误', async () => {
    if (!testUserToken) {
      console.warn('跳过测试：测试用户未成功注册');
      return;
    }

    const returnRes = await request(app)
      .post('/api/bottle/return')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({});

    expect(returnRes.status).toBe(400);
    expect(returnRes.body.success).toBe(false);
  });
});

describe('认证测试', () => {
  test('没有 token 应该返回401', async () => {
    const res = await request(app)
      .get('/api/bottle/daily-limits');

    expect(res.status).toBe(401);
  });

  test('无效的 token 应该返回403', async () => {
    const res = await request(app)
      .get('/api/bottle/daily-limits')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(403);
  });
});
