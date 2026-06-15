const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');
const { generateUUID, generateNickname, generateAvatar, generateResponse } = require('../utils/helper');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads', 'avatars'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.userId}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG、PNG、GIF、WebP 格式的图片'));
    }
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'drift_bottle_secret';

async function isBlockedBy(userId, targetUserId) {
  const [rows] = await pool.execute(
    'SELECT id FROM blacklists WHERE user_id = ? AND blocked_user_id = ?',
    [targetUserId, userId]
  );
  return rows.length > 0;
}

async function hasBlocked(userId, targetUserId) {
  const [rows] = await pool.execute(
    'SELECT id FROM blacklists WHERE user_id = ? AND blocked_user_id = ?',
    [userId, targetUserId]
  );
  return rows.length > 0;
}

async function isFriend(userId, targetUserId) {
  const [rows] = await pool.execute(
    'SELECT id FROM friends WHERE user_id = ? AND friend_id = ?',
    [userId, targetUserId]
  );
  return rows.length > 0;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json(generateResponse(false, null, '未提供认证令牌'));
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json(generateResponse(false, null, '无效的认证令牌'));
    }
    req.user = user;
    next();
  });
}

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json(generateResponse(false, null, '用户名和密码不能为空'));
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json(generateResponse(false, null, '用户名长度应在3-20个字符之间'));
    }

    if (password.length < 6) {
      return res.status(400).json(generateResponse(false, null, '密码长度不能少于6位'));
    }

    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json(generateResponse(false, null, '用户名已存在'));
    }

    const userId = generateUUID();
    const nickname = generateNickname();
    const avatar = generateAvatar();
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      'INSERT INTO users (id, username, password, nickname, avatar) VALUES (?, ?, ?, ?, ?)',
      [userId, username, hashedPassword, nickname, avatar]
    );

    const token = jwt.sign(
      { userId, username, nickname, avatar },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json(generateResponse(true, {
      token,
      user: {
        id: userId,
        username,
        nickname,
        avatar
      }
    }, '注册成功'));
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json(generateResponse(false, null, '注册失败'));
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json(generateResponse(false, null, '用户名和密码不能为空'));
    }

    const [users] = await pool.execute(
      'SELECT id, username, password, nickname, avatar FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(400).json(generateResponse(false, null, '用户名或密码错误'));
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json(generateResponse(false, null, '用户名或密码错误'));
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, nickname: user.nickname, avatar: user.avatar },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await pool.execute(
      'UPDATE users SET last_active_at = NOW() WHERE id = ?',
      [user.id]
    );

    res.json(generateResponse(true, {
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar
      }
    }, '登录成功'));
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json(generateResponse(false, null, '登录失败'));
  }
});

router.get('/info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [users] = await pool.execute(
      'SELECT id, username, nickname, avatar, gender, birthday, bio, created_at, last_active_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    res.json(generateResponse(true, users[0], '获取用户信息成功'));
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json(generateResponse(false, null, '获取用户信息失败'));
  }
});

router.post('/upload-avatar', authenticateToken, (req, res) => {
  upload.single('avatar')(req, res, async function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json(generateResponse(false, null, '图片大小不能超过2MB'));
      }
      return res.status(400).json(generateResponse(false, null, err.message || '上传失败'));
    }

    if (!req.file) {
      return res.status(400).json(generateResponse(false, null, '请选择图片'));
    }

    try {
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      await pool.execute(
        'UPDATE users SET avatar = ? WHERE id = ?',
        [avatarUrl, req.user.userId]
      );

      const [users] = await pool.execute(
        'SELECT id, username, nickname, avatar, gender, birthday, bio, created_at, last_active_at FROM users WHERE id = ?',
        [req.user.userId]
      );

      res.json(generateResponse(true, users[0], '头像上传成功'));
    } catch (error) {
      console.error('头像上传失败:', error);
      res.status(500).json(generateResponse(false, null, '头像上传失败'));
    }
  });
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { nickname, avatar, gender, birthday, bio } = req.body;

    const updates = [];
    const values = [];

    if (nickname !== undefined) {
      if (nickname.length < 1 || nickname.length > 50) {
        return res.status(400).json(generateResponse(false, null, '昵称长度应在1-50个字符之间'));
      }
      updates.push('nickname = ?');
      values.push(nickname);
    }

    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }

    if (gender !== undefined) {
      const validGenders = ['男', '女', '保密'];
      if (gender && !validGenders.includes(gender)) {
        return res.status(400).json(generateResponse(false, null, '性别值无效'));
      }
      updates.push('gender = ?');
      values.push(gender || null);
    }

    if (birthday !== undefined) {
      updates.push('birthday = ?');
      values.push(birthday || null);
    }

    if (bio !== undefined) {
      if (bio && bio.length > 200) {
        return res.status(400).json(generateResponse(false, null, '个人介绍不能超过200个字符'));
      }
      updates.push('bio = ?');
      values.push(bio || null);
    }

    if (updates.length === 0) {
      return res.status(400).json(generateResponse(false, null, '没有需要更新的字段'));
    }

    values.push(userId);

    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [users] = await pool.execute(
      'SELECT id, username, nickname, avatar, gender, birthday, bio, created_at, last_active_at FROM users WHERE id = ?',
      [userId]
    );

    res.json(generateResponse(true, users[0], '更新成功'));
  } catch (error) {
    console.error('更新个人信息失败:', error);
    res.status(500).json(generateResponse(false, null, '更新个人信息失败'));
  }
});

router.post('/logout', authenticateToken, (req, res) => {
  res.json(generateResponse(true, null, '退出登录成功'));
});

router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { keyword } = req.query;
    const userId = req.user.userId;

    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json(generateResponse(false, null, '搜索关键词不能为空'));
    }

    const trimmedKeyword = keyword.trim();
    const [users] = await pool.execute(
      `SELECT id, username, nickname, avatar, gender, birthday, bio, created_at 
       FROM users 
       WHERE (username LIKE ? OR nickname LIKE ? OR id = ?) AND id != ?
       LIMIT 20`,
      [`%${trimmedKeyword}%`, `%${trimmedKeyword}%`, trimmedKeyword, userId]
    );

    res.json(generateResponse(true, users, '搜索成功'));
  } catch (error) {
    console.error('搜索用户失败:', error);
    res.status(500).json(generateResponse(false, null, '搜索用户失败'));
  }
});

router.get('/profile/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    const [users] = await pool.execute(
      `SELECT id, username, nickname, avatar, gender, birthday, bio, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    const user = users[0];

    const [friendRows] = await pool.execute(
      'SELECT * FROM friends WHERE user_id = ? AND friend_id = ?',
      [currentUserId, userId]
    );
    user.isFriend = friendRows.length > 0;

    const [requestRows] = await pool.execute(
      "SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'",
      [currentUserId, userId]
    );
    user.hasPendingRequest = requestRows.length > 0;

    const [receivedRequestRows] = await pool.execute(
      "SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'",
      [userId, currentUserId]
    );
    user.hasReceivedRequest = receivedRequestRows.length > 0;

    const iBlocked = await hasBlocked(currentUserId, userId);
    const blockedMe = await isBlockedBy(currentUserId, userId);
    user.iBlocked = iBlocked;
    user.blockedMe = blockedMe;

    res.json(generateResponse(true, user, '获取用户信息成功'));
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json(generateResponse(false, null, '获取用户信息失败'));
  }
});

router.post('/friend/request', authenticateToken, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.userId;

    if (!receiverId) {
      return res.status(400).json(generateResponse(false, null, '接收者ID不能为空'));
    }

    if (receiverId === senderId) {
      return res.status(400).json(generateResponse(false, null, '不能添加自己为好友'));
    }

    const [receivers] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [receiverId]
    );

    if (receivers.length === 0) {
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    const [existingFriends] = await pool.execute(
      'SELECT * FROM friends WHERE user_id = ? AND friend_id = ?',
      [senderId, receiverId]
    );

    if (existingFriends.length > 0) {
      return res.status(400).json(generateResponse(false, null, '对方已经是你的好友了'));
    }

    const [existingRequests] = await pool.execute(
      "SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'",
      [senderId, receiverId]
    );

    if (existingRequests.length > 0) {
      return res.status(400).json(generateResponse(false, null, '已发送过好友申请，等待对方处理'));
    }

    const [reverseRequests] = await pool.execute(
      "SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'",
      [receiverId, senderId]
    );

    if (reverseRequests.length > 0) {
      const requestId = reverseRequests[0].id;
      await acceptFriendRequestHelper(senderId, receiverId, requestId);
      return res.json(generateResponse(true, null, '对方也申请添加你为好友，已自动成为好友'));
    }

    await pool.execute(
      'DELETE FROM friend_requests WHERE sender_id = ? AND receiver_id = ?',
      [senderId, receiverId]
    );

    const requestId = generateUUID();
    await pool.execute(
      'INSERT INTO friend_requests (id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)',
      [requestId, senderId, receiverId, message || null]
    );

    res.json(generateResponse(true, null, '好友申请已发送'));
  } catch (error) {
    console.error('发送好友申请失败:', error);
    res.status(500).json(generateResponse(false, null, '发送好友申请失败'));
  }
});

async function acceptFriendRequestHelper(userId, friendId, requestId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      "UPDATE friend_requests SET status = 'accepted' WHERE id = ?",
      [requestId]
    );

    await conn.execute(
      'INSERT IGNORE INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)',
      [generateUUID(), userId, friendId]
    );

    await conn.execute(
      'INSERT IGNORE INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)',
      [generateUUID(), friendId, userId]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

router.post('/friend/accept/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;

    const [requests] = await pool.execute(
      "SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'pending'",
      [requestId, userId]
    );

    if (requests.length === 0) {
      return res.status(404).json(generateResponse(false, null, '好友申请不存在或已处理'));
    }

    const request = requests[0];
    await acceptFriendRequestHelper(userId, request.sender_id, requestId);

    res.json(generateResponse(true, null, '已接受好友申请'));
  } catch (error) {
    console.error('接受好友申请失败:', error);
    res.status(500).json(generateResponse(false, null, '接受好友申请失败'));
  }
});

router.post('/friend/reject/:requestId', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;

    const [requests] = await pool.execute(
      "SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'pending'",
      [requestId, userId]
    );

    if (requests.length === 0) {
      return res.status(404).json(generateResponse(false, null, '好友申请不存在或已处理'));
    }

    await pool.execute(
      "UPDATE friend_requests SET status = 'rejected' WHERE id = ?",
      [requestId]
    );

    res.json(generateResponse(true, null, '已拒绝好友申请'));
  } catch (error) {
    console.error('拒绝好友申请失败:', error);
    res.status(500).json(generateResponse(false, null, '拒绝好友申请失败'));
  }
});

router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [friends] = await pool.execute(
      `SELECT f.id as friendship_id, f.created_at as added_at,
              u.id, u.username, u.nickname, u.avatar, u.gender, u.birthday, u.bio, u.last_active_at
       FROM friends f
       INNER JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json(generateResponse(true, friends, '获取好友列表成功'));
  } catch (error) {
    console.error('获取好友列表失败:', error);
    res.status(500).json(generateResponse(false, null, '获取好友列表失败'));
  }
});

router.get('/friend/requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [receivedRequests] = await pool.execute(
      `SELECT fr.id, fr.sender_id, fr.message, fr.created_at, fr.status,
              u.nickname, u.avatar, u.username
       FROM friend_requests fr
       INNER JOIN users u ON fr.sender_id = u.id
       WHERE fr.receiver_id = ?
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    const [sentRequests] = await pool.execute(
      `SELECT fr.id, fr.receiver_id, fr.message, fr.created_at, fr.status,
              u.nickname, u.avatar, u.username
       FROM friend_requests fr
       INNER JOIN users u ON fr.receiver_id = u.id
       WHERE fr.sender_id = ?
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    res.json(generateResponse(true, {
      received: receivedRequests,
      sent: sentRequests
    }, '获取好友申请列表成功'));
  } catch (error) {
    console.error('获取好友申请列表失败:', error);
    res.status(500).json(generateResponse(false, null, '获取好友申请列表失败'));
  }
});

router.delete('/friend/:friendId', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user.userId;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        'DELETE FROM friends WHERE user_id = ? AND friend_id = ?',
        [userId, friendId]
      );

      await conn.execute(
        'DELETE FROM friends WHERE user_id = ? AND friend_id = ?',
        [friendId, userId]
      );

      await conn.execute(
        'DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
        [userId, friendId, friendId, userId]
      );

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    res.json(generateResponse(true, null, '已删除好友'));
  } catch (error) {
    console.error('删除好友失败:', error);
    res.status(500).json(generateResponse(false, null, '删除好友失败'));
  }
});

router.post('/blacklist/:blockedUserId', authenticateToken, async (req, res) => {
  try {
    const { blockedUserId } = req.params;
    const userId = req.user.userId;

    if (!blockedUserId) {
      return res.status(400).json(generateResponse(false, null, '被拉黑用户ID不能为空'));
    }

    if (blockedUserId === userId) {
      return res.status(400).json(generateResponse(false, null, '不能拉黑自己'));
    }

    const [users] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [blockedUserId]
    );

    if (users.length === 0) {
      return res.status(404).json(generateResponse(false, null, '用户不存在'));
    }

    const id = generateUUID();
    await pool.execute(
      'INSERT IGNORE INTO blacklists (id, user_id, blocked_user_id) VALUES (?, ?, ?)',
      [id, userId, blockedUserId]
    );

    res.json(generateResponse(true, null, '拉黑成功'));
  } catch (error) {
    console.error('拉黑用户失败:', error);
    res.status(500).json(generateResponse(false, null, '拉黑失败'));
  }
});

router.delete('/blacklist/:blockedUserId', authenticateToken, async (req, res) => {
  try {
    const { blockedUserId } = req.params;
    const userId = req.user.userId;

    if (!blockedUserId) {
      return res.status(400).json(generateResponse(false, null, '用户ID不能为空'));
    }

    await pool.execute(
      'DELETE FROM blacklists WHERE user_id = ? AND blocked_user_id = ?',
      [userId, blockedUserId]
    );

    res.json(generateResponse(true, null, '已解除拉黑'));
  } catch (error) {
    console.error('解除拉黑失败:', error);
    res.status(500).json(generateResponse(false, null, '解除拉黑失败'));
  }
});

router.get('/blacklist', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [blacklist] = await pool.execute(
      `SELECT b.id as record_id, b.created_at as blocked_at,
              u.id, u.username, u.nickname, u.avatar, u.gender, u.birthday, u.bio, u.last_active_at
       FROM blacklists b
       INNER JOIN users u ON b.blocked_user_id = u.id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [userId]
    );

    res.json(generateResponse(true, blacklist, '获取黑名单成功'));
  } catch (error) {
    console.error('获取黑名单失败:', error);
    res.status(500).json(generateResponse(false, null, '获取黑名单失败'));
  }
});

router.get('/blacklist/check/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.user.userId;

    const iBlocked = await hasBlocked(userId, otherUserId);
    const blockedMe = await isBlockedBy(userId, otherUserId);

    res.json(generateResponse(true, {
      iBlocked,
      blockedMe
    }, '获取成功'));
  } catch (error) {
    console.error('检查拉黑状态失败:', error);
    res.status(500).json(generateResponse(false, null, '检查失败'));
  }
});

module.exports = { router, authenticateToken, isBlockedBy, hasBlocked, isFriend };
