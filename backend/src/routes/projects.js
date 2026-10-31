// Projects, requirements, AI matching, candidate comparison, manager shortlist, assignment completion.
const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { audit } = require('../lib/audit');
const { notFound, badRequest, forbidden } = require('../lib/errors');
const { getProjectInOrg } = require('../lib/queries');
const ai = require('../lib/aiClient');
const { runMatching } = require('../engines/matching');
const { generatePlan } = require('../engines/learning');
const { recomputeSkill } = require('../engines/verification');

router.use(authorize('MANAGER', 'HR'));

function assertCanManage(req, project) {
  if (req.user.role === 'HR') return;
  if (project.managerId !== req.user.id && project.createdById !== req.user.id) throw forbidden('Only the project manager or HR can change this project');
}

const reqSchema = z.object({ skillId: z.string().uuid(), minLevel: z.number().int().min(1).max(5), isCritical: z.boolean().default(false), weight: z.number().min(0.5).max(3).default(1) });
const projectSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(3000).optional(),
  status: z.enum(['DRAFT', 'OPEN', 'STAFFING', 'ACTIVE', 'COMPLETED', 'CANCELLED']).default('OPEN'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  openPositions: z.number().int().min(1).max(50).default(1),
  minExperience: z.number().min(0).max(30).default(0),
  workMode: z.enum(['REMOTE', 'ONSITE', 'HYBRID']).default('HYBRID'),
  location: z.string().trim().max(100).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  requirements: z.array(reqSchema).min(1, 'Add at least one skill requirement').max(20),
});

const toDate = (s) => (s ? new Date(s) : null);

router.get('/', async (req, res) => {
  const where = { organizationId: req.user.organizationId };
  if (req.query.status) where.status = String(req.query.status);
  if (req.user.role === 'MANAGER' && req.query.scope !== 'all') where.OR = [{ managerId: req.user.id }, { createdById: req.user.id }];
  const rows = await prisma.project.findMany({
    where,
    include: {
      requirements: { include: { skill: true } }, manager: { select: { id: true, firstName: true, lastName: true } }, department: true,
      assignments: { where: { status: 'ACTIVE' }, select: { id: true } },
      recommendations: { select: { status: true, eligible: true, nearlyReady: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({
    success: true,
    data: rows.map((p) => ({
      ...p, filled: p.assignments.length,
      stats: {
        evaluated: p.recommendations.length, eligible: p.recommendations.filter((r) => r.eligible).length,
        nearlyReady: p.recommendations.filter((r) => r.nearlyReady).length,
        shortlisted: p.recommendations.filter((r) => r.status === 'SHORTLISTED').length,
      },
      recommendations: undefined, assignments: undefined,
    })),
  });
});

router.post('/', validate(projectSchema), async (req, res) => {
  const b = req.body;
  const orgId = req.user.organizationId;
  const managerId = req.user.role === 'HR' ? b.managerId || null : req.user.id;
  if (managerId && !(await prisma.user.findFirst({ where: { id: managerId, organizationId: orgId, role: { in: ['MANAGER', 'HR'] } } }))) throw badRequest('Invalid project manager');
  if (new Set(b.requirements.map((r) => r.skillId)).size !== b.requirements.length) throw badRequest('Each skill can only be required once');
  const project = await prisma.project.create({
    data: {
      organizationId: orgId, createdById: req.user.id, managerId, title: b.title, description: b.description, status: b.status, priority: b.priority,
      openPositions: b.openPositions, minExperience: b.minExperience, workMode: b.workMode, location: b.location, startDate: toDate(b.startDate), endDate: toDate(b.endDate),
      departmentId: b.departmentId || null, requirements: { create: b.requirements },
    },
    include: { requirements: { include: { skill: true } } },
  });
  await audit(req, 'PROJECT_CREATED', 'Project', project.id, null, { title: project.title, requirements: project.requirements.map((r) => `${r.skill.name} L${r.minLevel}${r.isCritical ? ' (critical)' : ''}`) });
  res.status(201).json({ success: true, data: project });
});

router.get('/:id', async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId, {
    requirements: { include: { skill: true } }, manager: { select: { id: true, firstName: true, lastName: true, email: true } }, createdBy: { select: { firstName: true, lastName: true } }, department: true,
    assignments: { include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: { startedAt: 'desc' } },
  });
  const interests = await prisma.auditLog.findMany({ where: { organizationId: req.user.organizationId, action: 'PROJECT_INTEREST', entityId: project.id }, include: { user: { select: { firstName: true, lastName: true } } } });
  const recCounts = await prisma.projectRecommendation.groupBy({ by: ['status'], where: { projectId: project.id }, _count: true });
  // internal supply per requirement (verified at or above the level)
  const supply = await Promise.all(project.requirements.map(async (r) => ({
    skillId: r.skillId,
    verifiedAtLevel: await prisma.employeeSkill.count({ where: { skillId: r.skillId, status: 'VERIFIED', verifiedLevel: { gte: r.minLevel }, employee: { organizationId: req.user.organizationId } } }),
    claimedOnly: await prisma.employeeSkill.count({ where: { skillId: r.skillId, status: { not: 'VERIFIED' }, claimedLevel: { gte: r.minLevel }, employee: { organizationId: req.user.organizationId } } }),
  })));
  res.json({ success: true, data: { ...project, interests: interests.map((i) => ({ name: `${i.user?.firstName} ${i.user?.lastName}`, employeeId: i.after?.employeeId, at: i.createdAt })), recommendationCounts: recCounts, supply, canManage: req.user.role === 'HR' || project.managerId === req.user.id || project.createdById === req.user.id } });
});

router.put('/:id', validate(projectSchema), async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId, { requirements: { include: { skill: true } } });
  assertCanManage(req, project);
  const b = req.body;
  if (new Set(b.requirements.map((r) => r.skillId)).size !== b.requirements.length) throw badRequest('Each skill can only be required once');
  const managerId = req.user.role === 'HR' ? b.managerId ?? project.managerId : project.managerId;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.projectSkillRequirement.deleteMany({ where: { projectId: project.id } });
    // requirements changed -> previous machine recommendations are stale
    await tx.projectRecommendation.deleteMany({ where: { projectId: project.id, status: 'RECOMMENDED' } });
    return tx.project.update({
      where: { id: project.id },
      data: {
        title: b.title, description: b.description, status: b.status, priority: b.priority, openPositions: b.openPositions, minExperience: b.minExperience,
        workMode: b.workMode, location: b.location, startDate: toDate(b.startDate), endDate: toDate(b.endDate), departmentId: b.departmentId || null, managerId,
        lastMatchedAt: null, requirements: { create: b.requirements },
      },
      include: { requirements: { include: { skill: true } } },
    });
  });
  await audit(req, 'PROJECT_UPDATED', 'Project', project.id,
    { title: project.title, status: project.status, requirements: project.requirements.map((r) => `${r.skill.name} L${r.minLevel}`) },
    { title: updated.title, status: updated.status, requirements: updated.requirements.map((r) => `${r.skill.name} L${r.minLevel}`) });
  res.json({ success: true, data: updated });
});

// ── AI Talent Matching ─────────────────────────────────────
router.post('/:id/match', async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId);
  if (['COMPLETED', 'CANCELLED'].includes(project.status)) throw badRequest('Matching is not available for closed projects');
  const result = await runMatching(project.id, req.user.organizationId);
  await audit(req, 'MATCHING_RUN', 'Project', project.id, null, { evaluated: result.totalEvaluated, eligible: result.eligible, nearlyReady: result.nearlyReady });
  res.json({ success: true, data: { evaluated: result.totalEvaluated, eligible: result.eligible, nearlyReady: result.nearlyReady } });
});

router.get('/:id/recommendations', async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId, { requirements: { include: { skill: true } } });
  const recs = await prisma.projectRecommendation.findMany({
    where: { projectId: project.id },
    include: { employee: { include: { user: { select: { firstName: true, lastName: true, email: true } }, department: true } }, decidedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { rank: 'asc' },
  });
  res.json({
    success: true,
    data: {
      project: { id: project.id, title: project.title, lastMatchedAt: project.lastMatchedAt, openPositions: project.openPositions, requirements: project.requirements },
      recommendations: recs.map((r) => ({
        ...r,
        employee: { id: r.employee.id, name: `${r.employee.user.firstName} ${r.employee.user.lastName}`, email: r.employee.user.email, designation: r.employee.designation, department: r.employee.department?.name, experienceYears: r.employee.experienceYears, availability: r.employee.availability },
      })),
    },
  });
});

router.get('/:id/compare', async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId);
  const ids = String(req.query.employeeIds || '').split(',').filter(Boolean).slice(0, 4);
  if (ids.length < 2) throw badRequest('Select 2 to 4 candidates to compare');
  const recs = await prisma.projectRecommendation.findMany({ where: { projectId: project.id, employeeId: { in: ids } }, include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } } });
  res.json({ success: true, data: recs.map((r) => ({ ...r, name: `${r.employee.user.firstName} ${r.employee.user.lastName}`, designation: r.employee.designation, experienceYears: r.employee.experienceYears, employee: undefined })) });
});

// Manager shortlists a candidate for HR approval
router.post('/:id/recommendations/:recId/shortlist', validate(z.object({ note: z.string().trim().max(1000).optional() })), async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId);
  assertCanManage(req, project);
  const rec = await prisma.projectRecommendation.findFirst({ where: { id: req.params.recId, projectId: project.id }, include: { employee: { include: { user: true } } } });
  if (!rec) throw notFound('Recommendation');
  if (!rec.eligible) throw badRequest('This candidate does not meet the mandatory critical-skill thresholds. Assign a learning plan instead.');
  if (rec.status !== 'RECOMMENDED' && rec.status !== 'REJECTED') throw badRequest(`Candidate is already ${rec.status.toLowerCase()}`);
  const updated = await prisma.projectRecommendation.update({ where: { id: rec.id }, data: { status: 'SHORTLISTED', managerNote: req.body.note || null, managerDecidedAt: new Date() } });
  await audit(req, 'CANDIDATE_SHORTLISTED', 'ProjectRecommendation', rec.id, { status: rec.status }, { status: 'SHORTLISTED', project: project.title, employee: `${rec.employee.user.firstName} ${rec.employee.user.lastName}`, readiness: rec.readinessScore });
  res.json({ success: true, data: updated, message: 'Shortlisted — sent to HR for assignment approval.' });
});

router.post('/:id/recommendations/:recId/reject', validate(z.object({ note: z.string().trim().max(1000).optional() })), async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId);
  assertCanManage(req, project);
  const rec = await prisma.projectRecommendation.findFirst({ where: { id: req.params.recId, projectId: project.id } });
  if (!rec) throw notFound('Recommendation');
  if (rec.status === 'APPROVED') throw badRequest('Already approved and assigned');
  const updated = await prisma.projectRecommendation.update({ where: { id: rec.id }, data: { status: 'REJECTED', managerNote: req.body.note || null, managerDecidedAt: new Date() } });
  await audit(req, 'CANDIDATE_REJECTED', 'ProjectRecommendation', rec.id, { status: rec.status }, { status: 'REJECTED', note: req.body.note });
  res.json({ success: true, data: updated });
});

// Optional natural-language narrative (Gemini via AI service) — wording only, never ranking
router.get('/:id/recommendations/:recId/narrative', async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId);
  const rec = await prisma.projectRecommendation.findFirst({ where: { id: req.params.recId, projectId: project.id }, include: { employee: { include: { user: true } } } });
  if (!rec) throw notFound('Recommendation');
  const ex = rec.explanation;
  const r = await ai.explainMatch({ name: `${rec.employee.user.firstName} ${rec.employee.user.lastName}`, project: project.title, summary: ex.summary, strengths: ex.strengths || [], concerns: [...(ex.blockers || []), ...(ex.concerns || [])] });
  res.json({ success: true, data: r || { text: ex.summary, source: 'rules' } });
});

// Suggest training to a candidate who is close to ready
router.post('/:id/recommendations/:recId/learning', async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId);
  const rec = await prisma.projectRecommendation.findFirst({ where: { id: req.params.recId, projectId: project.id } });
  if (!rec) throw notFound('Recommendation');
  const gaps = (rec.explanation.gap || []).filter((g) => g.gap > 0).map((g) => ({ skillId: g.skillId, skillName: g.skillName, verified: g.verified, required: g.required, critical: g.critical }));
  if (!gaps.length) throw badRequest('Candidate has no skill gaps for this project');
  const plan = await generatePlan(rec.employeeId, gaps, { projectId: project.id, projectTitle: project.title });
  await audit(req, 'LEARNING_ASSIGNED', 'Employee', rec.employeeId, null, { project: project.title, skills: gaps.map((g) => `${g.skillName} L${g.verified}→L${g.required}`) });
  res.status(201).json({ success: true, data: plan, message: `Learning plan with ${plan.length} skill(s) assigned.` });
});

// Complete an assignment -> project evidence + Skill Passport update
router.post('/:id/assignments/:assignmentId/complete', validate(z.object({ note: z.string().trim().max(500).optional() })), async (req, res) => {
  const project = await getProjectInOrg(req.params.id, req.user.organizationId);
  assertCanManage(req, project);
  const a = await prisma.projectAssignment.findFirst({ where: { id: req.params.assignmentId, projectId: project.id }, include: { employee: true } });
  if (!a) throw notFound('Assignment');
  if (a.status !== 'ACTIVE') throw badRequest('Assignment is not active');
  await prisma.projectAssignment.update({ where: { id: a.id }, data: { status: 'COMPLETED', endedAt: new Date() } });
  const updates = [];
  for (const s of a.skillsUsed || []) {
    await prisma.skillEvidence.create({ data: { employeeId: a.employeeId, skillId: s.skillId, type: 'PROJECT', title: `Delivered on project "${project.title}"`, level: s.level, reviewerId: req.user.id, reviewerName: `${req.user.firstName} ${req.user.lastName}`, sourceId: a.id, details: { note: req.body.note || null } } });
    updates.push((await recomputeSkill(a.employeeId, s.skillId)).after);
  }
  const alloc = Math.max(0, a.employee.allocationPercent - a.allocationPercent);
  await prisma.employee.update({ where: { id: a.employeeId }, data: { allocationPercent: alloc, availability: alloc === 0 ? 'AVAILABLE' : alloc >= 100 ? 'ON_PROJECT' : 'PARTIALLY_AVAILABLE' } });
  await audit(req, 'ASSIGNMENT_COMPLETED', 'ProjectAssignment', a.id, { status: 'ACTIVE' }, { status: 'COMPLETED', evidenceAdded: updates.length });
  res.json({ success: true, data: { skillUpdates: updates.length } });
});

module.exports = router;
