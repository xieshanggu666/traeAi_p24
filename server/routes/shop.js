const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('../utils/helper');

let hasMsgTypeColumn = null;
let hasIntimacyTable = null;

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

async function checkIntimacyTable() {
  if (hasIntimacyTable !== null) return hasIntimacyTable;
  try {
    await pool.execute('SELECT 1 FROM bottle_intimacy LIMIT 0');
    hasIntimacyTable = true;
  } catch {
    hasIntimacyTable = false;
  }
  return hasIntimacyTable;
}

async function ensureIntimacy(bottleId) {
  const [rows] = await pool.execute(
    'SELECT id FROM bottle_intimacy WHERE bottle_id = ?',
    [bottleId]
  );
  if (rows.length === 0) {
    const id = generateUUID();
    await pool.execute(
      'INSERT INTO bottle_intimacy (id, bottle_id, intimacy_value) VALUES (?, ?, 0)',
      [id, bottleId]
    );
  }
}

async function addIntimacy(bottleId, amount) {
  const tableExists = await checkIntimacyTable();
  if (!tableExists) return;
  await ensureIntimacy(bottleId);
  await pool.execute(
    'UPDATE bottle_intimacy SET intimacy_value = intimacy_value + ? WHERE bottle_id = ?',
    [amount, bottleId]
  );
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

    const messageId = generateUUID();
    const messageContent = JSON.stringify({
      type: 'gift',
      giftKey: gift.key,
      giftName: gift.name,
      giftIcon: gift.icon,
      charmValue: gift.charmValue
    });

    const typeCol = await checkMsgTypeColumn();

    if (typeCol) {
      await connection.execute(
        'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content, type) VALUES (?, ?, ?, ?, ?, ?)',
        [messageId, bottleId, userId, receiverId, messageContent, 'gift']
      );
    } else {
      await connection.execute(
        'INSERT INTO messages (id, bottle_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?, ?)',
        [messageId, bottleId, userId, receiverId, messageContent]
      );
    }

    const selectType = typeCol ? ', m.type' : '';
    const [message] = await connection.execute(
      'SELECT m.id, m.bottle_id, m.sender_id, m.receiver_id, m.content' + selectType + ', m.is_read, m.created_at, ' +
      'u.nickname as sender_nickname, u.avatar as sender_avatar ' +
      'FROM messages m ' +
      'LEFT JOIN users u ON m.sender_id = u.id ' +
      'WHERE m.id = ?',
      [messageId]
    );

    await connection.commit();

    await addIntimacy(bottleId, gift.charmValue * 2);

    res.json(generateResponse(true, {
      message: message[0],
      giftName: gift.name,
      receiverName: receivers[0].nickname,
      charmValue: gift.charmValue
    }, `成功赠送${gift.name}给${receivers[0].nickname}`));
  } catch (error) {
    await connection.rollback();
    console.error('聊天赠送礼物失败:', error);
    res.status(500).json(generateResponse(false, null, '赠送礼物失败'));
  } finally {
    connection.release();
  }
});

module.exports = router;
