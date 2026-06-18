const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('../utils/helper');
const { SKIN_PRICES, DURATION_HOURS } = require('../config/migrateSkins');
const { PRICE as AVATAR_FRAME_PRICE } = require('../config/migrateAvatarAndChatSkins');
const { isBlockedBy, hasBlocked } = require('./user');

let hasMsgTypeColumn = null;
let hasUserIntimacyTable = null;
let hasIsBlockedColumn = null;

async function checkMsgTypeColumn() {
  if (hasMsgTypeColumn !== null) return hasMsgTypeColumn;
  try {
    await pool.execute('SELECT type FROM messages LIMIT 0');
    hasMsgTypeColumn = true;
  } catch {
    hasMsgTypeColumn = false;
  }
  return hasMsgTypeColumn;
}

async function checkIsBlockedColumn() {
  if (hasIsBlockedColumn !== null) return hasIsBlockedColumn;
  try {
    await pool.execute('SELECT is_blocked FROM messages LIMIT 0');
    hasIsBlockedColumn = true;
  } catch {
    hasIsBlockedColumn = false;
  }
  return hasIsBlockedColumn;
}

async function checkUserIntimacyTable() {
  if (hasUserIntimacyTable !== null) return hasUserIntimacyTable;
  try {
    await pool.execute('SELECT 1 FROM user_intimacy LIMIT 0');
    hasUserIntimacyTable = true;
  } catch {
    hasUserIntimacyTable = false;
  }
  return hasUserIntimacyTable;
}

function normalizeUserPair(userIdA, userIdB) {
  if (userIdA < userIdB) {
    return { user_id1: userIdA, user_id2: userIdB };
  }
  return { user_id1: userIdB, user_id2: userIdA };
}

async function ensureUserIntimacy(userIdA, userIdB) {
  const { user_id1, user_id2 } = normalizeUserPair(userIdA, userIdB);
  const [rows] = await pool.execute(
    'SELECT id FROM user_intimacy WHERE user_id1 = ? AND user_id2 = ?',
    [user_id1, user_id2]
  );
  if (rows.length === 0) {
    const { generateUUID } = require('../utils/helper');
    const id = generateUUID();
    await pool.execute(
      'INSERT INTO user_intimacy (id, user_id1, user_id2, intimacy_value) VALUES (?, ?, ?, 0)',
      [id, user_id1, user_id2]
    );
  }
}

async function addIntimacyByUserPair(userIdA, userIdB, amount) {
  const tableExists = await checkUserIntimacyTable();
  if (!tableExists) return;
  await ensureUserIntimacy(userIdA, userIdB);
  const { user_id1, user_id2 } = normalizeUserPair(userIdA, userIdB);
  await pool.execute(
    'UPDATE user_intimacy SET intimacy_value = intimacy_value + ? WHERE user_id1 = ? AND user_id2 = ?',
    [amount, user_id1, user_id2]
  );
}

async function getBottleUserPair(bottleId) {
  const [rows] = await pool.execute(
    'SELECT sender_id, picker_id FROM bottles WHERE id = ?',
    [bottleId]
  );
  if (rows.length === 0) return null;
  const { sender_id, picker_id } = rows[0];
  if (!sender_id || !picker_id) return null;
  return normalizeUserPair(sender_id, picker_id);
}

async function addIntimacy(bottleId, amount) {
  const pair = await getBottleUserPair(bottleId);
  if (!pair) return;
  await addIntimacyByUserPair(pair.user_id1, pair.user_id2, amount);
}

const PRODUCTS = [
  {
    key: 'retro_card',
    name: '补签卡',
    description: '可在日历上点击未签到的日期使用，成功补签对应日期',
    price: 10,
    dailyLimit: 1,
    icon: '📅',
    category: 'function'
  },
  {
    key: 'throw_card',
    name: '扔瓶卡',
    description: '使用后增加扔瓶子的次数+1',
    price: 5,
    dailyLimit: 0,
    icon: '📤',
    category: 'function'
  },
  {
    key: 'pick_card',
    name: '捞瓶卡',
    description: '使用后增加捞瓶子的次数+1',
    price: 5,
    dailyLimit: 0,
    icon: '📥',
    category: 'function'
  },
  {
    key: 'gift_flower',
    name: '鲜花',
    description: '赠送后对方魅力值+10',
    price: 10,
    dailyLimit: 0,
    icon: '💐',
    category: 'gift',
    charmValue: 10
  },
  {
    key: 'gift_cake',
    name: '蛋糕',
    description: '赠送后对方魅力值+50',
    price: 50,
    dailyLimit: 0,
    icon: '🎂',
    category: 'gift',
    charmValue: 50
  },
  {
    key: 'gift_chocolate',
    name: '巧克力',
    description: '赠送后对方魅力值+20',
    price: 20,
    dailyLimit: 0,
    icon: '🍫',
    category: 'gift',
    charmValue: 20
  },
  {
    key: 'gift_wine',
    name: '红酒',
    description: '赠送后对方魅力值+88',
    price: 88,
    dailyLimit: 0,
    icon: '🍷',
    category: 'gift',
    charmValue: 88
  },
  {
    key: 'gift_ring',
    name: '戒指',
    description: '赠送后对方魅力值+520',
    price: 520,
    dailyLimit: 0,
    icon: '💍',
    category: 'gift',
    charmValue: 520
  },
  {
    key: 'gift_rocket',
    name: '火箭',
    description: '赠送后对方魅力值+1000',
    price: 999,
    dailyLimit: 0,
    icon: '🚀',
    category: 'gift',
    charmValue: 1000
  }
];

function getLocalDateStr(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

async function ensureUserItem(userId, itemKey) {
  const [rows] = await pool.execute(
    'SELECT id, quantity FROM user_items WHERE user_id = ? AND item_key = ?',
    [userId, itemKey]
  );
  if (rows.length === 0) {
    const id = generateUUID();
    await pool.execute(
      'INSERT INTO user_items (id, user_id, item_key, quantity) VALUES (?, ?, ?, 0)',
      [id, userId, itemKey]
    );
    return { id, quantity: 0 };
  }
  return rows[0];
}

router.get('/products', async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = getLocalDateStr();

    const [purchases] = await pool.execute(
      'SELECT item_key, COUNT(*) as count FROM shop_purchases WHERE user_id = ? AND DATE(created_at) = ? GROUP BY item_key',
      [userId, today]
    );

    const purchaseMap = {};
    purchases.forEach(p => {
      purchaseMap[p.item_key] = p.count;
    });

    const products = PRODUCTS.map(p => ({
      ...p,
      todayPurchased: purchaseMap[p.item_key] || 0,
      canBuy: p.dailyLimit === 0 || (purchaseMap[p.item_key] || 0) < p.dailyLimit
    }));

    const categories = [
      { key: 'function', name: '功能道具', icon: '🎯' },
      { key: 'gift', name: '礼物', icon: '🎁' }
    ];

    res.json(generateResponse(true, { products, categories }, '获取成功'));
  } catch (error) {
    console.error('获取商品列表失败:', error);
    res.status(500).json(generateResponse(false, null, '获取商品列表失败'));
  }
});

router.post('/buy', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    const { itemKey } = req.body;

    const product = PRODUCTS.find(p => p.key === itemKey);
    if (!product) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '无效的商品'));
    }

    if (product.dailyLimit > 0) {
      const [purchases] = await connection.execute(
        'SELECT COUNT(*) as count FROM shop_purchases WHERE user_id = ? AND item_key = ? AND DATE(created_at) = CURDATE()',
        [userId, itemKey]
      );
      if (purchases[0].count >= product.dailyLimit) {
        await connection.rollback();
        return res.status(400).json(generateResponse(false, null, `今日购买次数已达上限`));
      }
    }

    const [users] = await connection.execute(
      'SELECT coins FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    if (users[0].coins < product.price) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '漂流币不足'));
    }

    await connection.execute(
      'UPDATE users SET coins = coins - ? WHERE id = ?',
      [product.price, userId]
    );

    const recordId = generateUUID();
    await connection.execute(
      'INSERT INTO coin_records (id, user_id, amount, type, source) VALUES (?, ?, ?, ?, ?)',
      [recordId, userId, -product.price, 'shop', `购买${product.name}`]
    );

    const [existingItems] = await connection.execute(
      'SELECT id, quantity FROM user_items WHERE user_id = ? AND item_key = ? FOR UPDATE',
      [userId, itemKey]
    );

    if (existingItems.length > 0) {
      await connection.execute(
        'UPDATE user_items SET quantity = quantity + 1 WHERE user_id = ? AND item_key = ?',
        [userId, itemKey]
      );
    } else {
      const itemId = generateUUID();
      await connection.execute(
        'INSERT INTO user_items (id, user_id, item_key, quantity) VALUES (?, ?, ?, 1)',
        [itemId, userId, itemKey]
      );
    }

    const purchaseId = generateUUID();
    await connection.execute(
      'INSERT INTO shop_purchases (id, user_id, item_key, price) VALUES (?, ?, ?, ?)',
      [purchaseId, userId, itemKey, product.price]
    );

    await connection.commit();

    const [updatedUser] = await pool.execute(
      'SELECT coins FROM users WHERE id = ?',
      [userId]
    );

    res.json(generateResponse(true, {
      itemKey: product.key,
      itemName: product.name,
      price: product.price,
      remainingCoins: updatedUser[0].coins
    }, `购买${product.name}成功`));
  } catch (error) {
    await connection.rollback();
    console.error('购买商品失败:', error);
    res.status(500).json(generateResponse(false, null, '购买商品失败'));
  } finally {
    connection.release();
  }
});

router.get('/items', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [items] = await pool.execute(
      'SELECT item_key, quantity FROM user_items WHERE user_id = ? AND quantity > 0',
      [userId]
    );

    const itemMap = {};
    items.forEach(item => {
      itemMap[item.item_key] = item.quantity;
    });

    const backpack = PRODUCTS.map(p => ({
      key: p.key,
      name: p.name,
      description: p.description,
      icon: p.icon,
      category: p.category,
      charmValue: p.charmValue || 0,
      quantity: itemMap[p.key] || 0
    })).filter(p => p.quantity > 0);

    res.json(generateResponse(true, backpack, '获取成功'));
  } catch (error) {
    console.error('获取背包失败:', error);
    res.status(500).json(generateResponse(false, null, '获取背包失败'));
  }
});

router.get('/gift-info', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [users] = await pool.execute(
      'SELECT charm FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    const [giftRows] = await pool.execute(`
      SELECT rg.*, u.nickname as sender_nickname, u.avatar as sender_avatar
      FROM received_gifts rg
      LEFT JOIN users u ON rg.sender_id = u.id
      WHERE rg.receiver_id = ?
      ORDER BY rg.created_at DESC
      LIMIT 100
    `, [userId]);

    const giftStats = {};
    giftRows.forEach(g => {
      if (!giftStats[g.gift_key]) {
        giftStats[g.gift_key] = {
          gift_key: g.gift_key,
          gift_name: g.gift_name,
          gift_icon: g.gift_icon,
          count: 0
        };
      }
      giftStats[g.gift_key].count++;
    });

    res.json(generateResponse(true, {
      charm: users[0].charm,
      receivedGifts: giftRows,
      giftStats: Object.values(giftStats)
    }, '获取成功'));
  } catch (error) {
    console.error('获取礼物信息失败:', error);
    res.status(500).json(generateResponse(false, null, '获取礼物信息失败'));
  }
});

router.post('/send-gift', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    const { receiverId, giftKey } = req.body;

    if (!receiverId || !giftKey) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    if (receiverId === userId) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '不能送给自己'));
    }

    const gift = PRODUCTS.find(p => p.key === giftKey && p.category === 'gift');
    if (!gift) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '无效的礼物'));
    }

    const [receivers] = await connection.execute(
      'SELECT id, nickname FROM users WHERE id = ?',
      [receiverId]
    );
    if (receivers.length === 0) {
      await connection.rollback();
      return res.status(404).json(generateResponse(false, null, '接收者不存在'));
    }

    const [itemRows] = await connection.execute(
      'SELECT id, quantity FROM user_items WHERE user_id = ? AND item_key = ? FOR UPDATE',
      [userId, giftKey]
    );
    if (itemRows.length === 0 || itemRows[0].quantity <= 0) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, `${gift.name}数量不足`));
    }

    await connection.execute(
      'UPDATE user_items SET quantity = quantity - 1 WHERE user_id = ? AND item_key = ?',
      [userId, giftKey]
    );

    await connection.execute(
      'UPDATE users SET charm = charm + ? WHERE id = ?',
      [gift.charmValue, receiverId]
    );

    const giftRecordId = generateUUID();
    await connection.execute(`
      INSERT INTO received_gifts (id, sender_id, receiver_id, gift_key, gift_name, gift_icon, charm_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [giftRecordId, userId, receiverId, gift.key, gift.name, gift.icon, gift.charmValue]);

    await connection.commit();

    res.json(generateResponse(true, {
      giftName: gift.name,
      receiverName: receivers[0].nickname,
      charmValue: gift.charmValue
    }, `成功赠送${gift.name}给${receivers[0].nickname}`));
  } catch (error) {
    await connection.rollback();
    console.error('赠送礼物失败:', error);
    res.status(500).json(generateResponse(false, null, '赠送礼物失败'));
  } finally {
    connection.release();
  }
});

router.get('/users/search', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { keyword } = req.query;

    if (!keyword || keyword.trim().length === 0) {
      return res.json(generateResponse(true, [], '请输入关键词'));
    }

    const [users] = await pool.execute(`
      SELECT id, nickname, avatar, gender, charm
      FROM users
      WHERE id != ? AND (nickname LIKE ? OR username LIKE ?)
      LIMIT 20
    `, [userId, `%${keyword}%`, `%${keyword}%`]);

    res.json(generateResponse(true, users, '获取成功'));
  } catch (error) {
    console.error('搜索用户失败:', error);
    res.status(500).json(generateResponse(false, null, '搜索用户失败'));
  }
});

router.post('/use-retro-card', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    const { date } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '日期格式不正确'));
    }

    const today = getLocalDateStr();
    if (date >= today) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '只能补签过去的日期'));
    }

    const [existing] = await connection.execute(
      'SELECT id FROM checkins WHERE user_id = ? AND checkin_date = ?',
      [userId, date]
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '该日期已签到，无需补签'));
    }

    const [itemRows] = await connection.execute(
      'SELECT id, quantity FROM user_items WHERE user_id = ? AND item_key = ? FOR UPDATE',
      [userId, 'retro_card']
    );
    if (itemRows.length === 0 || itemRows[0].quantity <= 0) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '补签卡数量不足'));
    }

    await connection.execute(
      'UPDATE user_items SET quantity = quantity - 1 WHERE user_id = ? AND item_key = ?',
      [userId, 'retro_card']
    );

    const checkinId = generateUUID();
    await connection.execute(
      'INSERT INTO checkins (id, user_id, checkin_date) VALUES (?, ?, ?)',
      [checkinId, userId, date]
    );

    await connection.commit();

    res.json(generateResponse(true, { date }, `补签成功，已补签${date}`));
  } catch (error) {
    await connection.rollback();
    console.error('使用补签卡失败:', error);
    res.status(500).json(generateResponse(false, null, '使用补签卡失败'));
  } finally {
    connection.release();
  }
});

router.post('/use-throw-card', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;

    const [itemRows] = await connection.execute(
      'SELECT id, quantity FROM user_items WHERE user_id = ? AND item_key = ? FOR UPDATE',
      [userId, 'throw_card']
    );
    if (itemRows.length === 0 || itemRows[0].quantity <= 0) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '扔瓶卡数量不足'));
    }

    await connection.execute(
      'UPDATE user_items SET quantity = quantity - 1 WHERE user_id = ? AND item_key = ?',
      [userId, 'throw_card']
    );

    const today = getLocalDateStr();
    const [dailyRows] = await connection.execute(
      'SELECT id FROM daily_stats WHERE user_id = ? AND stat_date = ?',
      [userId, today]
    );
    if (dailyRows.length === 0) {
      const statId = generateUUID();
      await connection.execute(
        'INSERT INTO daily_stats (id, user_id, stat_date, usage_seconds, throw_count, pick_count) VALUES (?, ?, ?, 0, 1, 0)',
        [statId, userId, today]
      );
    } else {
      await connection.execute(
        'UPDATE daily_stats SET throw_count = throw_count + 1 WHERE user_id = ? AND stat_date = ?',
        [userId, today]
      );
    }

    await connection.commit();

    res.json(generateResponse(true, null, '使用扔瓶卡成功，扔瓶子次数+1'));
  } catch (error) {
    await connection.rollback();
    console.error('使用扔瓶卡失败:', error);
    res.status(500).json(generateResponse(false, null, '使用扔瓶卡失败'));
  } finally {
    connection.release();
  }
});

router.post('/use-pick-card', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;

    const [itemRows] = await connection.execute(
      'SELECT id, quantity FROM user_items WHERE user_id = ? AND item_key = ? FOR UPDATE',
      [userId, 'pick_card']
    );
    if (itemRows.length === 0 || itemRows[0].quantity <= 0) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '捞瓶卡数量不足'));
    }

    await connection.execute(
      'UPDATE user_items SET quantity = quantity - 1 WHERE user_id = ? AND item_key = ?',
      [userId, 'pick_card']
    );

    const today = getLocalDateStr();
    const [dailyRows] = await connection.execute(
      'SELECT id FROM daily_stats WHERE user_id = ? AND stat_date = ?',
      [userId, today]
    );
    if (dailyRows.length === 0) {
      const statId = generateUUID();
      await connection.execute(
        'INSERT INTO daily_stats (id, user_id, stat_date, usage_seconds, throw_count, pick_count) VALUES (?, ?, ?, 0, 0, 1)',
        [statId, userId, today]
      );
    } else {
      await connection.execute(
        'UPDATE daily_stats SET pick_count = pick_count + 1 WHERE user_id = ? AND stat_date = ?',
        [userId, today]
      );
    }

    await connection.commit();

    res.json(generateResponse(true, null, '使用捞瓶卡成功，捞瓶子次数+1'));
  } catch (error) {
    await connection.rollback();
    console.error('使用捞瓶卡失败:', error);
    res.status(500).json(generateResponse(false, null, '使用捞瓶卡失败'));
  } finally {
    connection.release();
  }
});

router.post('/send-chat-gift', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    const { bottleId, receiverId, giftKey } = req.body;

    if (!bottleId || !receiverId || !giftKey) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    if (receiverId === userId) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '不能送给自己'));
    }

    const iBlocked = await hasBlocked(userId, receiverId);
    const blockedByReceiver = await isBlockedBy(userId, receiverId);

    if (iBlocked) {
      await connection.rollback();
      return res.status(403).json(generateResponse(false, null, '您已拉黑对方，无法赠送礼物'));
    }

    const gift = PRODUCTS.find(p => p.key === giftKey && p.category === 'gift');
    if (!gift) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '无效的礼物'));
    }

    const [receivers] = await connection.execute(
      'SELECT id, nickname FROM users WHERE id = ?',
      [receiverId]
    );
    if (receivers.length === 0) {
      await connection.rollback();
      return res.status(404).json(generateResponse(false, null, '接收者不存在'));
    }

    const [itemRows] = await connection.execute(
      'SELECT id, quantity FROM user_items WHERE user_id = ? AND item_key = ? FOR UPDATE',
      [userId, giftKey]
    );
    if (itemRows.length === 0 || itemRows[0].quantity <= 0) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, `${gift.name}数量不足`));
    }

    await connection.execute(
      'UPDATE user_items SET quantity = quantity - 1 WHERE user_id = ? AND item_key = ?',
      [userId, giftKey]
    );

    if (!blockedByReceiver) {
      await connection.execute(
        'UPDATE users SET charm = charm + ? WHERE id = ?',
        [gift.charmValue, receiverId]
      );

      const giftRecordId = generateUUID();
      await connection.execute(`
        INSERT INTO received_gifts (id, sender_id, receiver_id, gift_key, gift_name, gift_icon, charm_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [giftRecordId, userId, receiverId, gift.key, gift.name, gift.icon, gift.charmValue]);
    }

    const messageId = generateUUID();
    const messageContent = JSON.stringify({
      type: 'gift',
      giftKey: gift.key,
      giftName: gift.name,
      giftIcon: gift.icon,
      charmValue: gift.charmValue
    });

    const typeCol = await checkMsgTypeColumn();
    const isBlockedCol = await checkIsBlockedColumn();
    const isBlocked = blockedByReceiver ? 1 : 0;

    if (typeCol && isBlockedCol) {
      await connection.execute(
        'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content, type, is_blocked) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [messageId, bottleId, userId, receiverId, messageContent, 'gift', isBlocked]
      );
    } else if (typeCol) {
      await connection.execute(
        'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content, type) VALUES (?, ?, ?, ?, ?, ?)',
        [messageId, bottleId, userId, receiverId, messageContent, 'gift']
      );
    } else if (isBlockedCol) {
      await connection.execute(
        'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content, is_blocked) VALUES (?, ?, ?, ?, ?, ?)',
        [messageId, bottleId, userId, receiverId, messageContent, isBlocked]
      );
    } else {
      await connection.execute(
        'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?, ?)',
        [messageId, bottleId, userId, receiverId, messageContent]
      );
    }

    const selectType = typeCol ? ', m.type' : '';
    const selectIsBlocked = isBlockedCol ? ', m.is_blocked' : '';
    const [message] = await connection.execute(
      'SELECT m.id, m.bottle_id, m.sender_id, m.receiver_id, m.content' + selectType + selectIsBlocked + ', m.is_read, m.created_at, ' +
      'u.nickname as sender_nickname, u.avatar as sender_avatar ' +
      'FROM messages m ' +
      'LEFT JOIN users u ON m.sender_id = u.id ' +
      'WHERE m.id = ?',
      [messageId]
    );

    await connection.commit();

    if (!blockedByReceiver) {
      await addIntimacy(bottleId, gift.charmValue * 2);
    }

    res.json(generateResponse(true, {
      message: message[0],
      giftName: gift.name,
      receiverName: receivers[0].nickname,
      charmValue: blockedByReceiver ? 0 : gift.charmValue
    }, blockedByReceiver ? '对方已拒收您的礼物' : `成功赠送${gift.name}给${receivers[0].nickname}`));
  } catch (error) {
    await connection.rollback();
    console.error('聊天赠送礼物失败:', error);
    res.status(500).json(generateResponse(false, null, '赠送礼物失败'));
  } finally {
    connection.release();
  }
});

router.get('/skins', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [skins] = await pool.execute(`
      SELECT * FROM bottle_skins WHERE is_active = 1 ORDER BY 
        CASE rarity 
          WHEN 'legendary' THEN 1 
          WHEN 'rare' THEN 2 
          ELSE 3 
        END, created_at DESC
    `);

    const durationOptions = [
      { key: '1h', label: '1小时', price: SKIN_PRICES['1h'] },
      { key: '1d', label: '1天', price: SKIN_PRICES['1d'] },
      { key: '7d', label: '7天', price: SKIN_PRICES['7d'] }
    ];

    const [userActiveSkins] = await pool.execute(`
      SELECT us.skin_id, us.expire_at, us.is_active
      FROM user_skins us
      WHERE us.user_id = ? AND us.expire_at > NOW()
      ORDER BY us.expire_at DESC
    `, [userId]);

    const userSkinMap = {};
    userActiveSkins.forEach(us => {
      if (!userSkinMap[us.skin_id]) {
        userSkinMap[us.skin_id] = {
          owned: true,
          expireAt: us.expire_at,
          isActive: us.is_active === 1
        };
      }
    });

    const skinsWithStatus = skins.map(skin => ({
      ...skin,
      prices: durationOptions,
      owned: !!userSkinMap[skin.id],
      expireAt: userSkinMap[skin.id]?.expireAt || null,
      isActive: userSkinMap[skin.id]?.isActive || false
    }));

    res.json(generateResponse(true, {
      skins: skinsWithStatus,
      durationOptions
    }, '获取皮肤列表成功'));
  } catch (error) {
    console.error('获取皮肤列表失败:', error);
    res.status(500).json(generateResponse(false, null, '获取皮肤列表失败'));
  }
});

router.post('/skins/buy', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    const { skinId, duration } = req.body;

    if (!skinId || !duration) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    if (!SKIN_PRICES[duration]) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '无效的时长'));
    }

    const [skins] = await connection.execute(
      'SELECT * FROM bottle_skins WHERE id = ? AND is_active = 1',
      [skinId]
    );
    if (skins.length === 0) {
      await connection.rollback();
      return res.status(404).json(generateResponse(false, null, '皮肤不存在或已下架'));
    }
    const skin = skins[0];

    const price = SKIN_PRICES[duration];
    const hours = DURATION_HOURS[duration];

    const [users] = await connection.execute(
      'SELECT coins FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    if (users[0].coins < price) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '漂流币不足'));
    }

    await connection.execute(
      'UPDATE users SET coins = coins - ? WHERE id = ?',
      [price, userId]
    );

    const coinRecordId = generateUUID();
    await connection.execute(
      'INSERT INTO coin_records (id, user_id, amount, type, source) VALUES (?, ?, ?, ?, ?)',
      [coinRecordId, userId, -price, 'shop', `购买${skin.name}皮肤(${duration})`]
    );

    const [existingActive] = await connection.execute(
      'SELECT id, expire_at FROM user_skins WHERE user_id = ? AND skin_id = ? AND is_active = 1 AND expire_at > NOW() FOR UPDATE',
      [userId, skinId]
    );

    let newExpireAt;
    if (existingActive.length > 0) {
      newExpireAt = new Date(Math.max(
        new Date(existingActive[0].expire_at).getTime(),
        Date.now()
      ) + hours * 60 * 60 * 1000);
      await connection.execute(
        'UPDATE user_skins SET expire_at = ? WHERE id = ?',
        [newExpireAt, existingActive[0].id]
      );
    } else {
      await connection.execute(
        'UPDATE user_skins SET is_active = 0 WHERE user_id = ? AND is_active = 1',
        [userId]
      );

      newExpireAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      const userSkinId = generateUUID();
      await connection.execute(`
        INSERT INTO user_skins (id, user_id, skin_id, duration, price, expire_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `, [userSkinId, userId, skinId, duration, price, newExpireAt]);
    }

    const purchaseId = generateUUID();
    await connection.execute(
      'INSERT INTO shop_purchases (id, user_id, item_key, price) VALUES (?, ?, ?, ?)',
      [purchaseId, userId, `skin_${skinId}_${duration}`, price]
    );

    await connection.commit();

    const [updatedUser] = await pool.execute(
      'SELECT coins FROM users WHERE id = ?',
      [userId]
    );

    res.json(generateResponse(true, {
      skinId: skin.id,
      skinName: skin.name,
      duration,
      price,
      expireAt: newExpireAt,
      remainingCoins: updatedUser[0].coins
    }, `成功购买${skin.name}皮肤`));
  } catch (error) {
    await connection.rollback();
    console.error('购买皮肤失败:', error);
    res.status(500).json(generateResponse(false, null, '购买皮肤失败'));
  } finally {
    connection.release();
  }
});

router.get('/skins/mine', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [userSkins] = await pool.execute(`
      SELECT us.id, us.skin_id, us.duration, us.price, us.expire_at, us.is_active, us.created_at,
             bs.name, bs.description, bs.emoji, bs.gradient_from, bs.gradient_to, bs.border_color, bs.theme, bs.rarity
      FROM user_skins us
      LEFT JOIN bottle_skins bs ON us.skin_id = bs.id
      WHERE us.user_id = ? AND us.expire_at > NOW()
      ORDER BY us.is_active DESC, us.expire_at DESC
    `, [userId]);

    const activeSkin = userSkins.find(s => s.is_active === 1) || null;

    res.json(generateResponse(true, {
      skins: userSkins,
      activeSkin: activeSkin ? {
        id: activeSkin.skin_id,
        name: activeSkin.name,
        emoji: activeSkin.emoji,
        gradient_from: activeSkin.gradient_from,
        gradient_to: activeSkin.gradient_to,
        border_color: activeSkin.border_color,
        theme: activeSkin.theme,
        rarity: activeSkin.rarity,
        expireAt: activeSkin.expire_at
      } : null
    }, '获取我的皮肤成功'));
  } catch (error) {
    console.error('获取我的皮肤失败:', error);
    res.status(500).json(generateResponse(false, null, '获取我的皮肤失败'));
  }
});

router.post('/skins/use', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    const { skinId } = req.body;

    if (!skinId) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [userSkin] = await connection.execute(
      'SELECT id FROM user_skins WHERE user_id = ? AND skin_id = ? AND expire_at > NOW() FOR UPDATE',
      [userId, skinId]
    );
    if (userSkin.length === 0) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '皮肤不存在或已过期'));
    }

    await connection.execute(
      'UPDATE user_skins SET is_active = 0 WHERE user_id = ? AND is_active = 1',
      [userId]
    );

    await connection.execute(
      'UPDATE user_skins SET is_active = 1 WHERE user_id = ? AND skin_id = ? AND expire_at > NOW()',
      [userId, skinId]
    );

    await connection.commit();

    const [skinInfo] = await pool.execute(
      'SELECT id, name, emoji, gradient_from, gradient_to, border_color, theme, rarity FROM bottle_skins WHERE id = ?',
      [skinId]
    );

    res.json(generateResponse(true, {
      activeSkin: skinInfo[0] || null
    }, '切换皮肤成功'));
  } catch (error) {
    await connection.rollback();
    console.error('切换皮肤失败:', error);
    res.status(500).json(generateResponse(false, null, '切换皮肤失败'));
  } finally {
    connection.release();
  }
});

async function getUserActiveSkin(userId, conn) {
  const db = conn || pool;
  try {
    const [rows] = await db.execute(`
      SELECT bs.id, bs.name, bs.emoji, bs.gradient_from, bs.gradient_to, bs.border_color, bs.theme, bs.rarity
      FROM user_skins us
      LEFT JOIN bottle_skins bs ON us.skin_id = bs.id
      WHERE us.user_id = ? AND us.is_active = 1 AND us.expire_at > NOW()
      LIMIT 1
    `, [userId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('获取用户当前皮肤失败:', error);
    return null;
  }
}

async function getSkinById(skinId, conn) {
  if (!skinId) return null;
  const db = conn || pool;
  try {
    const [rows] = await db.execute(
      'SELECT id, name, emoji, gradient_from, gradient_to, border_color, theme, rarity FROM bottle_skins WHERE id = ?',
      [skinId]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('获取皮肤信息失败:', error);
    return null;
  }
}

router.get('/avatar-frames', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [frames] = await pool.execute(`
      SELECT * FROM avatar_frames WHERE is_active = 1 ORDER BY 
        CASE rarity 
          WHEN 'legendary' THEN 1 
          WHEN 'rare' THEN 2 
          ELSE 3 
        END, created_at DESC
    `);

    const [userFrames] = await pool.execute(`
      SELECT frame_id, is_active
      FROM user_avatar_frames
      WHERE user_id = ?
    `, [userId]);

    const userFrameMap = {};
    userFrames.forEach(uf => {
      userFrameMap[uf.frame_id] = {
        owned: true,
        isActive: uf.is_active === 1
      };
    });

    const framesWithStatus = frames.map(frame => ({
      ...frame,
      price: AVATAR_FRAME_PRICE,
      owned: !!userFrameMap[frame.id],
      isActive: userFrameMap[frame.id]?.isActive || false
    }));

    res.json(generateResponse(true, {
      frames: framesWithStatus,
      price: AVATAR_FRAME_PRICE
    }, '获取头像框列表成功'));
  } catch (error) {
    console.error('获取头像框列表失败:', error);
    res.status(500).json(generateResponse(false, null, '获取头像框列表失败'));
  }
});

router.post('/avatar-frames/buy', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    const { frameId } = req.body;

    if (!frameId) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [frames] = await connection.execute(
      'SELECT * FROM avatar_frames WHERE id = ? AND is_active = 1',
      [frameId]
    );
    if (frames.length === 0) {
      await connection.rollback();
      return res.status(404).json(generateResponse(false, null, '头像框不存在或已下架'));
    }
    const frame = frames[0];

    const [existingUserFrame] = await connection.execute(
      'SELECT id FROM user_avatar_frames WHERE user_id = ? AND frame_id = ?',
      [userId, frameId]
    );
    if (existingUserFrame.length > 0) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '您已拥有该头像框'));
    }

    const [users] = await connection.execute(
      'SELECT coins FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    if (users[0].coins < AVATAR_FRAME_PRICE) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '漂流币不足'));
    }

    await connection.execute(
      'UPDATE users SET coins = coins - ? WHERE id = ?',
      [AVATAR_FRAME_PRICE, userId]
    );

    const coinRecordId = generateUUID();
    await connection.execute(
      'INSERT INTO coin_records (id, user_id, amount, type, source) VALUES (?, ?, ?, ?, ?)',
      [coinRecordId, userId, -AVATAR_FRAME_PRICE, 'shop', `购买${frame.name}头像框`]
    );

    const userFrameId = generateUUID();
    await connection.execute(`
      INSERT INTO user_avatar_frames (id, user_id, frame_id, price, is_active)
      VALUES (?, ?, ?, ?, 0)
    `, [userFrameId, userId, frameId, AVATAR_FRAME_PRICE]);

    const purchaseId = generateUUID();
    await connection.execute(
      'INSERT INTO shop_purchases (id, user_id, item_key, price) VALUES (?, ?, ?, ?)',
      [purchaseId, userId, `avatar_frame_${frameId}`, AVATAR_FRAME_PRICE]
    );

    await connection.commit();

    const [updatedUser] = await pool.execute(
      'SELECT coins FROM users WHERE id = ?',
      [userId]
    );

    res.json(generateResponse(true, {
      frameId: frame.id,
      frameName: frame.name,
      price: AVATAR_FRAME_PRICE,
      remainingCoins: updatedUser[0].coins
    }, `成功购买${frame.name}头像框`));
  } catch (error) {
    await connection.rollback();
    console.error('购买头像框失败:', error);
    res.status(500).json(generateResponse(false, null, '购买头像框失败'));
  } finally {
    connection.release();
  }
});

router.post('/avatar-frames/use', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    let { frameId } = req.body;

    if (frameId === undefined || frameId === null) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    frameId = frameId || '';

    if (frameId) {
      const [userFrame] = await connection.execute(
        'SELECT id FROM user_avatar_frames WHERE user_id = ? AND frame_id = ? FOR UPDATE',
        [userId, frameId]
      );
      if (userFrame.length === 0) {
        await connection.rollback();
        return res.status(400).json(generateResponse(false, null, '您还未拥有该头像框'));
      }
    }

    await connection.execute(
      'UPDATE user_avatar_frames SET is_active = 0 WHERE user_id = ?',
      [userId]
    );

    if (frameId) {
      await connection.execute(
        'UPDATE user_avatar_frames SET is_active = 1 WHERE user_id = ? AND frame_id = ?',
        [userId, frameId]
      );
    }

    await connection.execute(
      'UPDATE users SET avatar_frame = ? WHERE id = ?',
      [frameId || null, userId]
    );

    await connection.commit();

    let activeFrame = null;
    if (frameId) {
      const [frameInfo] = await pool.execute(
        'SELECT id, name, border_color, gradient_from, gradient_to, shadow_color, rarity, icon FROM avatar_frames WHERE id = ?',
        [frameId]
      );
      activeFrame = frameInfo[0] || null;
    }

    res.json(generateResponse(true, {
      activeFrame
    }, '切换头像框成功'));
  } catch (error) {
    await connection.rollback();
    console.error('切换头像框失败:', error);
    res.status(500).json(generateResponse(false, null, '切换头像框失败'));
  } finally {
    connection.release();
  }
});

router.get('/avatar-frames/mine', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [userFrames] = await pool.execute(`
      SELECT uf.id, uf.frame_id, uf.price, uf.is_active, uf.created_at,
             af.name, af.description, af.border_color, af.gradient_from, 
             af.gradient_to, af.shadow_color, af.rarity, af.icon
      FROM user_avatar_frames uf
      LEFT JOIN avatar_frames af ON uf.frame_id = af.id
      WHERE uf.user_id = ?
      ORDER BY uf.is_active DESC, uf.created_at DESC
    `, [userId]);

    const activeFrame = userFrames.find(f => f.is_active === 1) || null;

    res.json(generateResponse(true, {
      frames: userFrames,
      activeFrame: activeFrame ? {
        id: activeFrame.frame_id,
        name: activeFrame.name,
        border_color: activeFrame.border_color,
        gradient_from: activeFrame.gradient_from,
        gradient_to: activeFrame.gradient_to,
        shadow_color: activeFrame.shadow_color,
        rarity: activeFrame.rarity,
        icon: activeFrame.icon
      } : null
    }, '获取我的头像框成功'));
  } catch (error) {
    console.error('获取我的头像框失败:', error);
    res.status(500).json(generateResponse(false, null, '获取我的头像框失败'));
  }
});

router.get('/chat-skins', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [skins] = await pool.execute(`
      SELECT * FROM chat_skins WHERE is_active = 1 ORDER BY 
        CASE rarity 
          WHEN 'legendary' THEN 1 
          WHEN 'rare' THEN 2 
          ELSE 3 
        END, created_at DESC
    `);

    const [userSkins] = await pool.execute(`
      SELECT skin_id, is_active
      FROM user_chat_skins
      WHERE user_id = ?
    `, [userId]);

    const userSkinMap = {};
    userSkins.forEach(us => {
      userSkinMap[us.skin_id] = {
        owned: true,
        isActive: us.is_active === 1
      };
    });

    const skinsWithStatus = skins.map(skin => ({
      ...skin,
      price: AVATAR_FRAME_PRICE,
      owned: !!userSkinMap[skin.id],
      isActive: userSkinMap[skin.id]?.isActive || false
    }));

    res.json(generateResponse(true, {
      skins: skinsWithStatus,
      price: AVATAR_FRAME_PRICE
    }, '获取聊天皮肤列表成功'));
  } catch (error) {
    console.error('获取聊天皮肤列表失败:', error);
    res.status(500).json(generateResponse(false, null, '获取聊天皮肤列表失败'));
  }
});

router.post('/chat-skins/buy', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    const { skinId } = req.body;

    if (!skinId) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    const [skins] = await connection.execute(
      'SELECT * FROM chat_skins WHERE id = ? AND is_active = 1',
      [skinId]
    );
    if (skins.length === 0) {
      await connection.rollback();
      return res.status(404).json(generateResponse(false, null, '聊天皮肤不存在或已下架'));
    }
    const skin = skins[0];

    const [existingUserSkin] = await connection.execute(
      'SELECT id FROM user_chat_skins WHERE user_id = ? AND skin_id = ?',
      [userId, skinId]
    );
    if (existingUserSkin.length > 0) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '您已拥有该聊天皮肤'));
    }

    const [users] = await connection.execute(
      'SELECT coins FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    if (users[0].coins < AVATAR_FRAME_PRICE) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '漂流币不足'));
    }

    await connection.execute(
      'UPDATE users SET coins = coins - ? WHERE id = ?',
      [AVATAR_FRAME_PRICE, userId]
    );

    const coinRecordId = generateUUID();
    await connection.execute(
      'INSERT INTO coin_records (id, user_id, amount, type, source) VALUES (?, ?, ?, ?, ?)',
      [coinRecordId, userId, -AVATAR_FRAME_PRICE, 'shop', `购买${skin.name}聊天皮肤`]
    );

    const userSkinId = generateUUID();
    await connection.execute(`
      INSERT INTO user_chat_skins (id, user_id, skin_id, price, is_active)
      VALUES (?, ?, ?, ?, 0)
    `, [userSkinId, userId, skinId, AVATAR_FRAME_PRICE]);

    const purchaseId = generateUUID();
    await connection.execute(
      'INSERT INTO shop_purchases (id, user_id, item_key, price) VALUES (?, ?, ?, ?)',
      [purchaseId, userId, `chat_skin_${skinId}`, AVATAR_FRAME_PRICE]
    );

    await connection.commit();

    const [updatedUser] = await pool.execute(
      'SELECT coins FROM users WHERE id = ?',
      [userId]
    );

    res.json(generateResponse(true, {
      skinId: skin.id,
      skinName: skin.name,
      price: AVATAR_FRAME_PRICE,
      remainingCoins: updatedUser[0].coins
    }, `成功购买${skin.name}聊天皮肤`));
  } catch (error) {
    await connection.rollback();
    console.error('购买聊天皮肤失败:', error);
    res.status(500).json(generateResponse(false, null, '购买聊天皮肤失败'));
  } finally {
    connection.release();
  }
});

router.post('/chat-skins/use', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = req.user.userId;
    let { skinId } = req.body;

    if (skinId === undefined || skinId === null) {
      await connection.rollback();
      return res.status(400).json(generateResponse(false, null, '参数不完整'));
    }

    skinId = skinId || '';

    if (skinId) {
      const [userSkin] = await connection.execute(
        'SELECT id FROM user_chat_skins WHERE user_id = ? AND skin_id = ? FOR UPDATE',
        [userId, skinId]
      );
      if (userSkin.length === 0) {
        await connection.rollback();
        return res.status(400).json(generateResponse(false, null, '您还未拥有该聊天皮肤'));
      }
    }

    await connection.execute(
      'UPDATE user_chat_skins SET is_active = 0 WHERE user_id = ?',
      [userId]
    );

    if (skinId) {
      await connection.execute(
        'UPDATE user_chat_skins SET is_active = 1 WHERE user_id = ? AND skin_id = ?',
        [userId, skinId]
      );
    }

    await connection.execute(
      'UPDATE users SET chat_skin = ? WHERE id = ?',
      [skinId || null, userId]
    );

    await connection.commit();

    let activeSkin = null;
    if (skinId) {
      const [skinInfo] = await pool.execute(
        'SELECT id, name, bg_color, bubble_bg_other, bubble_bg_mine, text_color_mine, text_color_other, border_color, rarity, icon FROM chat_skins WHERE id = ?',
        [skinId]
      );
      activeSkin = skinInfo[0] || null;
    }

    res.json(generateResponse(true, {
      activeSkin
    }, '切换聊天皮肤成功'));
  } catch (error) {
    await connection.rollback();
    console.error('切换聊天皮肤失败:', error);
    res.status(500).json(generateResponse(false, null, '切换聊天皮肤失败'));
  } finally {
    connection.release();
  }
});

router.get('/chat-skins/mine', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [userSkins] = await pool.execute(`
      SELECT us.id, us.skin_id, us.price, us.is_active, us.created_at,
             cs.name, cs.description, cs.bg_color, cs.bubble_bg_other, 
             cs.bubble_bg_mine, cs.text_color_mine, cs.text_color_other, 
             cs.border_color, cs.rarity, cs.icon
      FROM user_chat_skins us
      LEFT JOIN chat_skins cs ON us.skin_id = cs.id
      WHERE us.user_id = ?
      ORDER BY us.is_active DESC, us.created_at DESC
    `, [userId]);

    const activeSkin = userSkins.find(s => s.is_active === 1) || null;

    res.json(generateResponse(true, {
      skins: userSkins,
      activeSkin: activeSkin ? {
        id: activeSkin.skin_id,
        name: activeSkin.name,
        bg_color: activeSkin.bg_color,
        bubble_bg_other: activeSkin.bubble_bg_other,
        bubble_bg_mine: activeSkin.bubble_bg_mine,
        text_color_mine: activeSkin.text_color_mine,
        text_color_other: activeSkin.text_color_other,
        border_color: activeSkin.border_color,
        rarity: activeSkin.rarity,
        icon: activeSkin.icon
      } : null
    }, '获取我的聊天皮肤成功'));
  } catch (error) {
    console.error('获取我的聊天皮肤失败:', error);
    res.status(500).json(generateResponse(false, null, '获取我的聊天皮肤失败'));
  }
});

async function getUserActiveAvatarFrame(userId, conn) {
  const db = conn || pool;
  try {
    const [rows] = await db.execute(`
      SELECT af.id, af.name, af.border_color, af.gradient_from, af.gradient_to, af.shadow_color, af.rarity, af.icon
      FROM user_avatar_frames uf
      LEFT JOIN avatar_frames af ON uf.frame_id = af.id
      WHERE uf.user_id = ? AND uf.is_active = 1
      LIMIT 1
    `, [userId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('获取用户当前头像框失败:', error);
    return null;
  }
}

async function getUserActiveChatSkin(userId, conn) {
  const db = conn || pool;
  try {
    const [rows] = await db.execute(`
      SELECT cs.id, cs.name, cs.bg_color, cs.bubble_bg_other, cs.bubble_bg_mine, 
             cs.text_color_mine, cs.text_color_other, cs.border_color, cs.rarity, cs.icon
      FROM user_chat_skins us
      LEFT JOIN chat_skins cs ON us.skin_id = cs.id
      WHERE us.user_id = ? AND us.is_active = 1
      LIMIT 1
    `, [userId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('获取用户当前聊天皮肤失败:', error);
    return null;
  }
}

module.exports = router;
module.exports.getUserActiveSkin = getUserActiveSkin;
module.exports.getSkinById = getSkinById;
module.exports.getUserActiveAvatarFrame = getUserActiveAvatarFrame;
module.exports.getUserActiveChatSkin = getUserActiveChatSkin;
