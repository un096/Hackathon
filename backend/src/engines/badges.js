/** Rewards: badges + points for verified growth (never for self-claims). */
const prisma = require('../lib/prisma');

const BADGES = [
  { code: 'FIRST_VERIFIED', name: 'Verified Talent', description: 'First skill verified with objective evidence', icon: 'ShieldCheck', points: 50 },
  { code: 'ASSESSMENT_ACE', name: 'Assessment Ace', description: 'Scored 90% or more in an assessment', icon: 'Trophy', points: 100 },
  { code: 'MULTI_SKILLED', name: 'Multi-Skilled', description: 'Five or more verified skills', icon: 'Layers', points: 150 },
  { code: 'LEVEL_UP', name: 'Level Up', description: 'Raised a verified level through re-assessment', icon: 'TrendingUp', points: 120 },
  { code: 'FAST_LEARNER', name: 'Gap Closer', description: 'Completed a learning plan and verified the target level', icon: 'GraduationCap', points: 150 },
  { code: 'DEPLOYED', name: 'Internal Mobility', description: 'Deployed to an internal project through TalentBridge', icon: 'Rocket', points: 200 },
  { code: 'PRACTITIONER', name: 'Practitioner', description: 'Passed a practical assessment', icon: 'Wrench', points: 80 },
];

async function award(employeeId, code, reason, tx = prisma) {
  const badge = await tx.badge.findUnique({ where: { code } });
  if (!badge) return null;
  const exists = await tx.employeeBadge.findUnique({ where: { employeeId_badgeId: { employeeId, badgeId: badge.id } } });
  if (exists) return null;
  const eb = await tx.employeeBadge.create({ data: { employeeId, badgeId: badge.id, reason } });
  await tx.employee.update({ where: { id: employeeId }, data: { points: { increment: badge.points } } });
  return { ...eb, badge };
}

/** Evaluate verification-related badges after a skill change. */
async function evaluateAfterVerification(employeeId, { before, after, submission, assessmentType }) {
  const awarded = [];
  const verifiedCount = await prisma.employeeSkill.count({ where: { employeeId, status: 'VERIFIED' } });
  if (after?.status === 'VERIFIED') awarded.push(await award(employeeId, 'FIRST_VERIFIED', 'First verified skill'));
  if (verifiedCount >= 5) awarded.push(await award(employeeId, 'MULTI_SKILLED', `${verifiedCount} verified skills`));
  if (submission && submission.score >= 90) awarded.push(await award(employeeId, 'ASSESSMENT_ACE', `Scored ${submission.score}%`));
  if (submission && submission.passed && assessmentType === 'PRACTICAL') awarded.push(await award(employeeId, 'PRACTITIONER', 'Passed a practical assessment'));
  if (before?.verifiedLevel && after?.verifiedLevel > before.verifiedLevel) awarded.push(await award(employeeId, 'LEVEL_UP', `L${before.verifiedLevel} → L${after.verifiedLevel}`));
  return awarded.filter(Boolean);
}

module.exports = { BADGES, award, evaluateAfterVerification };
