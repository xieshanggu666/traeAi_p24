const pool = require('./db');

async function migrateBottleAdvancedFeatures() {
  try {
    console.log('开始漂流瓶高级功能数据库迁移...');

    console.log('检查并添加 expires_at 字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN expires_at TIMESTAMP NULL DEFAULT NULL COMMENT '瓶子过期时间（7天）' AFTER created_at
      `);
      console.log('expires_at 字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('expires_at 字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加 pick_count 字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN pick_count INT NOT NULL DEFAULT 0 COMMENT '捞取次数' AFTER status
      `);
      console.log('pick_count 字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('pick_count 字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加 is_pinned 字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否置顶:0-否,1-是' AFTER pick_count
      `);
      console.log('is_pinned 字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('is_pinned 字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加 pinned_at 字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN pinned_at TIMESTAMP NULL DEFAULT NULL COMMENT '置顶开始时间' AFTER is_pinned
      `);
      console.log('pinned_at 字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('pinned_at 字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加 is_deleted 字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否撤回删除:0-否,1-是' AFTER pinned_at
      `);
      console.log('is_deleted 字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('is_deleted 字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('创建 bottle_pick_records 表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS bottle_pick_records (
        id VARCHAR(36) PRIMARY KEY COMMENT '记录ID',
        bottle_id VARCHAR(36) NOT NULL COMMENT '瓶子ID',
        picker_id VARCHAR(36) NOT NULL COMMENT '捞取者ID',
        picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '捞取时间',
        UNIQUE KEY uk_bottle_picker (bottle_id, picker_id),
        INDEX idx_bottle_id (bottle_id),
        INDEX idx_picker_id (picker_id),
        FOREIGN KEY (bottle_id) REFERENCES bottles(id) ON DELETE CASCADE,
        FOREIGN KEY (picker_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('bottle_pick_records 表创建成功');

    console.log('创建 bottle_operation_logs 表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS bottle_operation_logs (
        id VARCHAR(36) PRIMARY KEY COMMENT '日志ID',
        bottle_id VARCHAR(36) DEFAULT NULL COMMENT '瓶子ID',
        user_id VARCHAR(36) DEFAULT NULL COMMENT '操作用户ID',
        operation_type VARCHAR(50) NOT NULL COMMENT '操作类型:throw/pick/reply/recall/pin/expire_cleanup',
        coin_cost INT NOT NULL DEFAULT 0 COMMENT '消耗漂流币数量',
        detail TEXT COMMENT '操作详情',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
        INDEX idx_bottle_id (bottle_id),
        INDEX idx_user_id (user_id),
        INDEX idx_operation_type (operation_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('bottle_operation_logs 表创建成功');

    console.log('创建 bottle_cleanup_logs 表...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS bottle_cleanup_logs (
        id VARCHAR(36) PRIMARY KEY COMMENT '清理日志ID',
        cleanup_type VARCHAR(50) NOT NULL COMMENT '清理类型:expired/pick_limit',
        cleaned_count INT NOT NULL DEFAULT 0 COMMENT '清理的瓶子数量',
        start_time TIMESTAMP NULL DEFAULT NULL COMMENT '清理开始时间',
        end_time TIMESTAMP NULL DEFAULT NULL COMMENT '清理结束时间',
        detail TEXT COMMENT '清理详情',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_cleanup_type (cleanup_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('bottle_cleanup_logs 表创建成功');

    console.log('为现有漂浮瓶子设置过期时间...');
    await pool.execute(`
      UPDATE bottles 
      SET expires_at = DATE_ADD(created_at, INTERVAL 7 DAY)
      WHERE status = 'floating' AND expires_at IS NULL
    `);
    console.log('过期时间设置完成');

    console.log('添加索引优化查询...');
    try {
      await pool.execute(`
        ALTER TABLE bottles ADD INDEX idx_status_is_pinned (status, is_pinned)
      `);
      console.log('idx_status_is_pinned 索引添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('idx_status_is_pinned 索引已存在，跳过');
      } else {
        throw error;
      }
    }

    try {
      await pool.execute(`
        ALTER TABLE bottles ADD INDEX idx_expires_at_status (expires_at, status)
      `);
      console.log('idx_expires_at_status 索引添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('idx_expires_at_status 索引已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('\n漂流瓶高级功能数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('漂流瓶高级功能数据库迁移失败:', error);
    process.exit(1);
  }
}

migrateBottleAdvancedFeatures();
