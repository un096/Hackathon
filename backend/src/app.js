require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { frontendUrl, nodeEnv } = require('./config/env');
const { authenticate, authorize } = require('./middleware/auth');
const errorHandler = require('./middleware/error');
const prisma = require('./lib/prisma');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: frontendUrl.split(',').map((s) => s.trim()), credentials: false }));
app.use(express.json({ limit: '1mb' }));
if (nodeEnv !== 'test') app.use(morgan('dev'));

app.get('/api/health', async (_req, res) => {
  let db = 'up';
  try { await prisma.$queryRaw`SELECT 1`; } catch { db = 'down'; }
  res.json({ status: 'ok', db, time: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/skills', authenticate, require('./routes/skills'));
app.use('/api/me', authenticate, require('./routes/me'));
app.use('/api/assessments', authenticate, require('./routes/assessments'));
app.use('/api/employees', authenticate, require('./routes/employees'));
app.use('/api/projects', authenticate, require('./routes/projects'));
app.use('/api/approvals', authenticate, require('./routes/approvals'));
app.use('/api/market', authenticate, require('./routes/market'));
app.use('/api/admin', authenticate, require('./routes/admin'));
app.use('/api', authenticate, require('./routes/insights'));

app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'API route not found' }));
app.use(errorHandler);

module.exports = app;
