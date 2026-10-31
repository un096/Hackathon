// Assignment approvals. Manager shortlists (projects route) -> HR approves -> employee deployed.
const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { audit } = require('../lib/audit');
const { notFound, badRequest } = require('../lib/errors');
const { award } = require('../engines/badges');

router.use(authorize('MANAGER', 'HR'));

router.get('/', async (req, res) => {
  const where = { project: { organizationId: req.user.organizationId }, status: { in: ['SHORTLISTED', 'APPROVED', 'REJECTED'] } };
  if (req.user.role === 'MANAGER') where.project.OR = [{ managerId: req.user.id }, { createdById: req.user.id }];
  if (req.query.status) where.status = String(req.query.status);
  const rows = await prisma.projectRecommendation.findMany({
    where,
    include: {
      project: { select: { id: true, title: true, openPositions: true, status: true, manager: { select: { firstName: true, lastName: true } } } },
      employee: { include: { user: { select: { firstName: true, lastName: true } }, department: true } },
      decidedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id, status: r.status, readinessScore: r.readinessScore, eligible: r.eligible, managerNote: r.managerNote, hrNote: r.hrNote,
      managerDecidedAt: r.managerDecidedAt, decidedAt: r.decidedAt, decidedBy: r.decidedBy ? `${r.decidedBy.firstName} ${r.decidedBy.lastName}` : null,
      summary: r.explanation?.summary, project: r.project, projectManager: r.project.manager ? `${r.project.manager.firstName} ${r.project.manager.lastName}` : null,
      employee: { id: r.employee.id, name: `${r.employee.user.firstName} ${r.employee.user.lastName}`, designation: r.employee.designation, department: r.employee.department?.name, availability: r.employee.availability, allocationPercent: r.employee.allocationPercent },
    })),
  });
});

const decisionSchema = z.object({ note: z.string().trim().max(1000).optional(), allocationPercent: z.number().int().min(10).max(100).default(100), role: z.string().trim().max(100).optional() });

router.post('/:recId/approve', authorize('HR'), validate(decisionSchema), async (req, res) => {
  const rec = await prisma.projectRecommendation.findFirst({
    where: { id: req.params.recId, project: { organizationId: req.user.organizationId } },
    include: { project: { include: { requirements: { include: { skill: true } } } }, employee: { include: { user: true, skills: true } } },
  });
  if (!rec) throw notFound('Recommendation');
  if (rec.status !== 'SHORTLISTED') throw badRequest('Only manager-shortlisted candidates can be approved');
  if (!rec.eligible) throw badRequest('Candidate does not meet mandatory thresholds');
  const active = await prisma.projectAssignment.count({ where: { projectId: rec.projectId, status: 'ACTIVE' } });
  if (active >= rec.project.openPositions) throw badRequest('All open positions on this project are already filled');
  const newAlloc = rec.employee.allocationPercent + req.body.allocationPercent;
  if (newAlloc > 100) throw badRequest(`Employee is already ${rec.employee.allocationPercent}% allocated; cannot add ${req.body.allocationPercent}%`);

  const verifiedBy = new Map(rec.employee.skills.filter((s) => s.status === 'VERIFIED').map((s) => [s.skillId, s.verifiedLevel]));
  const skillsUsed = rec.project.requirements.filter((r) => verifiedBy.has(r.skillId)).map((r) => ({ skillId: r.skillId, name: r.skill.name, level: Math.min(verifiedBy.get(r.skillId), Math.max(r.minLevel, 1)) }));

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.projectAssignment.create({
      data: { projectId: rec.projectId, employeeId: rec.employeeId, role: req.body.role || null, allocationPercent: req.body.allocationPercent, assignedById: req.user.id, readinessAtAssign: rec.readinessScore, skillsUsed },
    });
    await tx.projectRecommendation.update({ where: { id: rec.id }, data: { status: 'APPROVED', hrNote: req.body.note || null, decidedById: req.user.id, decidedAt: new Date() } });
    await tx.employee.update({ where: { id: rec.employeeId }, data: { allocationPercent: newAlloc, availability: newAlloc >= 100 ? 'ON_PROJECT' : 'PARTIALLY_AVAILABLE' } });
    if (active + 1 >= rec.project.openPositions) await tx.project.update({ where: { id: rec.projectId }, data: { status: 'ACTIVE' } });
    return assignment;
  });
  await award(rec.employeeId, 'DEPLOYED', `Deployed to ${rec.project.title}`);
  await audit(req, 'ASSIGNMENT_APPROVED', 'ProjectAssignment', result.id, { status: 'SHORTLISTED' },
    { status: 'APPROVED', project: rec.project.title, employee: `${rec.employee.user.firstName} ${rec.employee.user.lastName}`, readiness: rec.readinessScore, allocationPercent: req.body.allocationPercent });
  res.json({ success: true, data: result, message: `${rec.employee.user.firstName} deployed to ${rec.project.title}.` });
});

router.post('/:recId/reject', validate(decisionSchema), async (req, res) => {
  const rec = await prisma.projectRecommendation.findFirst({ where: { id: req.params.recId, project: { organizationId: req.user.organizationId } }, include: { project: true } });
  if (!rec) throw notFound('Recommendation');
  if (rec.status !== 'SHORTLISTED') throw badRequest('Only shortlisted candidates can be rejected here');
  if (req.user.role === 'MANAGER' && rec.project.managerId !== req.user.id) throw badRequest('Only the project manager or HR can withdraw this shortlist');
  const updated = await prisma.projectRecommendation.update({ where: { id: rec.id }, data: { status: 'REJECTED', hrNote: req.body.note || null, decidedById: req.user.id, decidedAt: new Date() } });
  await audit(req, 'ASSIGNMENT_REJECTED', 'ProjectRecommendation', rec.id, { status: 'SHORTLISTED' }, { status: 'REJECTED', note: req.body.note });
  res.json({ success: true, data: updated });
});

module.exports = router;
