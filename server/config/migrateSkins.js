const pool = require('./db');
const { generateUUID } = require('../utils/helper');

const SKINS = [
  {
    id: 'skin_valentine',
    name: '情人节限定',
    description: '浪漫粉爱心，让爱意漂流',
    emoji: '💝',
    gradient_from: '#ff6b9d',
    gradient_to: '#ffc3d0',
    border_color: '#ff4081',
    theme: 'valentine',
    rarity: 'rare'
  },
  {
    id: 'skin_spring_festival',
    name: '春节红包',
    description: '喜庆红色，福气满满迎新年',
    emoji: '🧧',
    gradient_from: '#ff4d4f',
    gradient_to: '#ff7875',
    border_color: '#d4380d',
    theme: 'spring_festival',
    rarity: 'rare'
  },
  {
    id: 'skin_planting',
    name: '植树节绿意',
    description: '清新绿色，播种希望',
    emoji: '🌱',
    gradient_from: '#52c41a',
    gradient_to: '#95de64',
    border_color: '#389e0d',
    theme: 'planting',
    rarity: 'common'
  },
  {
    id: 'skin_labor',
    name: '劳动节荣耀',
    description: '金黄色调，致敬勤劳的你',
    emoji: '🏆',
    gradient_from: '#faad14',
    gradient_to: '#ffd666',
    border_color: '#d48806',
    theme: 'labor',
    rarity: 'common'
  },
  {
    id: 'skin_national',
    name: '国庆盛典',
    description: '中国红配五星，盛世华诞',
    emoji: '🇨🇳',
    gradient_from: '#de2910',
    gradient_to: '#ff4d4f',
    border_color: '#a8071a',
    theme: 'national',
    rarity: 'rare'
  },
  {
    id: 'skin_mid_autumn',
    name: '中秋月圆',
    description: '明月皎皎，寄托思念',
    emoji: '🌕',
    gradient_from: '#1890ff',
    gradient_to: '#69c0ff',
    border_color: '#096dd9',
    theme: 'mid_autumn',
    rarity: 'rare'
  },
  {
    id: 'skin_christmas',
    name: '圣诞快乐',
    description: '红绿经典，温暖冬日',
    emoji: '🎄',
    gradient_from: '#52c41a',
    gradient_to: '#ff4d4f',
    border_color: '#237804',
    theme: 'christmas',
    rarity: 'legendary'
  },
  {
    id: 'skin_new_year',
    name: '元旦烟花',
    description: '绚烂烟花，辞旧迎新',
    emoji: '🎆',
    gradient_from: '#722ed1',
    gradient_to: '#9254de',
    border_color: '#531dab',
    theme: 'new_year',
    rarity: 'legendary'
  }
];

const SKIN_PRICES = {
  '1h': 18,
  '1d': 48,
  '7d': 188
};

const DURATION_HOURS = {
  '1h': 1,
  '1d': 24,
  '7d': 168
};

async function migrateSkins() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    console.log('开始皮肤功能数据库迁移...');

    console.log('创建bottle_skins表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bottle_skins (
        id VARCHAR(50) PRIMARY KEY COMMENT '皮肤ID',
        name VARCHAR(50) NOT NULL COMMENT '皮肤名称',
        description VARCHAR(200) DEFAULT NULL COMMENT '皮肤描述',
        emoji VARCHAR(20) NOT NULL COMMENT '皮肤表情符号',
        gradient_from VARCHAR(20) NOT NULL COMMENT '渐变起始色',
        gradient_to VARCHAR(20) NOT NULL COMMENT '渐变结束色',
        border_color VARCHAR(20) NOT NULL COMMENT '边框颜色',
        theme VARCHAR(30) DEFAULT NULL COMMENT '主题标识',
        rarity VARCHAR(20) NOT NULL DEFAULT 'common' COMMENT '稀有度:common/rare/legendary',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否上架:1-上架,0-下架',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('bottle_skins表创建成功');

    console.log('检查并修补bottle_skins表字段...');
    const requiredSkinColumns = [
      { name: 'description', def: 'VARCHAR(200) DEFAULT NULL COMMENT \'皮肤描述\'' },
      { name: 'emoji', def: 'VARCHAR(20) NOT NULL COMMENT \'皮肤表情符号\'' },
      { name: 'gradient_from', def: 'VARCHAR(20) NOT NULL COMMENT \'渐变起始色\'' },
      { name: 'gradient_to', def: 'VARCHAR(20) NOT NULL COMMENT \'渐变结束色\'' },
      { name: 'border_color', def: 'VARCHAR(20) NOT NULL COMMENT \'边框颜色\'' },
      { name: 'theme', def: 'VARCHAR(30) DEFAULT NULL COMMENT \'主题标识\'' },
      { name: 'rarity', def: 'VARCHAR(20) NOT NULL DEFAULT \'common\' COMMENT \'稀有度:common/rare/legendary\'' },
      { name: 'is_active', def: 'TINYINT(1) DEFAULT 1 COMMENT \'是否上架:1-上架,0-下架\'' }
    ];
    const [existingSkinCols] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bottle_skins'
    `);
    const existingSkinColNames = existingSkinCols.map(c => c.COLUMN_NAME);
    for (const col of requiredSkinColumns) {
      if (!existingSkinColNames.includes(col.name)) {
        console.log(`添加缺失字段: ${col.name}`);
        await connection.execute(`ALTER TABLE bottle_skins ADD COLUMN ${col.name} ${col.def}`);
      }
    }
    console.log('bottle_skins表字段修补完成');

    console.log('创建user_skins表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_skins (
        id VARCHAR(36) PRIMARY KEY COMMENT '记录ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        skin_id VARCHAR(50) NOT NULL COMMENT '皮肤ID',
        duration VARCHAR(10) NOT NULL COMMENT '时长:1h/1d/7d',
        price INT NOT NULL COMMENT '购买价格',
        expire_at TIMESTAMP NOT NULL COMMENT '过期时间',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否当前使用:1-使用中,0-未使用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '购买时间',
        INDEX idx_user_id (user_id),
        INDEX idx_skin_id (skin_id),
        INDEX idx_expire_at (expire_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (skin_id) REFERENCES bottle_skins(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('user_skins表创建成功');

    console.log('检查并修补user_skins表字段...');
    const requiredUserSkinColumns = [
      { name: 'duration', def: 'VARCHAR(10) NOT NULL COMMENT \'时长:1h/1d/7d\'' },
      { name: 'price', def: 'INT NOT NULL COMMENT \'购买价格\'' },
      { name: 'expire_at', def: 'TIMESTAMP NOT NULL COMMENT \'过期时间\'' },
      { name: 'is_active', def: 'TINYINT(1) DEFAULT 1 COMMENT \'是否当前使用:1-使用中,0-未使用\'' }
    ];
    const [existingUserSkinCols] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_skins'
    `);
    const existingUserSkinColNames = existingUserSkinCols.map(c => c.COLUMN_NAME);
    for (const col of requiredUserSkinColumns) {
      if (!existingUserSkinColNames.includes(col.name)) {
        console.log(`添加缺失字段: ${col.name}`);
        await connection.execute(`ALTER TABLE user_skins ADD COLUMN ${col.name} ${col.def}`);
      }
    }
    console.log('user_skins表字段修补完成');

    console.log('检查bottles表是否有skin_id字段...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bottles' AND COLUMN_NAME = 'skin_id'
    `);
    if (columns.length === 0) {
      console.log('添加skin_id字段到bottles表...');
      await connection.execute(`
        ALTER TABLE bottles ADD COLUMN skin_id VARCHAR(50) DEFAULT NULL COMMENT '漂流瓶皮肤ID' AFTER content
      `);
      console.log('skin_id字段添加成功');
    } else {
      console.log('skin_id字段已存在，跳过');
    }

    console.log('插入/更新默认皮肤数据...');
    for (const skin of SKINS) {
      const [existing] = await connection.execute(
        'SELECT id FROM bottle_skins WHERE id = ?',
        [skin.id]
      );
      if (existing.length > 0) {
        await connection.execute(`
          UPDATE bottle_skins SET 
            name = ?, description = ?, emoji = ?, 
            gradient_from = ?, gradient_to = ?, border_color = ?, 
            theme = ?, rarity = ?, is_active = 1
          WHERE id = ?
        `, [
          skin.name, skin.description, skin.emoji,
          skin.gradient_from, skin.gradient_to, skin.border_color,
          skin.theme, skin.rarity, skin.id
        ]);
        console.log(`更新皮肤数据: ${skin.name}`);
      } else {
        await connection.execute(`
          INSERT INTO bottle_skins (id, name, description, emoji, gradient_from, gradient_to, border_color, theme, rarity, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          skin.id, skin.name, skin.description, skin.emoji,
          skin.gradient_from, skin.gradient_to, skin.border_color,
          skin.theme, skin.rarity
        ]);
        console.log(`插入皮肤数据: ${skin.name}`);
      }
    }
    console.log('默认皮肤数据处理完成');

    console.log('清理不在皮肤列表中的旧记录...');
    const validSkinIds = SKINS.map(s => s.id);
    const placeholders = validSkinIds.map(() => '?').join(',');
    const [deleteResult] = await connection.execute(
      `DELETE FROM bottle_skins WHERE id NOT IN (${placeholders})`,
      validSkinIds
    );
    if (deleteResult.affectedRows > 0) {
      console.log(`已清理 ${deleteResult.affectedRows} 条旧皮肤记录`);
    } else {
      console.log('无需清理旧皮肤记录');
    }

    await connection.commit();
    console.log('\n✅ 皮肤功能数据库迁移完成！');
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('❌ 皮肤功能数据库迁移失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  migrateSkins,
  SKINS,
  SKIN_PRICES,
  DURATION_HOURS
};

if (require.main === module) {
  migrateSkins()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
