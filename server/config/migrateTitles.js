const pool = require('./db');
const { generateUUID } = require('../utils/helper');

const TITLES = [
  {
    id: 'tycoon',
    name: '土豪',
    description: '财富榜第一名专属称号，象征着无尽的财富与荣耀',
    icon: '👑',
    color: '#ffd700',
    bgGradient: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
    type: 'rank',
    rarity: 'legendary',
    validity_type: 'duration',
    validity_value: 24,
    validity_unit: 'hour',
    sort_order: 1
  },
  {
    id: 'heartthrob',
    name: '万人迷',
    description: '魅力榜第一名专属称号，散发着无法抗拒的魅力',
    icon: '💖',
    color: '#ff6b9d',
    bgGradient: 'linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)',
    type: 'rank',
    rarity: 'legendary',
    validity_type: 'duration',
    validity_value: 24,
    validity_unit: 'hour',
    sort_order: 2
  },
  {
    id: 'signin_master',
    name: '签到达人',
    description: '连续签到7天获得，持之以恒的见证',
    icon: '📅',
    color: '#07c160',
    bgGradient: 'linear-gradient(135deg, #07c160 0%, #00a870 100%)',
    type: 'achievement',
    rarity: 'rare',
    validity_type: 'permanent',
    validity_value: null,
    validity_unit: null,
    condition: { type: 'continuous_checkin', value: 7 },
    sort_order: 10
  },
  {
    id: 'chat_master',
    name: '聊天达人',
    description: '累计发送100条消息获得，社交达人的象征',
    icon: '💬',
    color: '#1989fa',
    bgGradient: 'linear-gradient(135deg, #1989fa 0%, #0066cc 100%)',
    type: 'achievement',
    rarity: 'rare',
    validity_type: 'permanent',
    validity_value: null,
    validity_unit: null,
    condition: { type: 'total_messages', value: 100 },
    sort_order: 11
  },
  {
    id: 'sharing_expert',
    name: '分享达人',
    description: '累计扔出50个漂流瓶获得，分享你的故事',
    icon: '📤',
    color: '#ff976a',
    bgGradient: 'linear-gradient(135deg, #ff976a 0%, #ff6b35 100%)',
    type: 'achievement',
    rarity: 'epic',
    validity_type: 'permanent',
    validity_value: null,
    validity_unit: null,
    condition: { type: 'total_bottles_thrown', value: 50 },
    sort_order: 12
  },
  {
    id: 'interaction_star',
    name: '互动之星',
    description: '累计捞起30个漂流瓶获得，积极互动的探索者',
    icon: '🌟',
    color: '#7232dd',
    bgGradient: 'linear-gradient(135deg, #7232dd 0%, #551a8b 100%)',
    type: 'achievement',
    rarity: 'epic',
    validity_type: 'permanent',
    validity_value: null,
    validity_unit: null,
    condition: { type: 'total_bottles_picked', value: 30 },
    sort_order: 13
  },
  {
    id: 'task_master',
    name: '任务大师',
    description: '完成所有一次性任务获得，勤劳的小蜜蜂',
    icon: '🏆',
    color: '#ffb800',
    bgGradient: 'linear-gradient(135deg, #ff4757 0%, #c0392b 50%, #8b0000 100%)',
    type: 'achievement',
    rarity: 'legendary',
    validity_type: 'permanent',
    validity_value: null,
    validity_unit: null,
    condition: { type: 'all_once_tasks', value: true },
    sort_order: 14
  }
];

async function migrateTitles() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log('🔄 开始迁移称号系统...');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS titles (
        id VARCHAR(50) PRIMARY KEY COMMENT '称号ID',
        name VARCHAR(50) NOT NULL COMMENT '称号名称',
        description VARCHAR(200) NOT NULL COMMENT '称号描述',
        icon VARCHAR(20) DEFAULT NULL COMMENT '称号图标',
        color VARCHAR(20) DEFAULT NULL COMMENT '称号颜色',
        bg_gradient VARCHAR(100) DEFAULT NULL COMMENT '背景渐变',
        type ENUM('rank', 'achievement', 'special') NOT NULL DEFAULT 'achievement' COMMENT '称号类型:rank-排行榜,achievement-成就,special-特殊',
        rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL DEFAULT 'common' COMMENT '稀有度:common-普通,rare-稀有,epic-史诗,legendary-传说',
        validity_type ENUM('permanent', 'duration') NOT NULL DEFAULT 'permanent' COMMENT '有效期类型:permanent-永久,duration-时长',
        validity_value INT DEFAULT NULL COMMENT '有效期数值',
        validity_unit ENUM('hour', 'day', 'month') DEFAULT NULL COMMENT '有效期单位',
        condition_json JSON DEFAULT NULL COMMENT '获取条件(JSON)',
        sort_order INT DEFAULT 0 COMMENT '排序权重',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_type (type),
        INDEX idx_rarity (rarity)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ 称号配置表已就绪');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_titles (
        id VARCHAR(36) PRIMARY KEY COMMENT '记录ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        title_id VARCHAR(50) NOT NULL COMMENT '称号ID',
        source VARCHAR(50) DEFAULT NULL COMMENT '获取来源',
        obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '获得时间',
        expires_at TIMESTAMP NULL DEFAULT NULL COMMENT '过期时间',
        is_equipped TINYINT(1) DEFAULT 0 COMMENT '是否佩戴:0-未佩戴,1-佩戴中',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE,
        UNIQUE KEY uk_user_title (user_id, title_id),
        INDEX idx_user_id (user_id),
        INDEX idx_title_id (title_id),
        INDEX idx_equipped (user_id, is_equipped)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ 用户称号关联表已就绪');

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY COMMENT '通知ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        type VARCHAR(50) NOT NULL COMMENT '通知类型',
        title VARCHAR(100) NOT NULL COMMENT '通知标题',
        content TEXT COMMENT '通知内容',
        extra JSON DEFAULT NULL COMMENT '额外数据',
        is_read TINYINT(1) DEFAULT 0 COMMENT '是否已读:0-未读,1-已读',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        read_at TIMESTAMP NULL DEFAULT NULL COMMENT '阅读时间',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_read (user_id, is_read),
        INDEX idx_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ 系统通知表已就绪');

    for (const title of TITLES) {
      const conditionJson = title.condition ? JSON.stringify(title.condition) : null;
      
      const [existing] = await connection.execute(
        'SELECT id FROM titles WHERE id = ?',
        [title.id]
      );

      if (existing.length > 0) {
        await connection.execute(`
          UPDATE titles SET 
            name = ?, description = ?, icon = ?, color = ?, bg_gradient = ?,
            type = ?, rarity = ?, validity_type = ?, validity_value = ?, validity_unit = ?,
            condition_json = ?, sort_order = ?
          WHERE id = ?
        `, [
          title.name, title.description, title.icon, title.color, title.bgGradient,
          title.type, title.rarity, title.validity_type, title.validity_value, title.validity_unit,
          conditionJson, title.sort_order, title.id
        ]);
      } else {
        await connection.execute(`
          INSERT INTO titles 
            (id, name, description, icon, color, bg_gradient, type, rarity, 
             validity_type, validity_value, validity_unit, condition_json, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          title.id, title.name, title.description, title.icon, title.color, title.bgGradient,
          title.type, title.rarity, title.validity_type, title.validity_value, title.validity_unit,
          conditionJson, title.sort_order
        ]);
      }
    }
    console.log(`✅ 已初始化 ${TITLES.length} 个称号配置`);

    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'equipped_title'
    `);

    if (columns.length === 0) {
      await connection.execute(`
        ALTER TABLE users ADD COLUMN equipped_title VARCHAR(50) DEFAULT NULL COMMENT '当前佩戴的称号ID'
      `);
      console.log('✅ 已添加用户佩戴称号字段');
    }

    await connection.commit();
    console.log('🎉 称号系统迁移完成！');
  } catch (error) {
    await connection.rollback();
    console.error('❌ 称号系统迁移失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { migrateTitles, TITLES };
