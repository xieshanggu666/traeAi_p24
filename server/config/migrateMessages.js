const pool = require('./db');

async function migrateMessages() {
  try {
    console.log('开始消息表数据库迁移...');

    console.log('检查并添加messages.type字段...');
    try {
      await pool.execute(`
        ALTER TABLE messages 
        ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'text' COMMENT '消息类型:text-文本,gift-礼物' AFTER content
      `);
      console.log('messages.type字段添加成功');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('messages.type字段已存在，跳过');
      } else {
        throw error;
      }
    }

    console.log('\n消息表数据库迁移完成！');
    process.exit(0);
  } catch (error) {
    console.error('消息表数据库迁移失败:', error);
    process.exit(1);
  }
}

migrateMessages();
