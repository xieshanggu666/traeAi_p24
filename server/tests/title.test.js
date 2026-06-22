const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const pool = require('../config/db');
const { generateUUID } = require('../utils/helper');

const { router: userRoutes, authenticateToken } = require('../routes/user');
const titleRoutes = require('../routes/title');
const { 
  grantTitle, 
  equipTitle, 
  getUserTitles, 
  getEquippedTitle, 
  checkAchievementTitles,
  hasTitle,
  checkAndGrantRankTitle,
  checkAndGrantAllRankTitles
} = require('../utils/titleManager');
const { migrateTitles: initTitles } = require('../config/migrateTitles');

const app = express();
app.use(bodyParser.json());
app.use('/api/user', userRoutes);
app.use('/api/title', authenticateToken, titleRoutes);

let testUserToken = null;
let testUserId = null;

const TEST_USERNAME = `tt_${Date.now().toString().slice(-6)}`;
const TEST_PASSWORD = 'test123456';

beforeAll(async () => {
  console.log('初始化称号数据...');
  await initTitles();
  
  console.log('正在注册测试用户...');
  const res = await request(app)
    .post('/api/user/register')
    .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
  
  if (res.body.success && res.body.data) {
    testUserToken = res.body.data.token;
    testUserId = res.body.data.user.id;
    console.log('测试用户注册成功:', testUserId);
  } else {
    console.error('测试用户注册失败:', res.body);
  }
});

afterAll(async () => {
  if (testUserId) {
    await pool.execute('DELETE FROM user_titles WHERE user_id = ?', [testUserId]);
    await pool.execute('DELETE FROM notifications WHERE user_id = ?', [testUserId]);
    await pool.execute('DELETE FROM users WHERE id = ?', [testUserId]);
  }
  await pool.end();
});

describe('称号管理 API 测试', () => {
  test('获取我的称号列表', async () => {
    const res = await request(app)
      .get('/api/title/mine')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('titles');
    expect(res.body.data).toHaveProperty('equipped');
    expect(Array.isArray(res.body.data.titles)).toBe(true);
  });

  test('获取所有称号列表', async () => {
    const res = await request(app)
      .get('/api/title/list')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('获取当前佩戴的称号', async () => {
    const res = await request(app)
      .get('/api/title/equipped')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('称号管理工具函数测试', () => {
  test('grantTitle - 授予用户称号', async () => {
    const result = await grantTitle(testUserId, 'chat_master', 'test');
    
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('isFirstTime', true);
    expect(result.title).toHaveProperty('id', 'chat_master');
    
    const userTitles = await getUserTitles(testUserId);
    const hasTitle = userTitles.some(t => t.title_id === 'chat_master');
    expect(hasTitle).toBe(true);
  });

  test('grantTitle - 重复授予称号（不重复添加）', async () => {
    const result = await grantTitle(testUserId, 'chat_master', 'test');
    
    expect(result).toHaveProperty('isFirstTime', false);
    
    const userTitles = await getUserTitles(testUserId);
    const chatMasterTitles = userTitles.filter(t => t.title_id === 'chat_master');
    expect(chatMasterTitles.length).toBe(1);
  });

  test('grantTitle - 授予不存在的称号应该抛出错误', async () => {
    await expect(grantTitle(testUserId, 'non_existent_title', 'test'))
      .rejects.toThrow('称号不存在');
  });

  test('equipTitle - 佩戴称号', async () => {
    await grantTitle(testUserId, 'signin_master', 'test');
    
    const result = await equipTitle(testUserId, 'signin_master');
    expect(result).toHaveProperty('id', 'signin_master');
    
    const equipped = await getEquippedTitle(testUserId);
    expect(equipped).not.toBeNull();
    expect(equipped.title_id).toBe('signin_master');
  });

  test('equipTitle - 佩戴未获得的称号应该抛出错误', async () => {
    const randomUserId = generateUUID();
    await expect(equipTitle(randomUserId, 'tycoon'))
      .rejects.toThrow();
  });

  test('hasTitle - 检查用户是否拥有称号', async () => {
    const hasChatMaster = await hasTitle(testUserId, 'chat_master');
    expect(hasChatMaster).toBe(true);
    
    const hasTycoon = await hasTitle(testUserId, 'tycoon');
    expect(hasTycoon).toBe(false);
  });

  test('getUserTitles - 获取用户称号列表', async () => {
    const titles = await getUserTitles(testUserId);
    expect(Array.isArray(titles)).toBe(true);
    expect(titles.length).toBeGreaterThan(0);
  });

  test('getEquippedTitle - 获取当前佩戴的称号', async () => {
    const equipped = await getEquippedTitle(testUserId);
    expect(equipped).not.toBeNull();
    expect(equipped).toHaveProperty('title_id');
    expect(equipped).toHaveProperty('name');
  });

  test('checkAchievementTitles - 检查成就称号', async () => {
    const testUserId2 = generateUUID();
    await pool.execute(
      `INSERT INTO users (id, username, password, nickname, coins, charm) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [testUserId2, `test2_${Date.now()}`, 'test', '测试用户2', 0, 0]
    );
    
    const result = await checkAchievementTitles(testUserId2);
    expect(Array.isArray(result)).toBe(true);
    
    await pool.execute('DELETE FROM user_titles WHERE user_id = ?', [testUserId2]);
    await pool.execute('DELETE FROM notifications WHERE user_id = ?', [testUserId2]);
    await pool.execute('DELETE FROM users WHERE id = ?', [testUserId2]);
  });
});

describe('称号数据验证测试', () => {
  test('称号数据结构完整', async () => {
    const res = await request(app)
      .get('/api/title/list')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    const titles = res.body.data;
    expect(titles.length).toBeGreaterThan(0);
    
    const title = titles[0];
    expect(title).toHaveProperty('id');
    expect(title).toHaveProperty('name');
    expect(title).toHaveProperty('description');
    expect(title).toHaveProperty('icon');
    expect(title).toHaveProperty('color');
    expect(title).toHaveProperty('type');
    expect(title).toHaveProperty('rarity');
    expect(title).toHaveProperty('validity_type');
  });

  test('包含所有必选称号类型', async () => {
    const res = await request(app)
      .get('/api/title/list')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    const titles = res.body.data;
    const titleIds = titles.map(t => t.id);
    
    expect(titleIds).toContain('tycoon');
    expect(titleIds).toContain('heartthrob');
    expect(titleIds).toContain('signin_master');
    expect(titleIds).toContain('chat_master');
    expect(titleIds).toContain('sharing_expert');
    expect(titleIds).toContain('interaction_star');
    expect(titleIds).toContain('task_master');
  });

  test('称号稀有度分类正确', async () => {
    const res = await request(app)
      .get('/api/title/list')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    const titles = res.body.data;
    const validRarities = ['common', 'rare', 'epic', 'legendary'];
    
    titles.forEach(title => {
      expect(validRarities).toContain(title.rarity);
    });
  });

  test('排行榜称号类型为 rank', async () => {
    const res = await request(app)
      .get('/api/title/list')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    const titles = res.body.data;
    const tycoon = titles.find(t => t.id === 'tycoon');
    const heartthrob = titles.find(t => t.id === 'heartthrob');
    
    expect(tycoon.type).toBe('rank');
    expect(heartthrob.type).toBe('rank');
  });

  test('成就称号类型为 achievement', async () => {
    const res = await request(app)
      .get('/api/title/list')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    const titles = res.body.data;
    const achievementTitles = titles.filter(t => t.type === 'achievement');
    
    expect(achievementTitles.length).toBeGreaterThan(0);
  });
});

describe('称号 API 权限测试', () => {
  test('未授权访问称号接口应该返回 401', async () => {
    const res = await request(app)
      .get('/api/title/mine');
    
    expect(res.status).toBe(401);
  });

  test('无效 token 访问应该返回 403', async () => {
    const res = await request(app)
      .get('/api/title/mine')
      .set('Authorization', 'Bearer invalid_token');
    
    expect(res.status).toBe(403);
  });
});

describe('称号佩戴 API 测试', () => {
  test('佩戴称号 API', async () => {
    await grantTitle(testUserId, 'task_master', 'test');
    
    const res = await request(app)
      .post('/api/title/equip/task_master')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', 'task_master');
  });

  test('佩戴未获得的称号应该失败', async () => {
    const res = await request(app)
      .post('/api/title/equip/tycoon')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('卸下称号 API', async () => {
    const res = await request(app)
      .post('/api/title/unequip/task_master')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('检查成就称号 API', async () => {
    const res = await request(app)
      .post('/api/title/check-achievements')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('newTitles');
    expect(Array.isArray(res.body.data.newTitles)).toBe(true);
  });
});

describe('通知系统 API 测试', () => {
  test('获取通知列表', async () => {
    const res = await request(app)
      .get('/api/title/notifications?page=1&pageSize=20')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('list');
    expect(res.body.data).toHaveProperty('total');
  });

  test('获取未读通知数量', async () => {
    const res = await request(app)
      .get('/api/title/notifications/unread-count')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('count');
    expect(typeof res.body.data.count).toBe('number');
  });
});

describe('排行榜称号实时授予测试', () => {
  let rankTestUserId1 = null;
  let rankTestUserId2 = null;

  beforeAll(async () => {
    rankTestUserId1 = generateUUID();
    rankTestUserId2 = generateUUID();
    await pool.execute(
      `INSERT INTO users (id, username, password, nickname, coins, charm) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rankTestUserId1, `rank_test1_${Date.now()}`, 'test', '排行榜测试用户1', 0, 0]
    );
    await pool.execute(
      `INSERT INTO users (id, username, password, nickname, coins, charm) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rankTestUserId2, `rank_test2_${Date.now()}`, 'test', '排行榜测试用户2', 0, 0]
    );
  });

  afterAll(async () => {
    if (rankTestUserId1) {
      await pool.execute('DELETE FROM user_titles WHERE user_id = ?', [rankTestUserId1]);
      await pool.execute('DELETE FROM notifications WHERE user_id = ?', [rankTestUserId1]);
      await pool.execute('DELETE FROM users WHERE id = ?', [rankTestUserId1]);
    }
    if (rankTestUserId2) {
      await pool.execute('DELETE FROM user_titles WHERE user_id = ?', [rankTestUserId2]);
      await pool.execute('DELETE FROM notifications WHERE user_id = ?', [rankTestUserId2]);
      await pool.execute('DELETE FROM users WHERE id = ?', [rankTestUserId2]);
    }
  });

  test('checkAndGrantRankTitle - 无效的排行榜类型应返回 null', async () => {
    const result = await checkAndGrantRankTitle(rankTestUserId1, 'invalid_type');
    expect(result).toBeNull();
  });

  test('checkAndGrantRankTitle - 用户金币为0时不应获得土豪称号', async () => {
    const result = await checkAndGrantRankTitle(rankTestUserId1, 'wealth');
    expect(result).toBeNull();
    const hasTycoon = await hasTitle(rankTestUserId1, 'tycoon');
    expect(hasTycoon).toBe(false);
  });

  test('checkAndGrantRankTitle - 用户魅力值为0时不应获得万人迷称号', async () => {
    const result = await checkAndGrantRankTitle(rankTestUserId1, 'charm');
    expect(result).toBeNull();
    const hasHeartthrob = await hasTitle(rankTestUserId1, 'heartthrob');
    expect(hasHeartthrob).toBe(false);
  });

  test('checkAndGrantRankTitle - 用户成为财富榜第一时获得土豪称号', async () => {
    await pool.execute('UPDATE users SET coins = 999999 WHERE id = ?', [rankTestUserId1]);
    
    const result = await checkAndGrantRankTitle(rankTestUserId1, 'wealth');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('title');
    expect(result.title).toHaveProperty('id', 'tycoon');
    expect(result.title).toHaveProperty('name', '土豪');
    
    const hasTycoon = await hasTitle(rankTestUserId1, 'tycoon');
    expect(hasTycoon).toBe(true);
  });

  test('checkAndGrantRankTitle - 用户成为魅力榜第一时获得万人迷称号', async () => {
    await pool.execute('UPDATE users SET charm = 999999 WHERE id = ?', [rankTestUserId1]);
    
    const result = await checkAndGrantRankTitle(rankTestUserId1, 'charm');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('title');
    expect(result.title).toHaveProperty('id', 'heartthrob');
    expect(result.title).toHaveProperty('name', '万人迷');
    
    const hasHeartthrob = await hasTitle(rankTestUserId1, 'heartthrob');
    expect(hasHeartthrob).toBe(true);
  });

  test('土豪称号有效期应为24小时', async () => {
    const userTitles = await getUserTitles(rankTestUserId1);
    const tycoonTitle = userTitles.find(t => t.title_id === 'tycoon');
    expect(tycoonTitle).not.toBeUndefined();
    expect(tycoonTitle.validity_type).toBe('duration');
    expect(tycoonTitle.validity_value).toBe(24);
    expect(tycoonTitle.validity_unit).toBe('hour');
    expect(tycoonTitle.expires_at).not.toBeNull();
    
    if (tycoonTitle.expires_at) {
      const expiresAt = new Date(tycoonTitle.expires_at);
      const now = new Date();
      const diffHours = (expiresAt - now) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThan(25);
    }
  });

  test('万人迷称号有效期应为24小时', async () => {
    const userTitles = await getUserTitles(rankTestUserId1);
    const heartthrobTitle = userTitles.find(t => t.title_id === 'heartthrob');
    expect(heartthrobTitle).not.toBeUndefined();
    expect(heartthrobTitle.validity_type).toBe('duration');
    expect(heartthrobTitle.validity_value).toBe(24);
    expect(heartthrobTitle.validity_unit).toBe('hour');
    expect(heartthrobTitle.expires_at).not.toBeNull();
    
    if (heartthrobTitle.expires_at) {
      const expiresAt = new Date(heartthrobTitle.expires_at);
      const now = new Date();
      const diffHours = (expiresAt - now) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23);
      expect(diffHours).toBeLessThan(25);
    }
  });

  test('checkAndGrantAllRankTitles - 同时检查两个排行榜', async () => {
    await pool.execute('DELETE FROM user_titles WHERE user_id = ?', [rankTestUserId1]);
    await pool.execute('UPDATE users SET coins = 888888, charm = 777777 WHERE id = ?', [rankTestUserId1]);
    
    const results = await checkAndGrantAllRankTitles(rankTestUserId1);
    expect(results).toHaveProperty('wealth');
    expect(results).toHaveProperty('charm');
    expect(results.wealth).not.toBeNull();
    expect(results.charm).not.toBeNull();
    
    const hasTycoon = await hasTitle(rankTestUserId1, 'tycoon');
    const hasHeartthrob = await hasTitle(rankTestUserId1, 'heartthrob');
    expect(hasTycoon).toBe(true);
    expect(hasHeartthrob).toBe(true);
  });

  test('非第一名用户不应获得排行榜称号', async () => {
    await pool.execute('DELETE FROM user_titles WHERE user_id = ?', [rankTestUserId2]);
    await pool.execute('UPDATE users SET coins = 100, charm = 100 WHERE id = ?', [rankTestUserId2]);
    
    const results = await checkAndGrantAllRankTitles(rankTestUserId2);
    expect(results.wealth).toBeNull();
    expect(results.charm).toBeNull();
    
    const hasTycoon = await hasTitle(rankTestUserId2, 'tycoon');
    const hasHeartthrob = await hasTitle(rankTestUserId2, 'heartthrob');
    expect(hasTycoon).toBe(false);
    expect(hasHeartthrob).toBe(false);
  });
});
