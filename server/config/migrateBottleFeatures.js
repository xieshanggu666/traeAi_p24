const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function migrateDatabase() {
  const pool = require('./db');

  try {
    console.log('开始迁移数据库 - 漂流瓶新功能...');

    console.log('检查并添加tag字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN tag VARCHAR(20) DEFAULT NULL COMMENT '瓶子标签:情绪倾诉,交友,求助,树洞,闲聊,考研搭子,游戏组队' AFTER content
      `);
      console.log('tag字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('tag字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加image_url字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN image_url VARCHAR(255) DEFAULT NULL COMMENT '瓶子图片地址' AFTER tag
      `);
      console.log('image_url字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('image_url字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加target_gender字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN target_gender VARCHAR(10) DEFAULT NULL COMMENT '目标性别:male,female,all' AFTER image_url
      `);
      console.log('target_gender字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('target_gender字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加target_min_age字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN target_min_age INT DEFAULT NULL COMMENT '目标最小年龄' AFTER target_gender
      `);
      console.log('target_min_age字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('target_min_age字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加target_max_age字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN target_max_age INT DEFAULT NULL COMMENT '目标最大年龄' AFTER target_min_age
      `);
      console.log('target_max_age字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('target_max_age字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并创建瓶子图片上传目录...');
    const bottleUploadsDir = path.join(__dirname, '..', 'uploads', 'bottles');
    if (!fs.existsSync(bottleUploadsDir)) {
      fs.mkdirSync(bottleUploadsDir, { recursive: true });
      console.log('瓶子图片上传目录创建成功');
    } else {
      console.log('瓶子图片上传目录已存在');
    }

    console.log('\n数据库迁移完成 - 漂流瓶新功能！');
    process.exit(0);
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  }
}

migrateDatabase();
