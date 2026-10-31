// HR administration: users & roles, departments, audit logs, system settings.
const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { audit } = require('../lib/audit');
const { notFound, badRequest } = require('../lib/errors');
const { getSettings } = require('../lib/settings');
const ai = require('../lib/aiClient');

router.get('/departments', async (req, res) => {
  const rows = await prisma.department.findMany({ where: { organizationId: req.user.organizationId }, include: { _count: { select: { employees: true, projects: true } } }, orderBy: { name: 'asc' } });
  res.json({ success: true, data: rows });
});
router.get('/managers', authorize('HR', 'MANAGER'), async (req, res) => {
  const rows = await prisma.user.findMany({ where: { organizationId: req.user.organizationId, role: { in: ['MANAGER', 'HR'] }, isActive: true }, select: { id: true, firstName: true, lastName: true, role: true }, orderBy: { firstName: 'asc' } });
  res.json({ success: true, data: rows });
});

router.use(authorize('HR'));

router.post('/departments', validate(z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).optional() })), async (req, res) => {
  const d = await prisma.department.create({ data: { organizationId: req.user.organizationId, ...req.body } });
  await audit(req, 'DEPARTMENT_CREATED', 'Department', d.id, null, req.body);
  res.status(201).json({ success: true, data: d });
});

router.get('/users', async (req, res) => {
  const where = { organizationId: req.user.organizationId };
  if (req.query.role) where.role = String(req.query.role);
  if (req.query.q) where.OR = ['firstName', 'lastName', 'email'].map((f) => ({ [f]: { contains: String(req.query.q), mode: 'insensitive' } }));
  const users = await prisma.user.findMany({ where, select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, lastLoginAt: true, createdAt: true, employee: { select: { id: true, designation: true } } }, orderBy: { createdAt: 'asc' } });
  res.json({ success: true, data: users });
});

router.patch('/users/:id', validate(z.object({ role: z.enum(['EMPLOYEE', 'MANAGER', 'HR']).optional(), isActive: z.boolean().optional() })), async (req, res) => {
  const u = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
  if (!u) throw notFound('User');
  if (u.id === req.user.id && (req.body.role && req.body.role !== 'HR' || req.body.isActive === false)) throw badRequest('You cannot remove your own HR access or deactivate yourself');
  if (u.role === 'HR' && (req.body.role && req.body.role !== 'HR' || req.body.isActive === false)) {
    const hrCount = await prisma.user.count({ where: { organizationId: req.user.organizationId, role: 'HR', isActive: true } });
    if (hrCount <= 1) throw badRequest('The organization must keep at least one active HR user');
  }
  const updated = await prisma.user.update({ where: { id: u.id }, data: req.body, select: { id: true, role: true, isActive: true, email: true } });
  await audit(req, req.body.role ? 'ROLE_CHANGED' : 'USER_STATUS_CHANGED', 'User', u.id, { role: u.role, isActive: u.isActive }, req.body);
  res.json({ success: true, data: updated });
});

router.post('/users/:id/reset-password', async (req, res) => {
  const u = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user.organizationId } });
  if (!u) throw notFound('User');
  const tempPassword = `Tb-${crypto.randomBytes(4).toString('hex')}9`;
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(tempPassword, 12) } });
  await audit(req, 'PASSWORD_RESET', 'User', u.id, null, { email: u.email });
  res.json({ success: true, data: { tempPassword } });
});

router.get('/audit', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Number(req.query.pageSize) || 25);
  const where = { organizationId: req.user.organizationId };
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.entityType) where.entityType = String(req.query.entityType);
  const [total, rows, actions] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.groupBy({ by: ['action'], where: { organizationId: req.user.organizationId }, _count: true }),
  ]);
  res.json({ success: true, data: { total, page, pageSize, rows, actions: actions.map((a) => ({ action: a.action, count: a._count })).sort((a, b) => a.action.localeCompare(b.action)) } });
});

router.get('/settings', async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  const health = await ai.health();
  res.json({ success: true, data: { organization: { id: org.id, name: org.name, domain: org.domain, joinCode: org.joinCode }, settings: getSettings(org), aiService: health ? { status: 'online', ...health } : { status: 'offline', note: 'Deterministic fallbacks are active.' } } });
});

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  matchingWeights: z.object({ skillMatch: z.number().min(0).max(100), practical: z.number().min(0).max(100), experience: z.number().min(0).max(100), feedback: z.number().min(0).max(100), availability: z.number().min(0).max(100) })
    .refine((w) => Math.round(w.skillMatch + w.practical + w.experience + w.feedback + w.availability) === 100, 'Weights must add up to 100').optional(),
  nearlyReadyMaxGap: z.number().int().min(0).max(6).optional(),
  hiringAssumptions: z.object({ currency: z.string().max(5), externalHireCost: z.number().min(0), externalTimeToFillDays: z.number().min(0), internalRedeployCost: z.number().min(0), internalTimeToDeployDays: z.number().min(0) }).optional(),
  geminiExplanations: z.boolean().optional(),
});
router.put('/settings', validate(settingsSchema), async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.user.organizationId } });
  const before = getSettings(org);
  const { name, ...rest } = req.body;
  const merged = { ...(org.settings || {}), ...rest };
  const updated = await prisma.organization.update({ where: { id: org.id }, data: { settings: merged, ...(name && { name }) } });
  await audit(req, 'SETTINGS_UPDATED', 'Organization', org.id, { matchingWeights: before.matchingWeights, nearlyReadyMaxGap: before.nearlyReadyMaxGap }, rest);
  res.json({ success: true, data: getSettings(updated) });
});

router.post('/settings/rotate-join-code', async (req, res) => {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  await prisma.organization.update({ where: { id: req.user.organizationId }, data: { joinCode: code } });
  await audit(req, 'JOIN_CODE_ROTATED', 'Organization', req.user.organizationId, null, null);
  res.json({ success: true, data: { joinCode: code } });
});

module.exports = router;
