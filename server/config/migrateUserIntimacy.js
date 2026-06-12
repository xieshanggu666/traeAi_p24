const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateUserIntimacy() {
  const pool = require('./db');

  try {
    console.log('开始迁移用户亲密度表...');

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
    console.log('用户亲密度表创建成功');

    console.log('开始迁移现有数据：从 bottle_intimacy 合并到 user_intimacy...');
    
    const [bottleIntimacies] = await pool.execute(`
      SELECT bi.bottle_id, bi.intimacy_value, b.sender_id, b.picker_id
      FROM bottle_intimacy bi
      LEFT JOIN bottles b ON bi.bottle_id = b.id
      WHERE b.sender_id IS NOT NULL AND b.picker_id IS NOT NULL
    `);

    console.log(`找到 ${bottleIntimacies.length} 条瓶子亲密度记录需要迁移`);

    for (const row of bottleIntimacies) {
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
        const { generateUUID } = require('../utils/helper');
        const id = generateUUID();
        await pool.execute(
          'INSERT INTO user_intimacy (id, user_id1, user_id2, intimacy_value) VALUES (?, ?, ?, ?)',
          [id, user_id1, user_id2, value]
        );
      }
    }

    console.log('数据迁移完成！');
    console.log('\n用户亲密度迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('用户亲密度迁移失败:', error);
    process.exit(1);
  }
}

function normalizeUserPair(userIdA, userIdB) {
  if (userIdA < userIdB) {
    return { user_id1: userIdA, user_id2: userIdB };
  }
  return { user_id1: userIdB, user_id2: userIdA };
}

migrateUserIntimacy();
