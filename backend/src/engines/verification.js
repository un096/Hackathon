/**
 * Skill Verification Engine
 * -------------------------
 * Turns evidence into a verified proficiency level. Claimed levels are never used here.
 *
 *  Evidence type          weight   level source
 *  PRACTICAL_ASSESSMENT    0.35    score -> level (controlled practical scenarios)
 *  MCQ_ASSESSMENT          0.30    score -> level
 *  PROJECT                 0.15    level demonstrated on a completed/active internal project
 *  MANAGER_FEEDBACK        0.10    manager's skill rating (1..5)
 *  TEAM_LEAD_FEEDBACK      0.05    team lead's skill rating (1..5)
 *  CERTIFICATION           0.05    verified certification (level 3 by default)
 *
 * For each type only the most recent evidence counts (re-assessment replaces the old result).
 * verifiedLevel = round(weighted mean of the levels present), capped at (best objective level + 1).
 * A skill becomes VERIFIED only when at least one objective evidence (MCQ or practical) exists;
 * otherwise it is IN_REVIEW and has no verified level. confidence = sum of weights present.
 */
const prisma = require('../lib/prisma');

const EVIDENCE_WEIGHTS = {
  PRACTICAL_ASSESSMENT: 0.35,
  MCQ_ASSESSMENT: 0.3,
  PROJECT: 0.15,
  MANAGER_FEEDBACK: 0.1,
  TEAM_LEAD_FEEDBACK: 0.05,
  CERTIFICATION: 0.05,
};
const OBJECTIVE = ['MCQ_ASSESSMENT', 'PRACTICAL_ASSESSMENT'];

function computeVerification(evidenceList) {
  const latest = {};
  for (const ev of evidenceList) {
    if (ev.level == null) continue;
    const cur = latest[ev.type];
    if (!cur || new Date(ev.occurredAt) > new Date(cur.occurredAt)) latest[ev.type] = ev;
  }
  const used = Object.values(latest);
  if (used.length === 0) return { status: 'CLAIMED', verifiedLevel: null, confidence: 0, breakdown: [] };

  let wsum = 0;
  let acc = 0;
  const breakdown = [];
  for (const ev of used) {
    const w = EVIDENCE_WEIGHTS[ev.type] || 0;
    wsum += w;
    acc += w * ev.level;
    breakdown.push({ type: ev.type, level: ev.level, score: ev.score, weight: w, title: ev.title, date: ev.occurredAt });
  }
  const objective = used.filter((e) => OBJECTIVE.includes(e.type));
  const confidence = Math.round(wsum * 100) / 100;
  if (objective.length === 0) {
    return { status: 'IN_REVIEW', verifiedLevel: null, confidence, breakdown, reason: 'No objective (assessment) evidence yet' };
  }
  const raw = acc / wsum;
  const cap = Math.max(...objective.map((e) => e.level)) + 1;
  const verifiedLevel = Math.max(1, Math.min(5, Math.round(raw), cap));
  return { status: 'VERIFIED', verifiedLevel, confidence, rawScore: Math.round(raw * 100) / 100, breakdown };
}

/** Recompute and persist the verification for one employee+skill. Returns { before, after }. */
async function recomputeSkill(employeeId, skillId, tx = prisma) {
  const evidence = await tx.skillEvidence.findMany({ where: { employeeId, skillId } });
  const result = computeVerification(evidence);
  const existing = await tx.employeeSkill.findUnique({ where: { employeeId_skillId: { employeeId, skillId } } });
  const data = {
    status: result.status,
    verifiedLevel: result.verifiedLevel,
    confidence: result.confidence,
    verificationNotes: { breakdown: result.breakdown, rawScore: result.rawScore ?? null, reason: result.reason ?? null },
    lastVerifiedAt: result.status === 'VERIFIED' ? new Date() : existing?.lastVerifiedAt ?? null,
  };
  const after = existing
    ? await tx.employeeSkill.update({ where: { id: existing.id }, data })
    : await tx.employeeSkill.create({ data: { employeeId, skillId, claimedLevel: 0, ...data } }); // 0 = not self-claimed
  return { before: existing, after };
}

module.exports = { computeVerification, recomputeSkill, EVIDENCE_WEIGHTS };
