const pool = require('./db');

async function migrateWelfare() {
  try {
    console.log('开始福利功能数据库迁移...');

    console.log('检查并添加users.coins字段...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN coins INT NOT NULL DEFAULT 0 COMMENT '漂流币余额' AFTER bio
      `);
      console.log('users.coins字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('users.coins字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('创建coin_records表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS coin_records (
        id VARCHAR(36) PRIMARY KEY COMMENT '记录ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        amount INT NOT NULL COMMENT '变动数量(正数增加负数减少)',
        type VARCHAR(20) NOT NULL COMMENT '类型:checkin/gift/task',
        source VARCHAR(100) NOT NULL COMMENT '来源描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_user_id (user_id),
        INDEX idx_user_created (user_id, created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('coin_records表创建成功');

    console.log('创建checkins表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS checkins (
        id VARCHAR(36) PRIMARY KEY COMMENT '签到ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        checkin_date DATE NOT NULL COMMENT '签到日期',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '签到时间',
        UNIQUE KEY uk_user_date (user_id, checkin_date),
        INDEX idx_user_date (user_id, checkin_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('checkins表创建成功');

    console.log('创建gift_claims表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS gift_claims (
        id VARCHAR(36) PRIMARY KEY COMMENT '领取ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        gift_days INT NOT NULL COMMENT '礼包天数:7/14/21',
        month VARCHAR(7) NOT NULL COMMENT '所属月份YYYY-MM',
        amount INT NOT NULL COMMENT '获得的漂流币数量',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
        UNIQUE KEY uk_user_gift_month (user_id, gift_days, month),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('gift_claims表创建成功');

    console.log('创建task_claims表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS task_claims (
        id VARCHAR(36) PRIMARY KEY COMMENT '领取ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        task_key VARCHAR(50) NOT NULL COMMENT '任务标识',
        task_type ENUM('once', 'daily') NOT NULL COMMENT '任务类型',
        amount INT NOT NULL COMMENT '获得的漂流币数量',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
        INDEX idx_user_task (user_id, task_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('task_claims表创建成功');

    console.log('创建daily_stats表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id VARCHAR(36) PRIMARY KEY COMMENT '统计ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        stat_date DATE NOT NULL COMMENT '统计日期',
        usage_seconds INT NOT NULL DEFAULT 0 COMMENT '使用秒数',
        throw_count INT NOT NULL DEFAULT 0 COMMENT '扔瓶子次数',
        pick_count INT NOT NULL DEFAULT 0 COMMENT '捞瓶子次数',
        UNIQUE KEY uk_user_date (user_id, stat_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('daily_stats表创建成功');

    console.log('\n福利功能数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('福利功能数据库迁移失败:', error);
    process.exit(1);
  }
}

migrateWelfare();
