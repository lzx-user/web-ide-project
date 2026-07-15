import 'dotenv/config';

const currentEnv = process.env.NODE_ENV ?? 'development';
const isProd = currentEnv === 'production';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('缺少 JWT_SECRET，请在 backend/.env 中配置');
}
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET 长度至少需要 32 位');
}

function parseCorsOrigin(originText: string): string[] {
  return originText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
if (isProd && (!process.env.CORS_ORIGIN || corsOrigin === '*')) {
  throw new Error('生产环境必须配置具体的 CORS_ORIGIN，不能使用 *');
}

// 所有环境变量集中在这里转换类型，业务代码不再直接解析字符串。
const config = {
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES ?? '24h',
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? 'localhost',
  },
  cors: {
    origin: parseCorsOrigin(corsOrigin),
  },
  env: {
    isProd,
    current: currentEnv,
  },
} as const;

export default config;
