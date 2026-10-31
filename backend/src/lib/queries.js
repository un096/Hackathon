// Shared, organisation-scoped data loaders.
const prisma = require('./prisma');
const { notFound } = require('./errors');
const { employeeInclude, scoreCandidate } = require('../engines/matching');
const { getSettings } = require('./settings');

async function getEmployeeInOrg(employeeId, organizationId) {
  const e = await prisma.employee.findFirst({ where: { id: employeeId, organizationId } });
  if (!e) throw notFound('Employee');
  return e;
}

async function getProjectInOrg(projectId, organizationId, include) {
  const p = await prisma.project.findFirst({ where: { id: projectId, organizationId }, include });
  if (!p) throw notFound('Project');
  return p;
}

/** Full Skill Passport for one employee (claimed and verified kept separate). */
async function loadPassport(employeeId, organizationId) {
  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, role: true } },
      department: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      skills: { include: { skill: true }, orderBy: [{ status: 'desc' }, { verifiedLevel: 'desc' }] },
      evidence: { include: { skill: { select: { name: true } } }, orderBy: { occurredAt: 'desc' } },
      certifications: { orderBy: { createdAt: 'desc' } },
      feedback: { include: { reviewer: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } },
      assignments: { include: { project: { select: { id: true, title: true, status: true } } }, orderBy: { startedAt: 'desc' } },
      badges: { include: { badge: true }, orderBy: { awardedAt: 'desc' } },
      submissions: { include: { assessment: { select: { title: true, type: true, skillId: true } } }, orderBy: { submittedAt: 'desc' }, take: 20 },
    },
  });
  if (!emp) throw notFound('Employee');
  const verified = emp.skills.filter((s) => s.status === 'VERIFIED');
  return {
    ...emp,
    summary: {
      claimedCount: emp.skills.filter((s) => s.claimedLevel > 0).length,
      verifiedCount: verified.length,
      inReviewCount: emp.skills.filter((s) => s.status === 'IN_REVIEW').length,
      unverifiedClaims: emp.skills.filter((s) => s.claimedLevel > 0 && s.status !== 'VERIFIED').length,
      avgVerifiedLevel: verified.length ? Math.round((verified.reduce((a, s) => a + s.verifiedLevel, 0) / verified.length) * 10) / 10 : 0,
      evidenceCount: emp.evidence.length,
    },
  };
}

/** Score one employee against several projects live (used for opportunities and gap analysis). */
async function scoreEmployeeForProjects(employeeId, organizationId, projectWhere = {}) {
  const [emp, projects, org] = await Promise.all([
    prisma.employee.findFirst({ where: { id: employeeId, organizationId }, include: employeeInclude }),
    prisma.project.findMany({
      where: { organizationId, ...projectWhere },
      include: { requirements: { include: { skill: true } }, manager: { select: { firstName: true, lastName: true } }, department: true, _count: { select: { assignments: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.organization.findUnique({ where: { id: organizationId } }),
  ]);
  if (!emp) throw notFound('Employee');
  const settings = getSettings(org);
  return projects.map((p) => ({ project: p, score: scoreCandidate(emp, p, settings) }));
}

module.exports = { getEmployeeInOrg, getProjectInOrg, loadPassport, scoreEmployeeForProjects };
