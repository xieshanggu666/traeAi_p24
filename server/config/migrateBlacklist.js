const pool = require('./db');

async function migrateBlacklistAndMessageFeatures() {
  try {
    console.log('开始黑名单和消息图片功能数据库迁移...');

    console.log('创建blacklists表...');
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS blacklists (
          id VARCHAR(36) PRIMARY KEY COMMENT '记录ID',
          user_id VARCHAR(36) NOT NULL COMMENT '操作者用户ID',
          blocked_user_id VARCHAR(36) NOT NULL COMMENT '被拉黑用户ID',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '拉黑时间',
          UNIQUE KEY uk_user_blocked (user_id, blocked_user_id),
          INDEX idx_user_id (user_id),
          INDEX idx_blocked_user_id (blocked_user_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('blacklists表创建成功');
    } catch (error) {
      if (error.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('blacklists表已存在，跳过');
      } else {
        console.error('创建blacklists表失败:', error.message);
        throw error;
      }
    }

    console.log('检查并添加messages.is_blocked字段...');
    try {
      await pool.execute(`
        ALTER TABLE messages 
        ADD COLUMN is_blocked TINYINT(1) DEFAULT 0 COMMENT '是否被对方拒收:0-否,1-是' AFTER is_recalled
      `);
      console.log('messages.is_blocked字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('messages.is_blocked字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加messages.image_url字段...');
    try {
      await pool.execute(`
        ALTER TABLE messages 
        ADD COLUMN image_url VARCHAR(255) DEFAULT NULL COMMENT '消息图片URL' AFTER content
      `);
      console.log('messages.image_url字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('messages.image_url字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('\n黑名单和消息图片功能数据库迁移完成！');
    return true;
  } catch (error) {
    console.error('黑名单和消息图片功能数据库迁移失败:', error.message);
    return false;
  }
}

module.exports = { migrateBlacklistAndMessageFeatures };

if (require.main === module) {
  migrateBlacklistAndMessageFeatures().then(success => {
    process.exit(success ? 0 : 1);
  });
}
