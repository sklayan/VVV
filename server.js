const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 中间件
app.use(cors());
app.use(express.json());

// MongoDB连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/novel-app';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB连接成功'))
  .catch(err => console.error('❌ MongoDB连接失败:', err));

// 用户模型
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// 认证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '访问令牌不存在' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '令牌无效' });
    }
    req.user = user;
    next();
  });
};

// API配置
const API_KEY = process.env.API_KEY || 'a14b5cdff147b1262882db2ca29355bd';
const BASE_URL = 'https://api.xcvts.cn/api/xiaoshuo/axdzs';

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => data += chunk);
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error('解析JSON失败: ' + error.message));
        }
      });
    }).on('error', reject);
  });
}

// 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '请填写所有字段' });
    }

    // 检查用户是否已存在
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    // 生成JWT令牌
    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET);

    res.status(201).json({
      message: '注册成功',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '请填写邮箱和密码' });
    }

    // 查找用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: '用户不存在' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: '密码错误' });
    }

    // 生成JWT令牌
    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET);

    res.json({
      message: '登录成功',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取用户信息
app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 搜索路由（需要登录）
app.get('/api/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return res.status(400).json({ error: '缺少查询参数 q' });
    }
    
    const apiUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(query)}`;
    const data = await makeRequest(apiUrl);
    
    res.json(data);
  } catch (error) {
    console.error('搜索错误:', error);
    res.status(500).json({ error: '搜索失败: ' + error.message });
  }
});

// 下载路由（需要登录）
app.get('/api/download', authenticateToken, async (req, res) => {
  try {
    const { q, n } = req.query;
    
    if (!q || !n) {
      return res.status(400).json({ error: '缺少必要的查询参数' });
    }
    
    const downloadUrl = `${BASE_URL}?apiKey=${API_KEY}&q=${encodeURIComponent(q)}&n=${n}`;
    res.redirect(downloadUrl);
  } catch (error) {
    console.error('下载错误:', error);
    res.status(500).json({ error: '下载失败: ' + error.message });
  }
});

// 静态文件服务
app.use(express.static('.'));

// 根路径
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 服务器启动
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`🔐 用户认证系统已启用`);
  });
}

module.exports = app;