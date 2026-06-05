const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { router: userRoutes, authenticateToken } = require('./routes/user');
const bottleRoutes = require('./routes/bottle');
const messageRoutes = require('./routes/message');

const app = express();
const PORT = process.env.PORT || 4022;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/user', userRoutes);
app.use('/api/bottle', authenticateToken, bottleRoutes);
app.use('/api/message', authenticateToken, messageRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '漂流瓶服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 漂流瓶后端服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📡 API前缀: http://localhost:${PORT}/api`);
});
