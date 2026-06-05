# 🌊 漂流瓶项目

一个基于 Vue3 + Vant + Node.js + MySQL 的匿名社交漂流瓶应用。

## 📋 功能特性

- **扔瓶子**：用户可以输入一段话放入瓶子中扔到海里
- **捞瓶子**：随机捞取海里的漂流瓶
- **回复瓶子**：回复捞到的瓶子，开启匿名私聊
- **扔回海里**：不感兴趣的瓶子可以扔回海里
- **匿名私聊**：双方可以进行匿名聊天
- **我的瓶子**：查看收到的回复和发起的对话

## 🛠️ 技术栈

### 前端
- Vue 3 + Composition API
- Vant 4 (移动端UI组件库)
- Vue Router 4 (路由)
- Axios (HTTP请求)
- Vite (构建工具)

### 后端
- Node.js + Express
- MySQL2 (数据库连接)
- CORS (跨域处理)
- UUID (唯一标识生成)

## 📁 项目结构

```
24漂流瓶/
├── client/                 # 前端项目
│   ├── public/            # 静态资源
│   ├── src/
│   │   ├── api/           # API接口
│   │   ├── assets/        # 样式资源
│   │   ├── router/        # 路由配置
│   │   ├── utils/         # 工具函数
│   │   ├── views/         # 页面组件
│   │   ├── App.vue        # 根组件
│   │   └── main.js        # 入口文件
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                # 后端项目
│   ├── config/           # 配置文件
│   │   ├── db.js         # 数据库连接
│   │   └── initDB.js     # 数据库初始化
│   ├── routes/           # 路由
│   │   ├── user.js       # 用户接口
│   │   ├── bottle.js     # 漂流瓶接口
│   │   └── message.js    # 消息接口
│   ├── utils/            # 工具函数
│   │   └── helper.js
│   ├── app.js            # 入口文件
│   ├── .env              # 环境变量
│   └── package.json
└── package.json          # 根目录配置
```

## 🚀 快速开始

### 前置要求
- Node.js >= 14.0.0
- MySQL >= 5.7
- MySQL账号：root / zhongxin123 (可在 server/.env 中修改)

### 1. 安装依赖

```bash
# 安装所有依赖
npm run install:all

# 或者分别安装
cd server && npm install
cd ../client && npm install
```

### 2. 初始化数据库

确保MySQL服务已启动，然后执行：

```bash
cd server
npm run init-db
```

这会自动创建 `drift_bottle` 数据库和所需的表。

### 3. 启动后端服务

```bash
cd server
npm run dev
```

后端服务将在 http://localhost:4022 启动

### 4. 启动前端服务

```bash
cd client
npm run dev
```

前端服务将在 http://localhost:5173 启动

## 📡 API 接口

### 用户接口
- `POST /api/user/create` - 创建匿名用户
- `GET /api/user/:userId` - 获取用户信息

### 漂流瓶接口
- `POST /api/bottle/throw` - 扔瓶子
- `POST /api/bottle/pick` - 捞瓶子
- `POST /api/bottle/return` - 扔回海里
- `POST /api/bottle/reply` - 回复瓶子
- `GET /api/bottle/my/:userId` - 获取我的瓶子

### 消息接口
- `GET /api/message/:bottleId/:userId` - 获取聊天消息
- `POST /api/message/send` - 发送消息
- `GET /api/message/unread/:userId` - 获取未读消息数

## 📱 页面说明

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `/` | 展示用户信息，扔瓶子/捞瓶子入口 |
| 扔瓶子 | `/throw` | 输入内容并扔出瓶子 |
| 捞瓶子 | `/pick` | 随机捞取瓶子，可回复或扔回 |
| 聊天 | `/chat/:bottleId` | 与对方进行匿名聊天 |
| 我的瓶子 | `/my` | 查看收到的回复和发起的对话 |

## 🔧 配置说明

### 后端配置 (server/.env)
```env
PORT=4022                    # 服务端口
DB_HOST=localhost            # 数据库地址
DB_USER=root                 # 数据库用户名
DB_PASSWORD=zhongxin123      # 数据库密码
DB_NAME=drift_bottle         # 数据库名
```

### 前端代理配置 (client/vite.config.js)
前端通过代理将 `/api` 请求转发到后端 `http://localhost:4022`

## 📝 数据库表结构

### users 表
- id: 用户UUID (主键)
- nickname: 匿名昵称
- avatar: 头像(emoji)
- created_at: 创建时间
- last_active_at: 最后活跃时间

### bottles 表
- id: 瓶子ID (主键)
- sender_id: 发送者ID (外键)
- content: 瓶子内容
- status: 状态 (floating/picked/replied)
- picker_id: 捡起者ID (外键)
- picked_at: 捡起时间
- created_at: 创建时间

### messages 表
- id: 消息ID (主键)
- bottle_id: 关联瓶子ID (外键)
- sender_id: 发送者ID (外键)
- receiver_id: 接收者ID (外键)
- content: 消息内容
- is_read: 是否已读
- created_at: 发送时间

## 🎨 特色功能

1. **无需注册**：自动生成匿名用户，保护隐私
2. **随机匹配**：捞取随机瓶子，增加趣味性
3. **实时聊天**：支持实时消息拉取
4. **未读提醒**：首页显示未读消息数
5. **海洋主题**：精美的海洋风格UI设计
6. **动画效果**：丰富的交互动画提升体验

## 📄 License

MIT License
