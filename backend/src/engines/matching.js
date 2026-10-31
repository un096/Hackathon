/**
 * AI Talent Matching Engine (deterministic, explainable)
 * ------------------------------------------------------
 * Readiness (0-100) = 40% Verified Skill Match + 25% Practical Assessment + 15% Relevant Experience
 *                   + 10% Documented Feedback + 10% Availability          (weights configurable by HR)
 *
 * Mandatory thresholds: every CRITICAL requirement must be met by a VERIFIED level >= minLevel,
 * otherwise the candidate is NOT eligible regardless of total score. Claimed levels never count.
 * Ranking is computed here in code; an LLM is never used to rank or deploy anyone.
 */
const prisma = require('../lib/prisma');
const { getSettings } = require('../lib/settings');
const { LEVELS } = require('../lib/levels');

const AVAILABILITY_SCORE = { AVAILABLE: 100, PARTIALLY_AVAILABLE: 60, ON_PROJECT: 20, ON_LEAVE: 0 };
const round = (n) => Math.round(n * 10) / 10;

/** Skill Gap Engine: compare verified skills against requirements. */
function computeGap(employeeSkills, requirements) {
  const bySkill = new Map(employeeSkills.map((s) => [s.skillId, s]));
  const items = requirements.map((req) => {
    const es = bySkill.get(req.skillId);
    const verified = es?.status === 'VERIFIED' ? es.verifiedLevel || 0 : 0;
    const claimed = es?.claimedLevel || 0;
    let state = 'MET';
    if (verified === 0) state = claimed > 0 ? 'UNVERIFIED' : 'MISSING';
    else if (verified < req.minLevel) state = 'BELOW';
    return {
      skillId: req.skillId,
      skillName: req.skill?.name,
      required: req.minLevel,
      verified,
      claimed,
      critical: req.isCritical,
      weight: req.weight,
      gap: Math.max(0, req.minLevel - verified),
      state,
    };
  });
  const matched = items.filter((i) => i.state === 'MET');
  const criticalUnmet = items.filter((i) => i.critical && i.state !== 'MET');
  return {
    items,
    matched,
    missing: items.filter((i) => i.state === 'MISSING' || i.state === 'UNVERIFIED'),
    below: items.filter((i) => i.state === 'BELOW'),
    criticalUnmet,
    totalGapLevels: items.reduce((a, i) => a + i.gap, 0),
    criticalGapLevels: criticalUnmet.reduce((a, i) => a + i.gap, 0),
    coveragePercent: items.length ? Math.round((matched.length / items.length) * 100) : 0,
  };
}

function scoreCandidate(emp, project, settings) {
  const reqs = project.requirements;
  const W = settings.matchingWeights;
  const gap = computeGap(emp.skills, reqs);
  const reqIds = new Set(reqs.map((r) => r.skillId));

  // 1. Verified skill match
  let wTot = 0;
  let wAcc = 0;
  for (const it of gap.items) {
    const w = (it.weight || 1) * (it.critical ? 1.5 : 1);
    wTot += w;
    wAcc += w * Math.min(it.verified / it.required, 1);
  }
  const skillMatch = wTot ? (wAcc / wTot) * 100 : 0;

  // 2. Practical assessment: latest practical score per required skill (missing = 0)
  const practicalBySkill = {};
  for (const ev of emp.evidence) {
    if (ev.type !== 'PRACTICAL_ASSESSMENT' || !reqIds.has(ev.skillId)) continue;
    const cur = practicalBySkill[ev.skillId];
    if (!cur || new Date(ev.occurredAt) > new Date(cur.occurredAt)) practicalBySkill[ev.skillId] = ev;
  }
  const practicalScores = reqs.map((r) => practicalBySkill[r.skillId]?.score || 0);
  const practical = reqs.length ? practicalScores.reduce((a, b) => a + b, 0) / reqs.length : 0;
  const practicalCovered = Object.keys(practicalBySkill).length;

  // 3. Relevant experience: years vs project minimum (60) + internal project history using required skills (40)
  const minExp = Math.max(project.minExperience || 0, 1);
  const yearsPart = Math.min(emp.experienceYears / minExp, 1) * 60;
  const relevantSkillIds = new Set();
  let relevantProjects = 0;
  for (const a of emp.assignments) {
    if (a.projectId === project.id) continue;
    const used = (a.skillsUsed || []).map((s) => s.skillId).filter((id) => reqIds.has(id));
    if (used.length) {
      relevantProjects += 1;
      used.forEach((id) => relevantSkillIds.add(id));
    }
  }
  emp.evidence.filter((e) => e.type === 'PROJECT' && reqIds.has(e.skillId)).forEach((e) => relevantSkillIds.add(e.skillId));
  const historyPart = reqs.length ? Math.min(relevantSkillIds.size / reqs.length, 1) * 40 : 0;
  const experience = yearsPart + historyPart;

  // 4. Documented feedback: skill-specific ratings for required skills if present, else overall rating
  const skillRatings = [];
  const overall = [];
  for (const f of emp.feedback) {
    overall.push(f.rating);
    for (const sr of f.skillRatings || []) if (reqIds.has(sr.skillId)) skillRatings.push(sr.level);
  }
  const fbSource = skillRatings.length ? skillRatings : overall;
  const feedback = fbSource.length ? (fbSource.reduce((a, b) => a + b, 0) / fbSource.length / 5) * 100 : 0;

  // 5. Availability
  let availability = AVAILABILITY_SCORE[emp.availability] ?? 0;
  if (emp.availability === 'PARTIALLY_AVAILABLE') availability = Math.max(0, 100 - (emp.allocationPercent || 40));

  const readiness =
    (W.skillMatch * skillMatch + W.practical * practical + W.experience * experience + W.feedback * feedback + W.availability * availability) /
    (W.skillMatch + W.practical + W.experience + W.feedback + W.availability);

  const blockers = [];
  for (const c of gap.criticalUnmet) {
    blockers.push(
      c.verified === 0
        ? `Critical skill ${c.skillName} has no verified level${c.claimed ? ` (claimed L${c.claimed}, not yet proven)` : ''}; requires L${c.required}`
        : `Critical skill ${c.skillName} verified at L${c.verified}, below required L${c.required}`
    );
  }
  if (emp.availability === 'ON_LEAVE') blockers.push('Employee is currently on leave');
  const eligible = blockers.length === 0;
  const nearlyReady =
    !eligible && emp.availability !== 'ON_LEAVE' && gap.criticalGapLevels <= settings.nearlyReadyMaxGap && skillMatch >= 50;

  // Human-readable explanation built from the numbers (no LLM involved)
  const strengths = [];
  for (const m of gap.matched) strengths.push(`${m.skillName}: verified L${m.verified} (${LEVELS[m.verified]}) meets required L${m.required}`);
  if (practical >= 70) strengths.push(`Strong practical assessment average (${round(practical)}/100) across required skills`);
  if (relevantProjects) strengths.push(`${relevantProjects} previous internal project(s) used required skills`);
  if (feedback >= 80) strengths.push(`Documented feedback averages ${round((feedback / 100) * 5)}/5`);
  const concerns = [];
  for (const b of gap.below) if (!b.critical) concerns.push(`${b.skillName}: verified L${b.verified}, required L${b.required}`);
  for (const m of gap.missing) if (!m.critical) concerns.push(`${m.skillName}: ${m.claimed ? `claimed L${m.claimed} but not verified` : 'no evidence'}; required L${m.required}`);
  if (practicalCovered < reqs.length) concerns.push(`Practical assessment missing for ${reqs.length - practicalCovered} of ${reqs.length} required skills`);
  if (!fbSource.length) concerns.push('No documented manager/team-lead feedback');
  if (emp.availability !== 'AVAILABLE') concerns.push(`Availability: ${emp.availability.replace(/_/g, ' ').toLowerCase()}`);

  const name = `${emp.user.firstName} ${emp.user.lastName}`;
  const summary = eligible
    ? `${name} meets every critical requirement with verified evidence and scores ${round(readiness)}/100 readiness.`
    : nearlyReady
      ? `${name} is close to ready: ${gap.criticalGapLevels} level(s) short on critical skills. Targeted upskilling is recommended before deployment.`
      : `${name} is not eligible yet: ${blockers[0] || 'critical requirements not met'}.`;

  return {
    employeeId: emp.id,
    readinessScore: round(readiness),
    skillMatchScore: round(skillMatch),
    practicalScore: round(practical),
    experienceScore: round(experience),
    feedbackScore: round(feedback),
    availabilityScore: round(availability),
    eligible,
    nearlyReady,
    explanation: {
      summary,
      strengths,
      concerns,
      blockers,
      gap: gap.items,
      weights: W,
      components: {
        skillMatch: { score: round(skillMatch), weight: W.skillMatch, contribution: round((skillMatch * W.skillMatch) / 100) },
        practical: { score: round(practical), weight: W.practical, contribution: round((practical * W.practical) / 100) },
        experience: {
          score: round(experience), weight: W.experience, contribution: round((experience * W.experience) / 100),
          detail: `${emp.experienceYears} yrs vs ${project.minExperience} required; ${relevantSkillIds.size}/${reqs.length} required skills used on past projects`,
        },
        feedback: { score: round(feedback), weight: W.feedback, contribution: round((feedback * W.feedback) / 100) },
        availability: { score: round(availability), weight: W.availability, contribution: round((availability * W.availability) / 100) },
      },
      method: 'deterministic-weighted-v1',
    },
  };
}

const employeeInclude = {
  user: { select: { firstName: true, lastName: true, email: true, role: true, isActive: true } },
  department: { select: { name: true } },
  skills: { include: { skill: { select: { name: true } } } },
  evidence: { select: { type: true, skillId: true, score: true, level: true, occurredAt: true } },
  feedback: { select: { rating: true, skillRatings: true } },
  assignments: { select: { projectId: true, skillsUsed: true, status: true } },
};

/** Run matching for a project, persist ranked recommendations (keeps decisions already taken). */
async function runMatching(projectId, organizationId) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    include: { requirements: { include: { skill: true } }, organization: true },
  });
  if (!project) return null;
  const settings = getSettings(project.organization);
  const employees = await prisma.employee.findMany({
    where: { organizationId, user: { isActive: true, role: { in: ['EMPLOYEE', 'MANAGER'] } } },
    include: employeeInclude,
  });

  const assignedIds = new Set(
    (await prisma.projectAssignment.findMany({ where: { projectId }, select: { employeeId: true } })).map((a) => a.employeeId)
  );
  const scored = employees.filter((e) => !assignedIds.has(e.id)).map((e) => ({ emp: e, ...scoreCandidate(e, project, settings) }));

  scored.sort((a, b) => {
    const tier = (x) => (x.eligible ? 0 : x.nearlyReady ? 1 : 2);
    return tier(a) - tier(b) || b.readinessScore - a.readinessScore || b.skillMatchScore - a.skillMatchScore;
  });

  const existing = await prisma.projectRecommendation.findMany({ where: { projectId } });
  const existingBy = new Map(existing.map((r) => [r.employeeId, r]));
  const keepIds = new Set(scored.map((s) => s.employeeId));

  await prisma.$transaction(async (tx) => {
    // drop stale machine recommendations for people who are now assigned
    await tx.projectRecommendation.deleteMany({ where: { projectId, status: 'RECOMMENDED', employeeId: { notIn: [...keepIds] } } });
    let rank = 0;
    for (const s of scored) {
      rank += 1;
      const { emp, ...data } = s;
      const prev = existingBy.get(s.employeeId);
      const payload = { ...data, rank };
      if (prev) await tx.projectRecommendation.update({ where: { id: prev.id }, data: payload });
      else await tx.projectRecommendation.create({ data: { projectId, ...payload } });
    }
    await tx.project.update({
      where: { id: projectId },
      data: { lastMatchedAt: new Date(), status: project.status === 'OPEN' || project.status === 'DRAFT' ? 'STAFFING' : project.status },
    });
  });

  return {
    project,
    totalEvaluated: scored.length,
    eligible: scored.filter((s) => s.eligible).length,
    nearlyReady: scored.filter((s) => s.nearlyReady).length,
  };
}

module.exports = { computeGap, scoreCandidate, runMatching, employeeInclude, AVAILABILITY_SCORE };
