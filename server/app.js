const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { router: userRoutes, authenticateToken } = require('./routes/user');
const bottleRoutes = require('./routes/bottle');
const messageRoutes = require('./routes/message');
const welfareRoutes = require('./routes/welfare');
const shopRoutes = require('./routes/shop');
const { startScheduledTasks } = require('./utils/bottleScheduler');
const pool = require('./config/db');
const { generateUUID } = require('./utils/helper');

async function ensureUserIntimacyTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_intimacy (
        id VARCHAR(36) PRIMARY KEY COMMENT '亲密度记录ID',
        user_id1 VARCHAR(36) NOT NULL COMMENT '用户1ID',
        user_id2 VARCHAR(36) NOT NULL COMMENT '用户2ID',
        intimacy_value INT DEFAULT 0 COMMENT '亲密度值',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        UNIQUE KEY uk_user_pair (user_id1, user_id2),
        INDEX idx_user_id1 (user_id1),
        INDEX idx_user_id2 (user_id2)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ 用户亲密度表已就绪');
  } catch (error) {
    console.error('创建用户亲密度表失败:', error.message);
  }
}

function normalizeUserPair(userIdA, userIdB) {
  if (userIdA < userIdB) {
    return { user_id1: userIdA, user_id2: userIdB };
  }
  return { user_id1: userIdB, user_id2: userIdA };
}

async function migrateBottleIntimacyToUser() {
  try {
    const [tables] = await pool.execute("SHOW TABLES LIKE 'bottle_intimacy'");
    if (tables.length === 0) {
      return;
    }

    const [countResult] = await pool.execute('SELECT COUNT(*) as cnt FROM user_intimacy');
    if (countResult[0].cnt > 0) {
      return;
    }

    console.log('🔄 正在迁移 bottle_intimacy 数据到 user_intimacy...');
    
    const [rows] = await pool.execute(`
      SELECT bi.bottle_id, bi.intimacy_value, b.sender_id, b.picker_id
      FROM bottle_intimacy bi
      LEFT JOIN bottles b ON bi.bottle_id = b.id
      WHERE b.sender_id IS NOT NULL AND b.picker_id IS NOT NULL
    `);

    let migrated = 0;
    for (const row of rows) {
      const { user_id1, user_id2 } = normalizeUserPair(row.sender_id, row.picker_id);
      const value = row.intimacy_value || 0;
      
      const [existing] = await pool.execute(
        'SELECT id, intimacy_value FROM user_intimacy WHERE user_id1 = ? AND user_id2 = ?',
        [user_id1, user_id2]
      );

      if (existing.length > 0) {
        await pool.execute(
          'UPDATE user_intimacy SET intimacy_value = intimacy_value + ? WHERE id = ?',
          [value, existing[0].id]
        );
      } else {
        const id = generateUUID();
        await pool.execute(
          'INSERT INTO user_intimacy (id, user_id1, user_id2, intimacy_value) VALUES (?, ?, ?, ?)',
          [id, user_id1, user_id2, value]
        );
      }
      migrated++;
    }

    if (migrated > 0) {
      console.log(`✅ 已迁移 ${migrated} 条亲密度数据`);
    }
  } catch (error) {
    console.error('迁移亲密度数据失败:', error.message);
  }
}

const app = express();
const PORT = process.env.PORT || 4022;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/user', userRoutes);
app.use('/api/bottle', authenticateToken, bottleRoutes);
app.use('/api/message', authenticateToken, messageRoutes);
app.use('/api/welfare', authenticateToken, welfareRoutes);
app.use('/api/shop', authenticateToken, shopRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '漂流瓶服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 漂流瓶后端服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📡 API前缀: http://localhost:${PORT}/api`);
  
  await ensureUserIntimacyTable();
  await migrateBottleIntimacyToUser();
  
  startScheduledTasks();
});
