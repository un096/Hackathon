// Market Skill Intelligence: CSV import + observed demand vs internal supply.
const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const prisma = require('../lib/prisma');
const { authorize } = require('../middleware/auth');
const { audit } = require('../lib/audit');
const { badRequest } = require('../lib/errors');
const { ingestMarketCsv, latestRun } = require('../engines/market');

const SAMPLE_PATH = process.env.MARKET_SAMPLE_CSV || path.join(__dirname, '../../../data/market_sample_tech_jobs.csv');
const upload = multer({
  dest: path.join(os.tmpdir(), 'talentbridge-uploads'),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.csv$/i.test(file.originalname) && ['text/csv', 'application/vnd.ms-excel', 'application/octet-stream', 'text/plain'].includes(file.mimetype);
    cb(ok ? null : new Error('Only .csv files are accepted'), ok);
  },
});

router.get('/summary', authorize('HR', 'MANAGER', 'EMPLOYEE'), async (req, res) => {
  const orgId = req.user.organizationId;
  const runId = req.query.runId ? String(req.query.runId) : null;
  const run = runId ? await prisma.marketDataRun.findFirst({ where: { id: runId, organizationId: orgId, status: 'COMPLETED' }, include: { source: true } }) : await latestRun(orgId);
  if (!run) return res.json({ success: true, data: null });
  const [demand, headcount, internal, trend] = await Promise.all([
    prisma.marketSkillDemand.findMany({ where: { runId: run.id }, include: { skill: true }, orderBy: { postingCount: 'desc' } }),
    prisma.employee.count({ where: { organizationId: orgId, user: { isActive: true } } }),
    prisma.employeeSkill.groupBy({ by: ['skillId'], where: { status: 'VERIFIED', employee: { organizationId: orgId } }, _count: true, _avg: { verifiedLevel: true } }),
    prisma.marketSkillTrend.findMany({ where: { runId: run.id }, include: { skill: { select: { name: true } } }, orderBy: { period: 'asc' } }),
  ]);
  const internalBy = new Map(internal.map((i) => [i.skillId, i]));
  const rows = demand.map((d) => {
    const i = internalBy.get(d.skillId);
    const internalShare = headcount ? Math.round(((i?._count || 0) / headcount) * 1000) / 10 : 0;
    return {
      skillId: d.skillId, skill: d.skill.name, category: d.skill.category, postingCount: d.postingCount, demandPercent: d.demandPercent, seniorShare: d.seniorShare,
      internalVerified: i?._count || 0, internalAvgLevel: i?._avg.verifiedLevel ? Math.round(i._avg.verifiedLevel * 10) / 10 : 0, internalShare,
      gapIndex: Math.round((d.demandPercent - internalShare) * 10) / 10, kind: d.kind,
    };
  });
  const categories = {};
  for (const r of rows) categories[r.category] = (categories[r.category] || 0) + r.postingCount;
  const techRows = rows.filter((r) => r.category !== 'Soft Skills');
  const top = techRows.slice(0, 6).map((r) => r.skillId);
  const series = {};
  for (const t of trend.filter((x) => top.includes(x.skillId))) {
    series[t.period] = series[t.period] || { period: t.period };
    series[t.period][`${t.skill.name}${t.kind === 'FORECAST' ? ' (forecast)' : ''}`] = t.postingCount;
  }
  res.json({
    success: true,
    data: {
      run: { id: run.id, fileName: run.fileName, source: run.source.name, kind: run.source.kind, pipeline: run.pipeline, rowsRead: run.rowsRead, rowsKept: run.rowsKept, rowsDropped: run.rowsDropped, skillsMatched: run.skillsMatched, periodStart: run.periodStart, periodEnd: run.periodEnd, completedAt: run.completedAt, stats: run.stats, unmatchedTop: run.unmatchedTop },
      demand: rows, categories: Object.entries(categories).map(([category, postings]) => ({ category, postings })).sort((a, b) => b.postings - a.postings),
      trend: Object.values(series).sort((a, b) => a.period.localeCompare(b.period)), trendSkills: techRows.slice(0, 6).map((r) => r.skill),
      hasForecast: trend.some((t) => t.kind === 'FORECAST'), headcount,
    },
  });
});

router.get('/runs', authorize('HR'), async (req, res) => {
  const runs = await prisma.marketDataRun.findMany({ where: { organizationId: req.user.organizationId }, include: { source: true }, orderBy: { startedAt: 'desc' }, take: 20 });
  res.json({ success: true, data: runs });
});

router.post('/import', authorize('HR'), upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Attach a CSV file in the "file" field');
  try {
    const run = await ingestMarketCsv({ organizationId: req.user.organizationId, filePath: req.file.path, fileName: req.file.originalname, sourceName: String(req.body.sourceName || 'Uploaded job-posting CSV').slice(0, 100), kind: req.body.kind === 'DEMO' ? 'DEMO' : 'OBSERVED' });
    await audit(req, 'MARKET_CSV_IMPORTED', 'MarketDataRun', run.id, null, { file: run.fileName, rowsKept: run.rowsKept, pipeline: run.pipeline });
    res.status(201).json({ success: true, data: run });
  } catch (e) {
    throw badRequest(`Import failed: ${e.message}`);
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

router.post('/import-sample', authorize('HR'), async (req, res) => {
  if (!fs.existsSync(SAMPLE_PATH)) throw badRequest('Bundled sample CSV not found on the server');
  const run = await ingestMarketCsv({ organizationId: req.user.organizationId, filePath: SAMPLE_PATH, fileName: path.basename(SAMPLE_PATH), sourceName: 'LinkedIn Job Postings 2024 (Kaggle sample)', kind: 'OBSERVED' });
  await audit(req, 'MARKET_CSV_IMPORTED', 'MarketDataRun', run.id, null, { file: run.fileName, rowsKept: run.rowsKept, pipeline: run.pipeline });
  res.status(201).json({ success: true, data: run });
});

module.exports = router;
