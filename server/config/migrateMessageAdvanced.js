const pool = require('./db');

async function migrateMessageAdvanced() {
  try {
    console.log('开始消息高级功能数据库迁移...');

    console.log('检查并添加messages.is_recalled字段...');
    try {
      await pool.execute(`
        ALTER TABLE messages 
        ADD COLUMN is_recalled TINYINT(1) DEFAULT 0 COMMENT '是否撤回:0-未撤回,1-已撤回' AFTER is_read
      `);
      console.log('messages.is_recalled字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('messages.is_recalled字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加messages.recalled_at字段...');
    try {
      await pool.execute(`
        ALTER TABLE messages 
        ADD COLUMN recalled_at TIMESTAMP NULL DEFAULT NULL COMMENT '撤回时间' AFTER is_recalled
      `);
      console.log('messages.recalled_at字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('messages.recalled_at字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('创建typing_status表...');
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS typing_status (
          id VARCHAR(36) PRIMARY KEY COMMENT '记录ID',
          bottle_id VARCHAR(36) NOT NULL COMMENT '关联瓶子ID',
          user_id VARCHAR(36) NOT NULL COMMENT '正在输入的用户ID',
          other_user_id VARCHAR(36) NOT NULL COMMENT '对方用户ID',
          is_typing TINYINT(1) DEFAULT 0 COMMENT '是否正在输入:0-否,1-是',
          last_typing_at TIMESTAMP NULL DEFAULT NULL COMMENT '最后输入时间',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
          UNIQUE KEY uk_bottle_user (bottle_id, user_id),
          INDEX idx_bottle_other (bottle_id, other_user_id),
          INDEX idx_last_typing (last_typing_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('typing_status表创建成功');
    } catch (error) {
      console.error('创建typing_status表失败:', error.message);
      throw error;
    }

    console.log('\n消息高级功能数据库迁移完成！');
    return true;
  } catch (error) {
    console.error('消息高级功能数据库迁移失败:', error.message);
    return false;
  }
}

module.exports = { migrateMessageAdvanced };

if (require.main === module) {
  migrateMessageAdvanced().then(success => {
    process.exit(success ? 0 : 1);
  });
}
