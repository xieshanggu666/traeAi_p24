const pool = require('./db');

async function migrateShop() {
  try {
    console.log('开始商城功能数据库迁移...');

    console.log('创建user_items表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_items (
        id VARCHAR(36) PRIMARY KEY COMMENT '道具记录ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        item_key VARCHAR(50) NOT NULL COMMENT '道具标识: retro_card/throw_card/pick_card',
        quantity INT NOT NULL DEFAULT 0 COMMENT '数量',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        UNIQUE KEY uk_user_item (user_id, item_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('user_items表创建成功');

    console.log('创建shop_purchases表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS shop_purchases (
        id VARCHAR(36) PRIMARY KEY COMMENT '购买记录ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        item_key VARCHAR(50) NOT NULL COMMENT '道具标识',
        price INT NOT NULL COMMENT '购买价格',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '购买时间',
        INDEX idx_user_item (user_id, item_key),
        INDEX idx_user_created (user_id, created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('shop_purchases表创建成功');

    console.log('\n商城功能数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('商城功能数据库迁移失败:', error);
    process.exit(1);
  }
}

migrateShop();
