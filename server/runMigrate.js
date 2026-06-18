const { migrateAvatarAndChatSkins } = require('./config/migrateAvatarAndChatSkins');

migrateAvatarAndChatSkins()
  .then(() => {
    console.log('迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  });
