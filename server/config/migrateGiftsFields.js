const pool = require('./db');

async function migrateGiftsFields() {
  try {
    console.log('检查并添加users.charm字段...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN charm INT NOT NULL DEFAULT 0 COMMENT '魅力值' AFTER coins
      `);
      console.log('users.charm字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('users.charm字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('创建received_gifts表...');
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS received_gifts (
          id VARCHAR(36) PRIMARY KEY COMMENT '礼物记录ID',
          sender_id VARCHAR(36) NOT NULL COMMENT '赠送者ID',
          receiver_id VARCHAR(36) NOT NULL COMMENT '接收者ID',
          gift_key VARCHAR(50) NOT NULL COMMENT '礼物标识',
          gift_name VARCHAR(50) NOT NULL COMMENT '礼物名称',
          gift_icon VARCHAR(10) NOT NULL COMMENT '礼物图标',
          charm_value INT NOT NULL COMMENT '增加的魅力值',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '赠送时间',
          INDEX idx_receiver_id (receiver_id),
          INDEX idx_sender_id (sender_id),
          INDEX idx_receiver_created (receiver_id, created_at),
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('received_gifts表创建成功');
    } catch (error) {
      console.log('received_gifts表已存在，跳过');
    }

    console.log('✅ 礼物功能字段迁移完成');
  } catch (error) {
    console.error('礼物功能字段迁移失败:', error.message);
  }
}

module.exports = { migrateGiftsFields };
