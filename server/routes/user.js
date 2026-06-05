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

module.exports = { router, authenticateToken };
