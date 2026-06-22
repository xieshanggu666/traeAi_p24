const pool = require('./db');

async function migrateSpecialGifts() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS special_gift_notifications (
        id VARCHAR(36) PRIMARY KEY COMMENT '通知ID',
        sender_id VARCHAR(36) NOT NULL COMMENT '赠送者ID',
        sender_nickname VARCHAR(50) NOT NULL COMMENT '赠送者昵称',
        receiver_id VARCHAR(36) NOT NULL COMMENT '接收者ID',
        receiver_nickname VARCHAR(50) NOT NULL COMMENT '接收者昵称',
        gift_key VARCHAR(50) NOT NULL COMMENT '礼物标识',
        gift_name VARCHAR(50) NOT NULL COMMENT '礼物名称',
        gift_icon VARCHAR(10) NOT NULL COMMENT '礼物图标',
        effect_type VARCHAR(30) NOT NULL COMMENT '特效类型',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ 特效礼物通知表已就绪');
  } catch (error) {
    console.error('特效礼物通知表迁移失败:', error.message);
  }
}

module.exports = { migrateSpecialGifts };
