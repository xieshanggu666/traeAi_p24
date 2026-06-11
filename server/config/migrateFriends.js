const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateFriends() {
  const pool = require('./db');

  try {
    console.log('开始迁移好友表...');

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS friends (
        id VARCHAR(36) PRIMARY KEY COMMENT '好友关系ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        friend_id VARCHAR(36) NOT NULL COMMENT '好友ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
        UNIQUE KEY unique_user_friend (user_id, friend_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_friend_id (friend_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('好友表创建成功');

    console.log('开始迁移好友申请表...');

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id VARCHAR(36) PRIMARY KEY COMMENT '申请ID',
        sender_id VARCHAR(36) NOT NULL COMMENT '发送者ID',
        receiver_id VARCHAR(36) NOT NULL COMMENT '接收者ID',
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending' COMMENT '状态:pending-待处理,accepted-已接受,rejected-已拒绝',
        message VARCHAR(200) DEFAULT NULL COMMENT '申请留言',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        UNIQUE KEY unique_sender_receiver (sender_id, receiver_id),
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_sender_id (sender_id),
        INDEX idx_receiver_id (receiver_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('好友申请表创建成功');

    console.log('\n好友功能迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('好友功能迁移失败:', error);
    process.exit(1);
  }
}

migrateFriends();
