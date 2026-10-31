require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`[config] Missing required environment variable ${k}. Copy .env.example to .env.`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32 && process.env.NODE_ENV === 'production') {
  console.error('[config] JWT_SECRET must be at least 32 characters in production.');
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  aiServiceToken: process.env.AI_SERVICE_TOKEN || '',
};
