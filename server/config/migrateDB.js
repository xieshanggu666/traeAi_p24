const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateDatabase() {
  const pool = require('./db');

  try {
    console.log('开始迁移数据库...');

    console.log('检查并添加用户名字段...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名' AFTER id
      `);
      console.log('用户名字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('用户名字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加密码字段...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN password VARCHAR(255) NOT NULL COMMENT '密码(加密)' AFTER username
      `);
      console.log('密码字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('密码字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加picker_deleted_at字段...');
    try {
      await pool.execute(`
        ALTER TABLE bottles 
        ADD COLUMN picker_deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '捡起者删除时间' AFTER picked_at
      `);
      console.log('picker_deleted_at字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('picker_deleted_at字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加gender字段...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN gender VARCHAR(10) DEFAULT NULL COMMENT '性别' AFTER avatar
      `);
      console.log('gender字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('gender字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加birthday字段...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN birthday DATE DEFAULT NULL COMMENT '出生年月' AFTER gender
      `);
      console.log('birthday字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('birthday字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('检查并添加bio字段...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN bio VARCHAR(200) DEFAULT NULL COMMENT '个人介绍' AFTER birthday
      `);
      console.log('bio字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('bio字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('\n数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('数据库迁移失败:', error);
    process.exit(1);
  }
}

migrateDatabase();
