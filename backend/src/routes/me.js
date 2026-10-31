// Employee self-service: profile, Skill Passport, gap analysis, learning plan, opportunities, badges.
const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { audit } = require('../lib/audit');
const { ApiError, notFound, badRequest } = require('../lib/errors');
const { loadPassport, scoreEmployeeForProjects, getProjectInOrg } = require('../lib/queries');
const { computeGap } = require('../engines/matching');
const { generatePlan } = require('../engines/learning');
const { latestRun } = require('../engines/market');

router.use((req, _res, next) => {
  if (!req.user.employeeId) throw new ApiError(400, 'No Skill Passport is linked to this account');
  next();
});

// ── Dashboard ──────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const { employeeId, organizationId } = req.user;
  const passport = await loadPassport(employeeId, organizationId);
  const scored = await scoreEmployeeForProjects(employeeId, organizationId, { status: { in: ['OPEN', 'STAFFING'] } });
  const learning = await prisma.learningRecommendation.findMany({ where: { employeeId }, include: { skill: true }, orderBy: { updatedAt: 'desc' } });
  const activity = await prisma.auditLog.findMany({ where: { organizationId, userId: req.user.id, action: { not: 'LOGIN' } }, orderBy: { createdAt: 'desc' }, take: 8 });
  const toVerify = passport.skills.filter((s) => s.claimedLevel > 0 && s.status !== 'VERIFIED').map((s) => ({ skillId: s.skillId, name: s.skill.name, claimedLevel: s.claimedLevel }));
  res.json({
    success: true,
    data: {
      employee: { id: passport.id, name: `${passport.user.firstName} ${passport.user.lastName}`, designation: passport.designation, points: passport.points, availability: passport.availability },
      summary: passport.summary,
      badges: passport.badges.length,
      toVerify,
      learning: {
        active: learning.filter((l) => l.status !== 'COMPLETED').length,
        completed: learning.filter((l) => l.status === 'COMPLETED').length,
        items: learning.filter((l) => l.status !== 'COMPLETED').slice(0, 4),
      },
      topOpportunities: scored
        .sort((a, b) => b.score.readinessScore - a.score.readinessScore)
        .slice(0, 3)
        .map(({ project, score }) => ({ id: project.id, title: project.title, readiness: score.readinessScore, eligible: score.eligible, nearlyReady: score.nearlyReady, summary: score.explanation.summary })),
      currentAssignments: passport.assignments.filter((a) => a.status === 'ACTIVE'),
      skills: passport.skills.map((s) => ({ name: s.skill.name, claimed: s.claimedLevel, verified: s.verifiedLevel || 0, status: s.status })),
      activity,
    },
  });
});

// ── Profile ────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  const p = await loadPassport(req.user.employeeId, req.user.organizationId);
  res.json({ success: true, data: p });
});

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  designation: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(1000).optional(),
  location: z.string().trim().max(100).optional(),
  experienceYears: z.number().min(0).max(50).optional(),
  workMode: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).optional(),
  careerInterests: z.array(z.string().trim().max(60)).max(10).optional(),
});
router.put('/profile', validate(profileSchema), async (req, res) => {
  const { firstName, lastName, ...emp } = req.body;
  const before = await prisma.employee.findUnique({ where: { id: req.user.employeeId } });
  await prisma.$transaction([
    prisma.user.update({ where: { id: req.user.id }, data: { ...(firstName && { firstName }), ...(lastName && { lastName }) } }),
    prisma.employee.update({ where: { id: req.user.employeeId }, data: emp }),
  ]);
  await audit(req, 'PROFILE_UPDATED', 'Employee', req.user.employeeId, { designation: before.designation, experienceYears: before.experienceYears }, req.body);
  res.json({ success: true, data: await loadPassport(req.user.employeeId, req.user.organizationId) });
});

// ── Skill Passport: claimed skills ─────────────────────────
router.get('/passport', async (req, res) => {
  res.json({ success: true, data: await loadPassport(req.user.employeeId, req.user.organizationId) });
});

const claimSchema = z.object({ skillId: z.string().uuid(), claimedLevel: z.number().int().min(1).max(5), yearsUsed: z.number().min(0).max(40).default(0) });
router.post('/skills', validate(claimSchema), async (req, res) => {
  const skill = await prisma.skill.findUnique({ where: { id: req.body.skillId } });
  if (!skill) throw notFound('Skill');
  const existing = await prisma.employeeSkill.findUnique({ where: { employeeId_skillId: { employeeId: req.user.employeeId, skillId: skill.id } } });
  const row = existing
    ? await prisma.employeeSkill.update({ where: { id: existing.id }, data: { claimedLevel: req.body.claimedLevel, yearsUsed: req.body.yearsUsed } })
    : await prisma.employeeSkill.create({ data: { employeeId: req.user.employeeId, skillId: skill.id, claimedLevel: req.body.claimedLevel, yearsUsed: req.body.yearsUsed } });
  await audit(req, 'SKILL_CLAIMED', 'EmployeeSkill', row.id, existing ? { claimedLevel: existing.claimedLevel } : null, { skill: skill.name, claimedLevel: row.claimedLevel });
  res.status(existing ? 200 : 201).json({ success: true, data: row });
});

router.delete('/skills/:id', async (req, res) => {
  const row = await prisma.employeeSkill.findFirst({ where: { id: req.params.id, employeeId: req.user.employeeId }, include: { skill: true } });
  if (!row) throw notFound('Skill claim');
  const evidence = await prisma.skillEvidence.count({ where: { employeeId: req.user.employeeId, skillId: row.skillId } });
  if (evidence > 0) throw badRequest('This skill has recorded evidence and cannot be removed. Evidence history is kept for audit.');
  await prisma.employeeSkill.delete({ where: { id: row.id } });
  await audit(req, 'SKILL_CLAIM_REMOVED', 'EmployeeSkill', row.id, { skill: row.skill.name }, null);
  res.json({ success: true });
});

const certSchema = z.object({
  name: z.string().trim().min(2).max(150),
  issuer: z.string().trim().min(2).max(120),
  skillId: z.string().uuid().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  credentialUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
});
router.post('/certifications', validate(certSchema), async (req, res) => {
  const b = req.body;
  const cert = await prisma.certification.create({
    data: {
      employeeId: req.user.employeeId, name: b.name, issuer: b.issuer, skillId: b.skillId || null,
      issueDate: b.issueDate ? new Date(b.issueDate) : null, expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
      credentialUrl: b.credentialUrl || null,
    },
  });
  await audit(req, 'CERTIFICATION_ADDED', 'Certification', cert.id, null, { name: cert.name, issuer: cert.issuer });
  res.status(201).json({ success: true, data: cert, message: 'Certification added. It counts as evidence once your manager or HR verifies it.' });
});

// ── Skill Gap Analysis ─────────────────────────────────────
router.get('/gap', async (req, res) => {
  const { employeeId, organizationId } = req.user;
  const passport = await loadPassport(employeeId, organizationId);
  const projects = await prisma.project.findMany({ where: { organizationId, status: { in: ['OPEN', 'STAFFING', 'ACTIVE'] } }, select: { id: true, title: true, status: true } });
  let projectGap = null;
  const projectId = req.query.projectId || null;
  if (projectId) {
    const project = await getProjectInOrg(projectId, organizationId, { requirements: { include: { skill: true } } });
    const scored = (await scoreEmployeeForProjects(employeeId, organizationId, { id: projectId }))[0];
    projectGap = { project: { id: project.id, title: project.title }, ...computeGap(passport.skills, project.requirements), readiness: scored.score };
  }
  // Market-demand gaps: top observed skills from the latest run the employee hasn't verified at L3+
  const run = await latestRun(organizationId);
  let marketGap = [];
  if (run) {
    const top = await prisma.marketSkillDemand.findMany({ where: { runId: run.id }, include: { skill: true }, orderBy: { postingCount: 'desc' }, take: 12 });
    const mine = new Map(passport.skills.map((s) => [s.skillId, s]));
    marketGap = top.map((d) => {
      const s = mine.get(d.skillId);
      return { skillId: d.skillId, skillName: d.skill.name, demandPercent: d.demandPercent, postingCount: d.postingCount, verified: s?.status === 'VERIFIED' ? s.verifiedLevel : 0, claimed: s?.claimedLevel || 0 };
    });
  }
  res.json({ success: true, data: { projects, projectGap, marketGap, marketRun: run ? { id: run.id, kind: run.source.kind, source: run.source.name, periodStart: run.periodStart, periodEnd: run.periodEnd, rowsKept: run.rowsKept } : null, skills: passport.skills } });
});

// ── Learning plan ──────────────────────────────────────────
router.get('/learning', async (req, res) => {
  const items = await prisma.learningRecommendation.findMany({
    where: { employeeId: req.user.employeeId },
    include: { skill: true, project: { select: { id: true, title: true } }, progress: { orderBy: { createdAt: 'desc' }, take: 5 } },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  });
  const assessments = await prisma.assessment.findMany({ where: { organizationId: req.user.organizationId, isActive: true }, select: { id: true, skillId: true, type: true, title: true } });
  res.json({ success: true, data: items.map((i) => ({ ...i, assessments: assessments.filter((a) => a.skillId === i.skillId) })) });
});

router.post('/learning/generate', validate(z.object({ projectId: z.string().uuid() })), async (req, res) => {
  const { employeeId, organizationId } = req.user;
  const project = await getProjectInOrg(req.body.projectId, organizationId, { requirements: { include: { skill: true } } });
  const passport = await loadPassport(employeeId, organizationId);
  const gap = computeGap(passport.skills, project.requirements);
  const gaps = gap.items.filter((i) => i.gap > 0).map((i) => ({ skillId: i.skillId, skillName: i.skillName, verified: i.verified, required: i.required, critical: i.critical }));
  if (!gaps.length) return res.json({ success: true, data: [], message: 'No gaps — you already meet every requirement for this project.' });
  const plan = await generatePlan(employeeId, gaps, { projectId: project.id, projectTitle: project.title });
  await audit(req, 'LEARNING_PLAN_GENERATED', 'Project', project.id, null, { skills: gaps.map((g) => g.skillName) });
  res.status(201).json({ success: true, data: plan });
});

router.patch('/learning/:id/tasks/:taskId', validate(z.object({ done: z.boolean() })), async (req, res) => {
  const rec = await prisma.learningRecommendation.findFirst({ where: { id: req.params.id, employeeId: req.user.employeeId } });
  if (!rec) throw notFound('Learning recommendation');
  if (rec.status === 'COMPLETED') throw badRequest('This plan is already completed');
  const tasks = rec.tasks.map((t) => (t.id === req.params.taskId ? { ...t, done: req.body.done, doneAt: req.body.done ? new Date().toISOString() : null } : t));
  if (!tasks.some((t) => t.id === req.params.taskId)) throw notFound('Task');
  const pct = Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
  const status = pct === 100 ? 'READY_FOR_REASSESSMENT' : pct > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
  const updated = await prisma.learningRecommendation.update({ where: { id: rec.id }, data: { tasks, progressPercent: pct, status } });
  await prisma.learningProgress.create({ data: { learningRecommendationId: rec.id, employeeId: req.user.employeeId, event: req.body.done ? 'TASK_DONE' : 'TASK_UNDONE', taskId: req.params.taskId, progressPercent: pct } });
  res.json({ success: true, data: updated });
});

// ── Internal project opportunities ─────────────────────────
router.get('/opportunities', async (req, res) => {
  const { employeeId, organizationId } = req.user;
  const scored = await scoreEmployeeForProjects(employeeId, organizationId, { status: { in: ['OPEN', 'STAFFING'] } });
  const interests = await prisma.auditLog.findMany({ where: { organizationId, userId: req.user.id, action: 'PROJECT_INTEREST' }, select: { entityId: true } });
  const interested = new Set(interests.map((i) => i.entityId));
  const mine = await prisma.projectRecommendation.findMany({ where: { employeeId }, select: { projectId: true, status: true } });
  const statusBy = new Map(mine.map((m) => [m.projectId, m.status]));
  res.json({
    success: true,
    data: scored.map(({ project, score }) => ({
      id: project.id, title: project.title, description: project.description, status: project.status, priority: project.priority,
      workMode: project.workMode, location: project.location, startDate: project.startDate, endDate: project.endDate,
      openPositions: project.openPositions, filled: project._count.assignments, department: project.department?.name,
      manager: project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : null,
      requirements: project.requirements.map((r) => ({ skill: r.skill.name, minLevel: r.minLevel, critical: r.isCritical })),
      readiness: score.readinessScore, eligible: score.eligible, nearlyReady: score.nearlyReady,
      explanation: score.explanation, interested: interested.has(project.id), recommendationStatus: statusBy.get(project.id) || null,
    })).sort((a, b) => b.readiness - a.readiness),
  });
});

router.post('/opportunities/:projectId/interest', async (req, res) => {
  const project = await getProjectInOrg(req.params.projectId, req.user.organizationId);
  const exists = await prisma.auditLog.findFirst({ where: { organizationId: req.user.organizationId, userId: req.user.id, action: 'PROJECT_INTEREST', entityId: project.id } });
  if (!exists) await audit(req, 'PROJECT_INTEREST', 'Project', project.id, null, { employeeId: req.user.employeeId, project: project.title });
  res.json({ success: true, message: `Interest in "${project.title}" shared with the project manager.` });
});

// ── Badges ─────────────────────────────────────────────────
router.get('/badges', async (req, res) => {
  const [all, mine, emp] = await Promise.all([
    prisma.badge.findMany({ orderBy: { points: 'asc' } }),
    prisma.employeeBadge.findMany({ where: { employeeId: req.user.employeeId }, include: { badge: true } }),
    prisma.employee.findUnique({ where: { id: req.user.employeeId }, select: { points: true } }),
  ]);
  const leaderboard = await prisma.employee.findMany({
    where: { organizationId: req.user.organizationId, user: { role: { not: 'HR' } } },
    orderBy: { points: 'desc' }, take: 5, select: { id: true, points: true, user: { select: { firstName: true, lastName: true } }, _count: { select: { badges: true } } },
  });
  const earned = new Map(mine.map((m) => [m.badgeId, m]));
  res.json({ success: true, data: { points: emp.points, badges: all.map((b) => ({ ...b, earned: earned.has(b.id), awardedAt: earned.get(b.id)?.awardedAt, reason: earned.get(b.id)?.reason })), leaderboard } });
});

module.exports = router;
