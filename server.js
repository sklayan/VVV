const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 临时禁用认证
const authenticateToken = (req, res, next) => {
  next(); // 直接通过，不检查token
};

// API配置
const API_KEY = 'a14b5cdff147b1262882db2ca29355bd';
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

// 搜索路由（暂时不需要认证）
app.get('/api/search', async (req, res) => {
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

// 提供静态文件
app.use(express.static('.'));

// 根路径
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 导出app给Vercel使用
module.exports = app;
