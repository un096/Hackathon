// Skill assessments: MCQ + controlled practical scenarios (auto-graded against a fixed key,
// no untrusted code execution). Each submission becomes SkillEvidence and re-runs verification.
const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { authorize } = require('../middleware/auth');
const { audit } = require('../lib/audit');
const { notFound, badRequest } = require('../lib/errors');
const { scoreToLevel } = require('../lib/levels');
const { recomputeSkill } = require('../engines/verification');
const { evaluateAfterVerification, award } = require('../engines/badges');

router.get('/', async (req, res) => {
  const { organizationId, employeeId } = req.user;
  const [assessments, subs, mySkills] = await Promise.all([
    prisma.assessment.findMany({ where: { organizationId, isActive: true }, include: { skill: true, _count: { select: { questions: true } } }, orderBy: [{ skill: { name: 'asc' } }, { type: 'asc' }] }),
    employeeId ? prisma.assessmentSubmission.findMany({ where: { employeeId }, orderBy: { submittedAt: 'desc' } }) : [],
    employeeId ? prisma.employeeSkill.findMany({ where: { employeeId } }) : [],
  ]);
  const skillBy = new Map(mySkills.map((s) => [s.skillId, s]));
  res.json({
    success: true,
    data: assessments.map((a) => {
      const mine = subs.filter((s) => s.assessmentId === a.id);
      const s = skillBy.get(a.skillId);
      return {
        id: a.id, title: a.title, type: a.type, description: a.description, durationMins: a.durationMins, passingScore: a.passingScore,
        skill: { id: a.skill.id, name: a.skill.name, category: a.skill.category }, questionCount: a._count.questions,
        attempts: mine.length, lastScore: mine[0]?.score ?? null, lastPassed: mine[0]?.passed ?? null, lastSubmissionId: mine[0]?.id ?? null,
        bestScore: mine.length ? Math.max(...mine.map((m) => m.score)) : null,
        claimedLevel: s?.claimedLevel || 0, verifiedLevel: s?.verifiedLevel || null, recommended: !!s && s.claimedLevel > 0 && s.status !== 'VERIFIED',
      };
    }),
  });
});

// Questions WITHOUT answer keys
router.get('/:id/start', authorize('EMPLOYEE', 'MANAGER', 'HR'), async (req, res) => {
  const a = await prisma.assessment.findFirst({
    where: { id: req.params.id, organizationId: req.user.organizationId, isActive: true },
    include: { skill: true, questions: { orderBy: { position: 'asc' }, select: { id: true, prompt: true, codeSnippet: true, options: true, difficulty: true, position: true } } },
  });
  if (!a) throw notFound('Assessment');
  await audit(req, 'ASSESSMENT_STARTED', 'Assessment', a.id, null, { title: a.title });
  res.json({ success: true, data: { ...a, startedAt: new Date().toISOString() } });
});

const submitSchema = z.object({
  answers: z.array(z.object({ questionId: z.string().uuid(), selectedIndex: z.number().int().min(-1).max(10) })).min(1).max(100),
  timeTakenSecs: z.number().int().min(0).max(36000).optional(),
});

router.post('/:id/submit', validate(submitSchema), async (req, res) => {
  const { employeeId, organizationId } = req.user;
  if (!employeeId) throw badRequest('Only users with a Skill Passport can take assessments');
  const a = await prisma.assessment.findFirst({ where: { id: req.params.id, organizationId, isActive: true }, include: { questions: true, skill: true } });
  if (!a) throw notFound('Assessment');

  // Grade server-side (difficulty weighted)
  const answerBy = new Map(req.body.answers.map((x) => [x.questionId, x.selectedIndex]));
  let wTot = 0;
  let wOk = 0;
  let correct = 0;
  const graded = a.questions.sort((x, y) => x.position - y.position).map((q) => {
    const sel = answerBy.has(q.id) ? answerBy.get(q.id) : -1;
    const ok = sel === q.correctIndex;
    wTot += q.difficulty;
    if (ok) { wOk += q.difficulty; correct += 1; }
    return { questionId: q.id, selectedIndex: sel, correct: ok };
  });
  const score = Math.round((wOk / wTot) * 1000) / 10;
  const passed = score >= a.passingScore;
  // MCQ alone can evidence at most L4; Expert (L5) needs a practical assessment.
  const levelAwarded = a.type === 'MCQ' ? Math.min(scoreToLevel(score), 4) : scoreToLevel(score);
  const attempt = (await prisma.assessmentSubmission.count({ where: { assessmentId: a.id, employeeId } })) + 1;

  const submission = await prisma.assessmentSubmission.create({
    data: { assessmentId: a.id, employeeId, answers: graded, correctCount: correct, totalCount: a.questions.length, score, passed, levelAwarded, attempt, timeTakenSecs: req.body.timeTakenSecs },
  });
  await prisma.skillEvidence.create({
    data: {
      employeeId, skillId: a.skillId, type: a.type === 'MCQ' ? 'MCQ_ASSESSMENT' : 'PRACTICAL_ASSESSMENT', title: `${a.title} (attempt ${attempt})`,
      score, level: levelAwarded, sourceId: submission.id, reviewerName: 'TalentBridge auto-grader', details: { correct, total: a.questions.length, passed },
    },
  });
  const { before, after } = await recomputeSkill(employeeId, a.skillId);
  const badges = await evaluateAfterVerification(employeeId, { before, after, submission, assessmentType: a.type });

  // Close the learning loop: reassessment that reaches the target level completes the plan
  let learningUpdate = null;
  const plan = await prisma.learningRecommendation.findUnique({ where: { employeeId_skillId: { employeeId, skillId: a.skillId } } });
  if (plan && plan.status !== 'COMPLETED') {
    const reached = (after.verifiedLevel || 0) >= plan.targetLevel;
    learningUpdate = await prisma.learningRecommendation.update({
      where: { id: plan.id },
      data: reached ? { status: 'COMPLETED', progressPercent: 100 } : { status: plan.progressPercent > 0 ? 'IN_PROGRESS' : plan.status },
    });
    await prisma.learningProgress.create({ data: { learningRecommendationId: plan.id, employeeId, event: 'REASSESSED', progressPercent: learningUpdate.progressPercent, note: `Score ${score}%, verified L${after.verifiedLevel || 0} (target L${plan.targetLevel})` } });
    if (reached) { const b = await award(employeeId, 'FAST_LEARNER', `Closed ${a.skill.name} gap to L${plan.targetLevel}`); if (b) badges.push(b); }
  }

  await audit(req, 'ASSESSMENT_SUBMITTED', 'AssessmentSubmission', submission.id,
    { verifiedLevel: before?.verifiedLevel ?? null, status: before?.status ?? null },
    { assessment: a.title, score, passed, verifiedLevel: after.verifiedLevel, status: after.status });

  res.status(201).json({ success: true, data: { submissionId: submission.id, score, passed, levelAwarded, before: before ? { verifiedLevel: before.verifiedLevel, status: before.status } : null, after: { verifiedLevel: after.verifiedLevel, status: after.status, confidence: after.confidence }, badges, learningUpdate } });
});

router.get('/submissions/:id', async (req, res) => {
  const sub = await prisma.assessmentSubmission.findFirst({
    where: { id: req.params.id, employee: { organizationId: req.user.organizationId } },
    include: { assessment: { include: { skill: true, questions: { orderBy: { position: 'asc' } } } }, employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  if (!sub) throw notFound('Submission');
  // employees may only view their own results; managers/HR may view any in their org
  if (req.user.role === 'EMPLOYEE' && sub.employeeId !== req.user.employeeId) throw notFound('Submission');
  const es = await prisma.employeeSkill.findUnique({ where: { employeeId_skillId: { employeeId: sub.employeeId, skillId: sub.assessment.skillId } } });
  const answerBy = new Map(sub.answers.map((x) => [x.questionId, x]));
  res.json({
    success: true,
    data: {
      id: sub.id, score: sub.score, passed: sub.passed, levelAwarded: sub.levelAwarded, attempt: sub.attempt, correctCount: sub.correctCount, totalCount: sub.totalCount,
      timeTakenSecs: sub.timeTakenSecs, submittedAt: sub.submittedAt, employee: `${sub.employee.user.firstName} ${sub.employee.user.lastName}`,
      assessment: { id: sub.assessment.id, title: sub.assessment.title, type: sub.assessment.type, passingScore: sub.assessment.passingScore, skill: sub.assessment.skill.name },
      skillStatus: es ? { claimedLevel: es.claimedLevel, verifiedLevel: es.verifiedLevel, status: es.status, confidence: es.confidence, breakdown: es.verificationNotes?.breakdown || [] } : null,
      questions: sub.assessment.questions.map((q) => ({ id: q.id, prompt: q.prompt, codeSnippet: q.codeSnippet, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation, selectedIndex: answerBy.get(q.id)?.selectedIndex ?? -1, correct: answerBy.get(q.id)?.correct ?? false })),
    },
  });
});

module.exports = router;
