const pool = require('./db');
const { generateUUID } = require('../utils/helper');

const AVATAR_FRAMES = [
  {
    id: 'frame_gold_glory',
    name: '金色荣耀',
    description: '闪耀金色边框，彰显尊贵身份',
    border_color: '#ffd700',
    gradient_from: '#ffd700',
    gradient_to: '#ffb700',
    shadow_color: '#ffd70060',
    rarity: 'legendary',
    icon: '👑'
  },
  {
    id: 'frame_pink_sweet',
    name: '粉色甜蜜',
    description: '浪漫粉色爱心，甜蜜满溢',
    border_color: '#ff6b9d',
    gradient_from: '#ffb6c1',
    gradient_to: '#ff69b4',
    shadow_color: '#ff6b9d60',
    rarity: 'rare',
    icon: '💗'
  },
  {
    id: 'frame_blue_ocean',
    name: '蓝色海洋',
    description: '深邃海洋蓝，自由如风',
    border_color: '#1890ff',
    gradient_from: '#69c0ff',
    gradient_to: '#1890ff',
    shadow_color: '#1890ff60',
    rarity: 'rare',
    icon: '🌊'
  },
  {
    id: 'frame_green_forest',
    name: '绿色森林',
    description: '清新森林绿，自然气息',
    border_color: '#52c41a',
    gradient_from: '#95de64',
    gradient_to: '#52c41a',
    shadow_color: '#52c41a60',
    rarity: 'common',
    icon: '🌿'
  },
  {
    id: 'frame_purple_dream',
    name: '紫色梦幻',
    description: '梦幻紫星光，神秘优雅',
    border_color: '#722ed1',
    gradient_from: '#b37feb',
    gradient_to: '#722ed1',
    shadow_color: '#722ed160',
    rarity: 'legendary',
    icon: '✨'
  },
  {
    id: 'frame_red_flame',
    name: '红色热情',
    description: '炽热火焰红，热情似火',
    border_color: '#ff4d4f',
    gradient_from: '#ff7875',
    gradient_to: '#ff4d4f',
    shadow_color: '#ff4d4f60',
    rarity: 'rare',
    icon: '🔥'
  },
  {
    id: 'frame_silver_star',
    name: '银色星辰',
    description: '璀璨银星光，闪耀夺目',
    border_color: '#c0c0c0',
    gradient_from: '#e8e8e8',
    gradient_to: '#c0c0c0',
    shadow_color: '#c0c0c060',
    rarity: 'common',
    icon: '⭐'
  },
  {
    id: 'frame_rainbow',
    name: '彩虹缤纷',
    description: '七彩彩虹，缤纷绚丽',
    border_color: '#ff6b6b',
    gradient_from: '#ff6b6b',
    gradient_to: '#4ecdc4',
    shadow_color: '#ff6b6b60',
    rarity: 'legendary',
    icon: '🌈'
  }
];

const CHAT_SKINS = [
  {
    id: 'chat_mint_fresh',
    name: '清新薄荷',
    description: '薄荷绿清新风格，清爽怡人',
    bg_color: '#f0fff4',
    bubble_bg_other: '#ffffff',
    bubble_bg_mine: '#b7eb8f',
    text_color_mine: '#237804',
    text_color_other: '#333333',
    border_color: '#52c41a',
    rarity: 'common',
    icon: '🍃'
  },
  {
    id: 'chat_orange_warm',
    name: '暖阳橙黄',
    description: '温暖橙黄色，阳光般的感觉',
    bg_color: '#fffbe6',
    bubble_bg_other: '#ffffff',
    bubble_bg_mine: '#ffd666',
    text_color_mine: '#d46b08',
    text_color_other: '#333333',
    border_color: '#faad14',
    rarity: 'common',
    icon: '☀️'
  },
  {
    id: 'chat_night_sky',
    name: '深邃夜空',
    description: '深蓝夜空主题，神秘宁静',
    bg_color: '#1a1a2e',
    bubble_bg_other: '#16213e',
    bubble_bg_mine: '#0f3460',
    text_color_mine: '#e8e8e8',
    text_color_other: '#cccccc',
    border_color: '#5352ed',
    rarity: 'rare',
    icon: '🌙'
  },
  {
    id: 'chat_cherry',
    name: '樱花粉色',
    description: '浪漫樱花粉，温柔甜美',
    bg_color: '#fff0f6',
    bubble_bg_other: '#ffffff',
    bubble_bg_mine: '#ffadd2',
    text_color_mine: '#9e1068',
    text_color_other: '#333333',
    border_color: '#eb2f96',
    rarity: 'rare',
    icon: '🌸'
  },
  {
    id: 'chat_ocean_blue',
    name: '海洋蓝调',
    description: '深邃海洋蓝，自由辽阔',
    bg_color: '#e6f7ff',
    bubble_bg_other: '#ffffff',
    bubble_bg_mine: '#69c0ff',
    text_color_mine: '#003a8c',
    text_color_other: '#333333',
    border_color: '#1890ff',
    rarity: 'rare',
    icon: '🐳'
  },
  {
    id: 'chat_forest_green',
    name: '森林绿意',
    description: '森林绿色调，自然清新',
    bg_color: '#f6ffed',
    bubble_bg_other: '#ffffff',
    bubble_bg_mine: '#95de64',
    text_color_mine: '#237804',
    text_color_other: '#333333',
    border_color: '#52c41a',
    rarity: 'common',
    icon: '🌲'
  },
  {
    id: 'chat_starlight',
    name: '星空紫夜',
    description: '紫色星空，梦幻浪漫',
    bg_color: '#f9f0ff',
    bubble_bg_other: '#ffffff',
    bubble_bg_mine: '#d3adf7',
    text_color_mine: '#531dab',
    text_color_other: '#333333',
    border_color: '#722ed1',
    rarity: 'legendary',
    icon: '🌟'
  },
  {
    id: 'chat_vintage',
    name: '复古棕咖',
    description: '复古棕色调，怀旧经典',
    bg_color: '#fff7e6',
    bubble_bg_other: '#ffffff',
    bubble_bg_mine: '#ffd591',
    text_color_mine: '#874d00',
    text_color_other: '#333333',
    border_color: '#d46b08',
    rarity: 'legendary',
    icon: '☕'
  }
];

const PRICE = 188;

async function migrateAvatarAndChatSkins() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    console.log('开始头像框和聊天框皮肤数据库迁移...');

    console.log('创建avatar_frames表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS avatar_frames (
        id VARCHAR(50) PRIMARY KEY COMMENT '头像框ID',
        name VARCHAR(50) NOT NULL COMMENT '头像框名称',
        description VARCHAR(200) DEFAULT NULL COMMENT '头像框描述',
        border_color VARCHAR(20) NOT NULL COMMENT '边框颜色',
        gradient_from VARCHAR(20) NOT NULL COMMENT '渐变起始色',
        gradient_to VARCHAR(20) NOT NULL COMMENT '渐变结束色',
        shadow_color VARCHAR(20) DEFAULT NULL COMMENT '阴影颜色',
        rarity VARCHAR(20) NOT NULL DEFAULT 'common' COMMENT '稀有度:common/rare/legendary',
        icon VARCHAR(20) DEFAULT NULL COMMENT '图标emoji',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否上架:1-上架,0-下架',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('avatar_frames表创建成功');

    console.log('创建user_avatar_frames表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_avatar_frames (
        id VARCHAR(36) PRIMARY KEY COMMENT '记录ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        frame_id VARCHAR(50) NOT NULL COMMENT '头像框ID',
        price INT NOT NULL COMMENT '购买价格',
        is_active TINYINT(1) DEFAULT 0 COMMENT '是否当前使用:1-使用中,0-未使用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '购买时间',
        INDEX idx_user_id (user_id),
        INDEX idx_frame_id (frame_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (frame_id) REFERENCES avatar_frames(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('user_avatar_frames表创建成功');

    console.log('创建chat_skins表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS chat_skins (
        id VARCHAR(50) PRIMARY KEY COMMENT '聊天皮肤ID',
        name VARCHAR(50) NOT NULL COMMENT '聊天皮肤名称',
        description VARCHAR(200) DEFAULT NULL COMMENT '聊天皮肤描述',
        bg_color VARCHAR(20) NOT NULL COMMENT '背景颜色',
        bubble_bg_other VARCHAR(20) NOT NULL COMMENT '对方气泡背景色',
        bubble_bg_mine VARCHAR(20) NOT NULL COMMENT '我的气泡背景色',
        text_color_mine VARCHAR(20) NOT NULL COMMENT '我的文字颜色',
        text_color_other VARCHAR(20) NOT NULL COMMENT '对方文字颜色',
        border_color VARCHAR(20) NOT NULL COMMENT '边框颜色',
        rarity VARCHAR(20) NOT NULL DEFAULT 'common' COMMENT '稀有度:common/rare/legendary',
        icon VARCHAR(20) DEFAULT NULL COMMENT '图标emoji',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否上架:1-上架,0-下架',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('chat_skins表创建成功');

    console.log('创建user_chat_skins表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_chat_skins (
        id VARCHAR(36) PRIMARY KEY COMMENT '记录ID',
        user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
        skin_id VARCHAR(50) NOT NULL COMMENT '聊天皮肤ID',
        price INT NOT NULL COMMENT '购买价格',
        is_active TINYINT(1) DEFAULT 0 COMMENT '是否当前使用:1-使用中,0-未使用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '购买时间',
        INDEX idx_user_id (user_id),
        INDEX idx_skin_id (skin_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (skin_id) REFERENCES chat_skins(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('user_chat_skins表创建成功');

    console.log('检查users表是否有avatar_frame字段...');
    const [userCols] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_frame'
    `);
    if (userCols.length === 0) {
      console.log('添加avatar_frame字段到users表...');
      await connection.execute(`
        ALTER TABLE users ADD COLUMN avatar_frame VARCHAR(50) DEFAULT NULL COMMENT '当前使用的头像框ID' AFTER avatar
      `);
      console.log('avatar_frame字段添加成功');
    } else {
      console.log('avatar_frame字段已存在，跳过');
    }

    console.log('检查users表是否有chat_skin字段...');
    const [userCols2] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'chat_skin'
    `);
    if (userCols2.length === 0) {
      console.log('添加chat_skin字段到users表...');
      await connection.execute(`
        ALTER TABLE users ADD COLUMN chat_skin VARCHAR(50) DEFAULT NULL COMMENT '当前使用的聊天皮肤ID' AFTER avatar_frame
      `);
      console.log('chat_skin字段添加成功');
    } else {
      console.log('chat_skin字段已存在，跳过');
    }

    console.log('插入/更新头像框数据...');
    for (const frame of AVATAR_FRAMES) {
      const [existing] = await connection.execute(
        'SELECT id FROM avatar_frames WHERE id = ?',
        [frame.id]
      );
      if (existing.length > 0) {
        await connection.execute(`
          UPDATE avatar_frames SET 
            name = ?, description = ?, border_color = ?, 
            gradient_from = ?, gradient_to = ?, shadow_color = ?, 
            rarity = ?, icon = ?, is_active = 1
          WHERE id = ?
        `, [
          frame.name, frame.description, frame.border_color,
          frame.gradient_from, frame.gradient_to, frame.shadow_color,
          frame.rarity, frame.icon, frame.id
        ]);
        console.log(`更新头像框: ${frame.name}`);
      } else {
        await connection.execute(`
          INSERT INTO avatar_frames (id, name, description, border_color, gradient_from, gradient_to, shadow_color, rarity, icon, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          frame.id, frame.name, frame.description, frame.border_color,
          frame.gradient_from, frame.gradient_to, frame.shadow_color,
          frame.rarity, frame.icon
        ]);
        console.log(`插入头像框: ${frame.name}`);
      }
    }

    console.log('插入/更新聊天皮肤数据...');
    for (const skin of CHAT_SKINS) {
      const [existing] = await connection.execute(
        'SELECT id FROM chat_skins WHERE id = ?',
        [skin.id]
      );
      if (existing.length > 0) {
        await connection.execute(`
          UPDATE chat_skins SET 
            name = ?, description = ?, bg_color = ?, 
            bubble_bg_other = ?, bubble_bg_mine = ?, 
            text_color_mine = ?, text_color_other = ?, 
            border_color = ?, rarity = ?, icon = ?, is_active = 1
          WHERE id = ?
        `, [
          skin.name, skin.description, skin.bg_color,
          skin.bubble_bg_other, skin.bubble_bg_mine,
          skin.text_color_mine, skin.text_color_other,
          skin.border_color, skin.rarity, skin.icon, skin.id
        ]);
        console.log(`更新聊天皮肤: ${skin.name}`);
      } else {
        await connection.execute(`
          INSERT INTO chat_skins (id, name, description, bg_color, bubble_bg_other, bubble_bg_mine, text_color_mine, text_color_other, border_color, rarity, icon, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          skin.id, skin.name, skin.description, skin.bg_color,
          skin.bubble_bg_other, skin.bubble_bg_mine,
          skin.text_color_mine, skin.text_color_other,
          skin.border_color, skin.rarity, skin.icon
        ]);
        console.log(`插入聊天皮肤: ${skin.name}`);
      }
    }

    console.log('清理不在列表中的旧记录...');
    const validFrameIds = AVATAR_FRAMES.map(s => s.id);
    const framePlaceholders = validFrameIds.map(() => '?').join(',');
    const [deleteFrames] = await connection.execute(
      `DELETE FROM avatar_frames WHERE id NOT IN (${framePlaceholders})`,
      validFrameIds
    );
    if (deleteFrames.affectedRows > 0) {
      console.log(`已清理 ${deleteFrames.affectedRows} 条旧头像框记录`);
    }

    const validSkinIds = CHAT_SKINS.map(s => s.id);
    const skinPlaceholders = validSkinIds.map(() => '?').join(',');
    const [deleteSkins] = await connection.execute(
      `DELETE FROM chat_skins WHERE id NOT IN (${skinPlaceholders})`,
      validSkinIds
    );
    if (deleteSkins.affectedRows > 0) {
      console.log(`已清理 ${deleteSkins.affectedRows} 条旧聊天皮肤记录`);
    }

    await connection.commit();
    console.log('\n✅ 头像框和聊天框皮肤数据库迁移完成！');
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('❌ 头像框和聊天框皮肤数据库迁移失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  migrateAvatarAndChatSkins,
  AVATAR_FRAMES,
  CHAT_SKINS,
  PRICE
};

if (require.main === module) {
  migrateAvatarAndChatSkins()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
