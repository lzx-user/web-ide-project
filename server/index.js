// server/index.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 使用中间件
app.use(cors()); // 允许跨域请求
app.use(express.json()); // 解析 JSON 格式的请求体

// 编写一个简单的测试接口，满足“接口返回数据”的交付标准
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Web IDE 后端服务已成功连接！'
  });
});

// 启动服务
app.listen(PORT, () => {
  // 满足“终端打印服务启动成功”的交付标准
  console.log(`🚀 服务已启动成功，正在监听端口: ${PORT}`);
  console.log(`👉 测试接口请访问: http://localhost:${PORT}/api/health`);
});