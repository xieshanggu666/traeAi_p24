const pool = require('../config/db');

async function addCoins() {
  try {
    const usernames = ['xie', 'qqq'];
    for (const username of usernames) {
      const [users] = await pool.execute(
        'SELECT id, username, coins FROM users WHERE username = ?',
        [username]
      );
      if (users.length === 0) {
        console.log(`❌ 用户 ${username} 不存在`);
        continue;
      }
      const user = users[0];
      const oldCoins = user.coins || 0;
      const newCoins = oldCoins + 9999;
      await pool.execute(
        'UPDATE users SET coins = ? WHERE id = ?',
        [newCoins, user.id]
      );
      console.log(`✅ 用户 ${username} (${user.id}): ${oldCoins} -> ${newCoins} (增加了9999漂流币)`);
    }
    console.log('\n🎉 漂流币添加完成！');
    process.exit(0);
  } catch (error) {
    console.error('添加漂流币失败:', error);
    process.exit(1);
  }
}

addCoins();
