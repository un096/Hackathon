// Manager & HR dashboards, workforce analytics, internal-vs-external hiring insights.
// Every number here is computed from database rows of the caller's organization.
const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authorize } = require('../middleware/auth');
const { getSettings } = require('../lib/settings');
const { latestRun } = require('../engines/market');

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

router.get('/manager/dashboard', authorize('MANAGER', 'HR'), async (req, res) => {
  const orgId = req.user.organizationId;
  const team = await prisma.employee.findMany({
    where: { organizationId: orgId, managerId: req.user.id },
    include: { user: { select: { firstName: true, lastName: true } }, skills: { include: { skill: true } }, learning: { select: { status: true } } },
  });
  const projects = await prisma.project.findMany({
    where: { organizationId: orgId, OR: [{ managerId: req.user.id }, { createdById: req.user.id }] },
    include: { assignments: { where: { status: 'ACTIVE' } }, recommendations: { select: { status: true, eligible: true, nearlyReady: true } }, requirements: { include: { skill: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const skillDist = {};
  for (const e of team) for (const s of e.skills) {
    const k = s.skill.name;
    skillDist[k] = skillDist[k] || { skill: k, verified: 0, claimedOnly: 0 };
    if (s.status === 'VERIFIED') skillDist[k].verified += 1; else if (s.claimedLevel > 0) skillDist[k].claimedOnly += 1;
  }
  const pendingFeedback = team.filter((e) => e.skills.some((s) => s.claimedLevel > 0 && s.status !== 'VERIFIED'));
  res.json({
    success: true,
    data: {
      teamSize: team.length,
      teamVerifiedSkills: team.reduce((a, e) => a + e.skills.filter((s) => s.status === 'VERIFIED').length, 0),
      teamUnverifiedClaims: team.reduce((a, e) => a + e.skills.filter((s) => s.claimedLevel > 0 && s.status !== 'VERIFIED').length, 0),
      teamLearningActive: team.reduce((a, e) => a + e.learning.filter((l) => l.status !== 'COMPLETED').length, 0),
      availability: ['AVAILABLE', 'PARTIALLY_AVAILABLE', 'ON_PROJECT', 'ON_LEAVE'].map((s) => ({ status: s, count: team.filter((e) => e.availability === s).length })),
      projects: projects.map((p) => ({
        id: p.id, title: p.title, status: p.status, priority: p.priority, openPositions: p.openPositions, filled: p.assignments.length, lastMatchedAt: p.lastMatchedAt,
        eligible: p.recommendations.filter((r) => r.eligible).length, nearlyReady: p.recommendations.filter((r) => r.nearlyReady).length,
        shortlisted: p.recommendations.filter((r) => r.status === 'SHORTLISTED').length, requirements: p.requirements.map((r) => `${r.skill.name} L${r.minLevel}`),
      })),
      awaitingHr: projects.reduce((a, p) => a + p.recommendations.filter((r) => r.status === 'SHORTLISTED').length, 0),
      skillDistribution: Object.values(skillDist).sort((a, b) => b.verified + b.claimedOnly - (a.verified + a.claimedOnly)).slice(0, 10),
      needsReview: pendingFeedback.slice(0, 6).map((e) => ({ id: e.id, name: `${e.user.firstName} ${e.user.lastName}`, unverified: e.skills.filter((s) => s.claimedLevel > 0 && s.status !== 'VERIFIED').map((s) => s.skill.name) })),
    },
  });
});

router.get('/hr/dashboard', authorize('HR'), async (req, res) => {
  const orgId = req.user.organizationId;
  const [employees, skills, projects, pending, assignments, audits, learning, run] = await Promise.all([
    prisma.employee.count({ where: { organizationId: orgId, user: { isActive: true } } }),
    prisma.employeeSkill.findMany({ where: { employee: { organizationId: orgId } }, select: { status: true, claimedLevel: true, skillId: true, verifiedLevel: true } }),
    prisma.project.findMany({ where: { organizationId: orgId }, select: { id: true, status: true, openPositions: true, title: true, _count: { select: { assignments: true } } } }),
    prisma.projectRecommendation.count({ where: { status: 'SHORTLISTED', project: { organizationId: orgId } } }),
    prisma.projectAssignment.findMany({ where: { project: { organizationId: orgId } }, select: { status: true, startedAt: true } }),
    prisma.auditLog.findMany({ where: { organizationId: orgId, action: { not: 'LOGIN' } }, orderBy: { createdAt: 'desc' }, take: 8, include: { user: { select: { firstName: true, lastName: true } } } }),
    prisma.learningRecommendation.groupBy({ by: ['status'], where: { employee: { organizationId: orgId } }, _count: true }),
    latestRun(orgId),
  ]);
  const claimed = skills.filter((s) => s.claimedLevel > 0);
  const verifiedClaims = claimed.filter((s) => s.status === 'VERIFIED');
  const open = projects.filter((p) => ['OPEN', 'STAFFING', 'ACTIVE'].includes(p.status));
  const positions = open.reduce((a, p) => a + p.openPositions, 0);
  const filled = assignments.filter((a) => a.status === 'ACTIVE').length;

  let marketTop = [];
  if (run) {
    const demand = await prisma.marketSkillDemand.findMany({ where: { runId: run.id }, include: { skill: true }, orderBy: { postingCount: 'desc' }, take: 8 });
    marketTop = demand.map((d) => ({ skill: d.skill.name, demandPercent: d.demandPercent, internalVerified: skills.filter((s) => s.skillId === d.skillId && s.status === 'VERIFIED').length }));
  }
  res.json({
    success: true,
    data: {
      headcount: employees,
      verificationRate: pct(verifiedClaims.length, claimed.length),
      claimedSkills: claimed.length,
      verifiedSkills: skills.filter((s) => s.status === 'VERIFIED').length,
      projects: { total: projects.length, open: projects.filter((p) => p.status === 'OPEN').length, staffing: projects.filter((p) => p.status === 'STAFFING').length, active: projects.filter((p) => p.status === 'ACTIVE').length },
      positions, filled, internalFillRate: pct(filled, positions),
      pendingApprovals: pending,
      learning: learning.map((l) => ({ status: l.status, count: l._count })),
      marketTop, marketRun: run ? { kind: run.source.kind, source: run.source.name, rowsKept: run.rowsKept, periodStart: run.periodStart, periodEnd: run.periodEnd } : null,
      recentActivity: audits.map((a) => ({ id: a.id, action: a.action, entityType: a.entityType, at: a.createdAt, by: a.user ? `${a.user.firstName} ${a.user.lastName}` : 'System', after: a.after })),
    },
  });
});

router.get('/analytics/workforce', authorize('HR', 'MANAGER'), async (req, res) => {
  const orgId = req.user.organizationId;
  const [rows, depts, evidence, subs, learning] = await Promise.all([
    prisma.employeeSkill.findMany({ where: { employee: { organizationId: orgId, user: { isActive: true } } }, include: { skill: true, employee: { select: { departmentId: true } } } }),
    prisma.department.findMany({ where: { organizationId: orgId }, include: { employees: { select: { id: true } } } }),
    prisma.skillEvidence.findMany({ where: { employee: { organizationId: orgId } }, select: { type: true, occurredAt: true } }),
    prisma.assessmentSubmission.findMany({ where: { employee: { organizationId: orgId } }, select: { passed: true, score: true, assessment: { select: { type: true } } } }),
    prisma.learningRecommendation.findMany({ where: { employee: { organizationId: orgId } }, select: { status: true, progressPercent: true, skill: { select: { name: true } } } }),
  ]);
  const inv = {};
  for (const r of rows) {
    const k = r.skill.name;
    inv[k] = inv[k] || { skill: k, category: r.skill.category, claimed: 0, verified: 0, levels: [0, 0, 0, 0, 0], sumLevel: 0 };
    if (r.claimedLevel > 0) inv[k].claimed += 1;
    if (r.status === 'VERIFIED') { inv[k].verified += 1; inv[k].levels[r.verifiedLevel - 1] += 1; inv[k].sumLevel += r.verifiedLevel; }
  }
  const inventory = Object.values(inv).map((x) => ({ ...x, avgVerifiedLevel: x.verified ? Math.round((x.sumLevel / x.verified) * 10) / 10 : 0, sumLevel: undefined })).sort((a, b) => b.verified - a.verified || b.claimed - a.claimed);
  const levelDistribution = [1, 2, 3, 4, 5].map((l) => ({ level: `L${l}`, count: rows.filter((r) => r.status === 'VERIFIED' && r.verifiedLevel === l).length }));
  const byDept = depts.map((d) => {
    const ids = new Set(d.employees.map((e) => e.id));
    const dr = rows.filter((r) => ids.has(r.employeeId));
    const cl = dr.filter((r) => r.claimedLevel > 0);
    return { department: d.name, headcount: d.employees.length, verified: dr.filter((r) => r.status === 'VERIFIED').length, claimed: cl.length, verificationRate: pct(cl.filter((r) => r.status === 'VERIFIED').length, cl.length) };
  });
  const months = {};
  for (const e of evidence) {
    const m = new Date(e.occurredAt).toISOString().slice(0, 7);
    months[m] = months[m] || { month: m, assessments: 0, feedback: 0, projects: 0, certifications: 0 };
    if (e.type.includes('ASSESSMENT')) months[m].assessments += 1;
    else if (e.type.includes('FEEDBACK')) months[m].feedback += 1;
    else if (e.type === 'PROJECT') months[m].projects += 1;
    else months[m].certifications += 1;
  }
  const byType = (t) => subs.filter((s) => s.assessment.type === t);
  res.json({
    success: true,
    data: {
      inventory, levelDistribution, byDepartment: byDept,
      evidenceTimeline: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)),
      assessments: ['MCQ', 'PRACTICAL'].map((t) => ({ type: t, attempts: byType(t).length, passRate: pct(byType(t).filter((s) => s.passed).length, byType(t).length), avgScore: byType(t).length ? Math.round(byType(t).reduce((a, s) => a + s.score, 0) / byType(t).length) : 0 })),
      learning: ['NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REASSESSMENT', 'COMPLETED'].map((s) => ({ status: s, count: learning.filter((l) => l.status === s).length })),
      totals: { employeesWithSkills: new Set(rows.map((r) => r.employeeId)).size, claimed: rows.filter((r) => r.claimedLevel > 0).length, verified: rows.filter((r) => r.status === 'VERIFIED').length, hiddenTalent: rows.filter((r) => r.claimedLevel === 0 && r.status === 'VERIFIED').length, overClaimed: rows.filter((r) => r.status === 'VERIFIED' && r.claimedLevel > r.verifiedLevel).length },
    },
  });
});

router.get('/analytics/hiring', authorize('HR'), async (req, res) => {
  const orgId = req.user.organizationId;
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  const A = getSettings(org).hiringAssumptions;
  const projects = await prisma.project.findMany({
    where: { organizationId: orgId, status: { in: ['OPEN', 'STAFFING', 'ACTIVE'] } },
    include: { requirements: { include: { skill: true } }, recommendations: true, assignments: { where: { status: 'ACTIVE' } } },
  });
  const perProject = projects.map((p) => {
    const remaining = Math.max(0, p.openPositions - p.assignments.length);
    const eligible = p.recommendations.filter((r) => r.eligible && r.status !== 'REJECTED' && r.status !== 'APPROVED').length;
    const nearly = p.recommendations.filter((r) => r.nearlyReady && r.status !== 'REJECTED').length;
    let decision = 'FILLED';
    let externalNeeded = 0;
    if (remaining > 0) {
      if (!p.lastMatchedAt) decision = 'RUN_MATCHING';
      else if (eligible >= remaining) decision = 'DEPLOY_INTERNAL';
      else if (eligible + nearly >= remaining) decision = 'UPSKILL_INTERNAL';
      else { decision = 'EXTERNAL_HIRE'; externalNeeded = remaining - eligible - nearly; }
    }
    const internalFills = Math.min(remaining, eligible + nearly) + p.assignments.length;
    return {
      id: p.id, title: p.title, status: p.status, openPositions: p.openPositions, filled: p.assignments.length, remaining, eligible, nearlyReady: nearly,
      decision, externalNeeded, matched: !!p.lastMatchedAt, internalFills,
      requirements: p.requirements.map((r) => `${r.skill.name} L${r.minLevel}${r.isCritical ? '*' : ''}`),
    };
  });
  const internalPositions = perProject.reduce((a, p) => a + p.internalFills, 0);
  const externalPositions = perProject.reduce((a, p) => a + p.externalNeeded, 0);
  // skill-level supply for all required skills
  const reqSkills = new Map();
  for (const p of projects) for (const r of p.requirements) {
    const cur = reqSkills.get(r.skillId) || { skill: r.skill.name, maxLevel: 0, projects: 0 };
    cur.maxLevel = Math.max(cur.maxLevel, r.minLevel); cur.projects += 1; reqSkills.set(r.skillId, cur);
  }
  const supply = await Promise.all([...reqSkills.entries()].map(async ([skillId, v]) => ({
    ...v,
    verifiedAtLevel: await prisma.employeeSkill.count({ where: { skillId, status: 'VERIFIED', verifiedLevel: { gte: v.maxLevel }, employee: { organizationId: orgId } } }),
    verifiedBelow: await prisma.employeeSkill.count({ where: { skillId, status: 'VERIFIED', verifiedLevel: { lt: v.maxLevel }, employee: { organizationId: orgId } } }),
    claimedUnverified: await prisma.employeeSkill.count({ where: { skillId, status: { not: 'VERIFIED' }, claimedLevel: { gt: 0 }, employee: { organizationId: orgId } } }),
  })));
  res.json({
    success: true,
    data: {
      assumptions: A,
      assumptionsNote: 'Cost and time figures are planning assumptions configured by HR in System Settings, not market statistics.',
      perProject, supply: supply.sort((a, b) => a.verifiedAtLevel - b.verifiedAtLevel),
      summary: {
        internalPositions, externalPositions,
        estimatedSavings: internalPositions * (A.externalHireCost - A.internalRedeployCost),
        daysSavedPerHire: A.externalTimeToFillDays - A.internalTimeToDeployDays,
      },
    },
  });
});

module.exports = router;
