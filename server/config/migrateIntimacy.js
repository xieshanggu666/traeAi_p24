const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateIntimacy() {
  const pool = require('./db');

  try {
    console.log('开始迁移亲密值表...');

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS bottle_intimacy (
        id VARCHAR(36) PRIMARY KEY COMMENT '亲密值记录ID',
        bottle_id VARCHAR(36) NOT NULL UNIQUE COMMENT '关联瓶子ID',
        intimacy_value INT DEFAULT 0 COMMENT '亲密值',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        FOREIGN KEY (bottle_id) REFERENCES bottles(id) ON DELETE CASCADE,
        INDEX idx_bottle_id (bottle_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('亲密值表创建成功');

    console.log('\n亲密值迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('亲密值迁移失败:', error);
    process.exit(1);
  }
}

migrateIntimacy();
