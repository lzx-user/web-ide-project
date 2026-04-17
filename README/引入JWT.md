在代码中引入 JWT (JSON Web Token) 通常分为两个核心步骤：**生成 Token（登录签发）** 和 **验证 Token（接口鉴权）**。

**JWT 官方简介 (Introduction)**：https://jwt.io/introduction

### 第一步：安装 JWT 依赖库

在项目目录中安装处理 JWT 的库：

```
npm install jsonwebtoken
```

### 第二步：生成 JWT（用户登录时）

当用户提交了正确的用户名和密码后，服务端需要生成一个 JWT 并返回给客户端。

```jsx
const jwt = require('jsonwebtoken');

// 1. 准备 Payload（载荷）：存放非敏感的用户信息
const payload = {
  userId: 123,
  username: 'gemini_user',
  role: 'admin'
};

// 2. 设置密钥（Secret）：必须保存在服务端的环境变量中，打死也不能泄露
const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key_here';

// 3. 签发 Token
const token = jwt.sign(payload, SECRET_KEY, { 
  expiresIn: '2h' // 设置过期时间，例如 2 小时
});

console.log('生成的 JWT:', token);
// 将 token 返回给前端（前端通常会存放在 localStorage 或 Cookie 中）
```

### 第三步：验证 JWT（用户访问受保护接口时）

客户端在请求受保护的数据时，需要将 JWT 放在 HTTP 请求头的 `Authorization` 字段中（通常格式为 `Bearer <token>`）。服务端需要拦截并验证它。

简洁的 JSON Web Tokens 由三个部分组成，中间用点 ( `.`) 分隔，分别是：

- 标题
- 有效载荷
- 签名

因此，JWT 通常如下所示：

```
xxxxx.yyyyy.zzzzz
```

```jsx
const jwt = require('jsonwebtoken');

// 这是一个验证中间件示例（例如在 Express 框架中）
function verifyToken(req, res, next) {
  // 1. 从请求头获取 Token
  const authHeader = req.headers['authorization'];
  
  // 通常格式是 "Bearer xxxxx.yyyyy.zzzzz"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '未提供 Token，请先登录' });
  }

  // 2. 验证 Token
  const SECRET_KEY = process.env.JWT_SECRET || 'your_super_secret_key_here';
  
  jwt.verify(token, SECRET_KEY, (err, decodedUser) => {
    if (err) {
      // 可能是 Token 过期或被篡改
      return res.status(403).json({ message: 'Token 无效或已过期' });
    }

    // 3. 验证通过，将解码后的用户信息挂载到请求对象上，供后续业务使用
    req.user = decodedUser;
    next(); 
  });
}

// 使用该中间件保护接口
// app.get('/api/protected-data', verifyToken, (req, res) => { ... });
```

------

### 💡 引入 JWT 的三大安全守则

1. **绝不存放敏感信息**：JWT 的 Payload 是通过 Base64 编码的，任何人拿到 Token 都可以解码看到里面的内容。**不要**把密码、银行卡号等信息放进去。
2. **保管好 Secret Key**：签名用的 `SECRET_KEY` 只能存放在服务器的系统环境变量中，千万不要硬编码在代码里传到 GitHub 上。
3. **设置合理的过期时间**：JWT 一旦签发，在过期前默认是无法撤销的。建议设置较短的过期时间（如 15 分钟 - 2 小时），并配合 Refresh Token 机制来刷新登录状态。





###  有了 Token 后：一卡通行

- **第一步（登录）**：你刚到酒店时，只需在前台出示**一次**身份证（**提交用户名和密码**）。
- **第二步（签发 Token）**：前台系统验证你的身份通过后，给你发了一张房卡（**服务端生成并返回 Token**）。
- **第三步（使用 Token）**：接下来，你去坐电梯、开房门、吃早餐，再也不用掏身份证了，只需要“滴”一下房卡（**在 HTTP 请求头中带上 Token**）。
- **第四步（验证 Token）**：电梯和门锁不认识你这个人，它们**只认卡不认人**。只要卡是真的，并且在有效期内，门就会开（**服务端验证 Token 放行**）。