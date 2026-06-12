const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  let connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('开始创建数据库...');
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`数据库 ${process.env.DB_NAME} 创建成功`);

    await connection.end();

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('开始创建用户表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY COMMENT '用户UUID',
        username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
        password VARCHAR(255) NOT NULL COMMENT '密码(加密)',
        nickname VARCHAR(50) NOT NULL COMMENT '匿名昵称',
        avatar VARCHAR(255) DEFAULT NULL COMMENT '头像',
        gender VARCHAR(10) DEFAULT NULL COMMENT '性别',
        birthday DATE DEFAULT NULL COMMENT '出生年月',
        bio VARCHAR(200) DEFAULT NULL COMMENT '个人介绍',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后活跃时间'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('用户表创建成功');

    console.log('开始创建漂流瓶表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bottles (
        id VARCHAR(36) PRIMARY KEY COMMENT '瓶子ID',
        sender_id VARCHAR(36) NOT NULL COMMENT '发送者ID',
        content TEXT NOT NULL COMMENT '瓶子内容',
        status ENUM('floating', 'picked', 'replied') DEFAULT 'floating' COMMENT '状态:floating-漂浮中,picked-被捡起,replied-已回复',
        picker_id VARCHAR(36) DEFAULT NULL COMMENT '捡起者ID',
        picked_at TIMESTAMP NULL DEFAULT NULL COMMENT '捡起时间',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (picker_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_sender_id (sender_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('漂流瓶表创建成功');

    console.log('开始创建消息表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(36) PRIMARY KEY COMMENT '消息ID',
        bottle_id VARCHAR(36) NOT NULL COMMENT '关联瓶子ID',
        sender_id VARCHAR(36) NOT NULL COMMENT '发送者ID',
        receiver_id VARCHAR(36) NOT NULL COMMENT '接收者ID',
        content TEXT NOT NULL COMMENT '消息内容',
        is_read TINYINT(1) DEFAULT 0 COMMENT '是否已读:0-未读,1-已读',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
        FOREIGN KEY (bottle_id) REFERENCES bottles(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_bottle_id (bottle_id),
        INDEX idx_sender_receiver (sender_id, receiver_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('消息表创建成功');

    console.log('开始创建用户亲密度表...');
    await connection.execute(`
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

    await connection.end();
    console.log('\n数据库初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
