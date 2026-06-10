const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { generateUUID, generateResponse } = require('../utils/helper');

const PRODUCTS = [
  {
    key: 'retro_card',
    name: '补签卡',
    description: '可在日历上点击未签到的日期使用，成功补签对应日期',
    price: 10,
    dailyLimit: 1,
    icon: '📅'
  },
  {
    key: 'throw_card',
    name: '扔瓶卡',
    description: '使用后增加扔瓶子的次数+1',
    price: 5,
    dailyLimit: 0,
    icon: '📤'
  },
  {
    key: 'pick_card',
    name: '捞瓶卡',
    description: '使用后增加捞瓶子的次数+1',
    price: 5,
    dailyLimit: 0,
    icon: '📥'
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

    res.json(generateResponse(true, products, '获取成功'));
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
      quantity: itemMap[p.key] || 0
    }));

    res.json(generateResponse(true, backpack, '获取成功'));
  } catch (error) {
    console.error('获取背包失败:', error);
    res.status(500).json(generateResponse(false, null, '获取背包失败'));
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

module.exports = router;
