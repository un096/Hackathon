// Team directory, employee review, feedback & certification verification (MANAGER, HR);
// employee creation / management (HR only).
const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { audit } = require('../lib/audit');
const { ApiError, notFound, badRequest, forbidden } = require('../lib/errors');
const { loadPassport, getEmployeeInOrg } = require('../lib/queries');
const { recomputeSkill } = require('../engines/verification');
const { evaluateAfterVerification } = require('../engines/badges');

router.use(authorize('MANAGER', 'HR'));

const listQuery = z.object({
  scope: z.enum(['team', 'all']).default('team'),
  q: z.string().max(100).optional(),
  departmentId: z.string().uuid().optional(),
  availability: z.enum(['AVAILABLE', 'PARTIALLY_AVAILABLE', 'ON_PROJECT', 'ON_LEAVE']).optional(),
  skillId: z.string().uuid().optional(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR']).optional(),
});

router.get('/', validate(listQuery, 'query'), async (req, res) => {
  const q = req.validQuery;
  const where = { organizationId: req.user.organizationId };
  if (req.user.role === 'MANAGER' && q.scope === 'team') where.managerId = req.user.id;
  if (q.departmentId) where.departmentId = q.departmentId;
  if (q.availability) where.availability = q.availability;
  if (q.role) where.user = { role: q.role };
  if (q.skillId) where.skills = { some: { skillId: q.skillId, status: 'VERIFIED' } };
  if (q.q) {
    where.OR = [
      { user: { firstName: { contains: q.q, mode: 'insensitive' } } },
      { user: { lastName: { contains: q.q, mode: 'insensitive' } } },
      { user: { email: { contains: q.q, mode: 'insensitive' } } },
      { designation: { contains: q.q, mode: 'insensitive' } },
      { skills: { some: { skill: { name: { contains: q.q, mode: 'insensitive' } } } } },
    ];
  }
  const rows = await prisma.employee.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true } },
      department: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      skills: { include: { skill: { select: { name: true } } } },
      _count: { select: { assignments: true, badges: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  });
  res.json({
    success: true,
    data: rows.map((e) => ({
      id: e.id, userId: e.user.id, employeeCode: e.employeeCode, name: `${e.user.firstName} ${e.user.lastName}`, email: e.user.email, role: e.user.role, isActive: e.user.isActive,
      designation: e.designation, department: e.department?.name || null, departmentId: e.departmentId, manager: e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : null, managerId: e.managerId,
      experienceYears: e.experienceYears, availability: e.availability, allocationPercent: e.allocationPercent, location: e.location, points: e.points,
      verifiedCount: e.skills.filter((s) => s.status === 'VERIFIED').length, claimedCount: e.skills.filter((s) => s.claimedLevel > 0).length,
      topSkills: e.skills.filter((s) => s.status === 'VERIFIED').sort((a, b) => b.verifiedLevel - a.verifiedLevel).slice(0, 4).map((s) => ({ name: s.skill.name, level: s.verifiedLevel })),
      assignments: e._count.assignments, badges: e._count.badges,
    })),
  });
});

router.get('/:id', async (req, res) => {
  const p = await loadPassport(req.params.id, req.user.organizationId);
  const recs = await prisma.projectRecommendation.findMany({ where: { employeeId: p.id }, include: { project: { select: { id: true, title: true, status: true } } }, orderBy: { readinessScore: 'desc' } });
  const learning = await prisma.learningRecommendation.findMany({ where: { employeeId: p.id }, include: { skill: true } });
  res.json({ success: true, data: { ...p, recommendations: recs, learning, isDirectReport: p.managerId === req.user.id } });
});

// Manager / team-lead feedback -> evidence
const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5).max(2000),
  reviewerRole: z.enum(['MANAGER', 'TEAM_LEAD']).default('MANAGER'),
  context: z.string().trim().max(200).optional(),
  skillRatings: z.array(z.object({ skillId: z.string().uuid(), level: z.number().int().min(1).max(5) })).max(20).default([]),
});
router.post('/:id/feedback', validate(feedbackSchema), async (req, res) => {
  const emp = await getEmployeeInOrg(req.params.id, req.user.organizationId);
  if (emp.userId === req.user.id) throw forbidden('You cannot give feedback on your own Skill Passport');
  const b = req.body;
  const reviewerName = `${req.user.firstName} ${req.user.lastName}`;
  const fb = await prisma.managerFeedback.create({ data: { employeeId: emp.id, reviewerId: req.user.id, reviewerRole: b.reviewerRole, rating: b.rating, comment: b.comment, context: b.context, skillRatings: b.skillRatings } });
  const results = [];
  for (const sr of b.skillRatings) {
    const skill = await prisma.skill.findUnique({ where: { id: sr.skillId } });
    if (!skill) continue;
    await prisma.skillEvidence.create({
      data: {
        employeeId: emp.id, skillId: sr.skillId, type: b.reviewerRole === 'TEAM_LEAD' ? 'TEAM_LEAD_FEEDBACK' : 'MANAGER_FEEDBACK',
        title: `${b.reviewerRole === 'TEAM_LEAD' ? 'Team lead' : 'Manager'} rating: ${skill.name}`, level: sr.level, score: sr.level * 20,
        reviewerId: req.user.id, reviewerName, sourceId: fb.id, details: { comment: b.comment, context: b.context || null },
      },
    });
    const r = await recomputeSkill(emp.id, sr.skillId);
    await evaluateAfterVerification(emp.id, r);
    results.push({ skill: skill.name, verifiedLevel: r.after.verifiedLevel, status: r.after.status });
  }
  await audit(req, 'FEEDBACK_RECORDED', 'Employee', emp.id, null, { rating: b.rating, reviewerRole: b.reviewerRole, skills: results });
  res.status(201).json({ success: true, data: { feedback: fb, skillUpdates: results } });
});

router.post('/:id/certifications/:certId/verify', validate(z.object({ level: z.number().int().min(1).max(5).default(3) })), async (req, res) => {
  const emp = await getEmployeeInOrg(req.params.id, req.user.organizationId);
  const cert = await prisma.certification.findFirst({ where: { id: req.params.certId, employeeId: emp.id } });
  if (!cert) throw notFound('Certification');
  if (cert.isVerified) throw badRequest('Certification already verified');
  await prisma.certification.update({ where: { id: cert.id }, data: { isVerified: true, verifiedById: req.user.id } });
  let update = null;
  if (cert.skillId) {
    await prisma.skillEvidence.create({ data: { employeeId: emp.id, skillId: cert.skillId, type: 'CERTIFICATION', title: `${cert.name} (${cert.issuer})`, level: req.body.level, reviewerId: req.user.id, reviewerName: `${req.user.firstName} ${req.user.lastName}`, sourceId: cert.id } });
    update = (await recomputeSkill(emp.id, cert.skillId)).after;
  }
  await audit(req, 'CERTIFICATION_VERIFIED', 'Certification', cert.id, { isVerified: false }, { isVerified: true, name: cert.name });
  res.json({ success: true, data: { certificationId: cert.id, skillUpdate: update } });
});

// ── HR: employee management ────────────────────────────────
const createSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR']).default('EMPLOYEE'),
  designation: z.string().trim().max(100).optional(),
  departmentId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  experienceYears: z.number().min(0).max(50).default(0),
  location: z.string().trim().max(100).optional(),
});
router.post('/', authorize('HR'), validate(createSchema), async (req, res) => {
  const b = req.body;
  const orgId = req.user.organizationId;
  if (await prisma.user.findUnique({ where: { email: b.email } })) throw new ApiError(409, 'A user with this email already exists');
  if (b.departmentId && !(await prisma.department.findFirst({ where: { id: b.departmentId, organizationId: orgId } }))) throw badRequest('Unknown department');
  if (b.managerId && !(await prisma.user.findFirst({ where: { id: b.managerId, organizationId: orgId, role: { in: ['MANAGER', 'HR'] } } }))) throw badRequest('Manager must be a MANAGER/HR user in your organization');
  const tempPassword = `Tb-${crypto.randomBytes(4).toString('hex')}9`;
  const count = await prisma.employee.count({ where: { organizationId: orgId } });
  const user = await prisma.user.create({
    data: {
      organizationId: orgId, email: b.email, role: b.role, firstName: b.firstName, lastName: b.lastName, passwordHash: await bcrypt.hash(tempPassword, 12),
      employee: { create: { organizationId: orgId, employeeCode: `EMP-${String(count + 1).padStart(4, '0')}`, designation: b.designation, departmentId: b.departmentId || null, managerId: b.managerId || null, experienceYears: b.experienceYears, location: b.location } },
    },
    include: { employee: true },
  });
  await audit(req, 'EMPLOYEE_CREATED', 'User', user.id, null, { email: user.email, role: user.role });
  res.status(201).json({ success: true, data: { userId: user.id, employeeId: user.employee.id, email: user.email, tempPassword }, message: 'Share the temporary password securely; the user should change it after first login.' });
});

const updateSchema = z.object({
  designation: z.string().trim().max(100).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  experienceYears: z.number().min(0).max(50).optional(),
  availability: z.enum(['AVAILABLE', 'PARTIALLY_AVAILABLE', 'ON_PROJECT', 'ON_LEAVE']).optional(),
  allocationPercent: z.number().int().min(0).max(100).optional(),
  location: z.string().trim().max(100).optional(),
});
router.put('/:id', authorize('HR'), validate(updateSchema), async (req, res) => {
  const emp = await getEmployeeInOrg(req.params.id, req.user.organizationId);
  const b = req.body;
  if (b.departmentId && !(await prisma.department.findFirst({ where: { id: b.departmentId, organizationId: req.user.organizationId } }))) throw badRequest('Unknown department');
  if (b.managerId && !(await prisma.user.findFirst({ where: { id: b.managerId, organizationId: req.user.organizationId, role: { in: ['MANAGER', 'HR'] } } }))) throw badRequest('Invalid manager');
  const updated = await prisma.employee.update({ where: { id: emp.id }, data: b });
  await audit(req, 'EMPLOYEE_UPDATED', 'Employee', emp.id, Object.fromEntries(Object.keys(b).map((k) => [k, emp[k]])), b);
  res.json({ success: true, data: updated });
});

module.exports = router;
