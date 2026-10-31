/**
 * Learning Recommendation Engine
 * Builds a personalised plan per real skill gap (verified level < required level).
 * Resources come from the curated skill dictionary (official documentation links);
 * practical tasks are generated from level templates. Gemini (via the AI service) may
 * rewrite the explanation text only — never the gap, target or priority.
 */
const prisma = require('../lib/prisma');
const { byName } = require('../lib/dictionary');
const { LEVELS } = require('../lib/levels');
const ai = require('../lib/aiClient');
const { getSettings } = require('../lib/settings');

const TASK_TEMPLATES = {
  2: ['Complete the official getting-started guide for {skill}', 'Build a small exercise using core {skill} features', 'Write notes on 5 key {skill} concepts'],
  3: ['Build a mini feature with {skill} following team conventions', 'Read and refactor an existing {skill} module from an internal repo', 'Pass the {skill} MCQ assessment at 60%+'],
  4: ['Implement a production-style component/service with {skill} including tests', 'Review a peer\'s {skill} pull request and document improvements', 'Pass the {skill} practical assessment at 75%+'],
  5: ['Design and present a {skill} architecture decision for a real project', 'Mentor a colleague through a {skill} task', 'Pass the {skill} practical assessment at 90%+'],
};

function buildTasks(skillName, current, target) {
  const tasks = [];
  for (let lvl = Math.max(current + 1, 2); lvl <= target; lvl += 1) {
    for (const t of TASK_TEMPLATES[lvl] || []) tasks.push({ id: `L${lvl}-${tasks.length + 1}`, level: lvl, title: t.replace('{skill}', skillName), done: false });
  }
  if (!tasks.length) tasks.push({ id: 'L-refresh', level: target, title: `Refresh ${skillName} fundamentals and re-take the assessment`, done: false });
  return tasks;
}

function buildResources(skillName, current, target) {
  const d = byName.get(skillName.toLowerCase());
  const official = (d?.resources || []).map((r) => ({ ...r, hours: 4 + 3 * (target - current) }));
  return [
    ...official,
    { title: `Internal ${skillName} assessment (re-take after tasks)`, type: 'Assessment', url: '/employee/assessments', hours: 1 },
  ];
}

function rulesExplanation(skillName, current, target, context) {
  return `Your verified ${skillName} level is L${current} (${LEVELS[current] || 'Not verified'}); ${context} needs L${target} (${LEVELS[target]}). ` +
    `Close the ${target - current}-level gap by completing the practical tasks below, then re-take the ${skillName} assessment so the Skill Passport can verify the new level.`;
}

/**
 * Create / refresh learning recommendations for an employee from a list of gaps.
 * gaps: [{ skillId, skillName, verified, required, critical }]
 */
async function generatePlan(employeeId, gaps, opts = {}) {
  const { projectId = null, projectTitle = null } = opts;
  let useAi = opts.useAi !== false;
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, include: { organization: true } });
  if (emp && !getSettings(emp.organization).geminiExplanations) useAi = false;
  const created = [];
  const context = projectTitle ? `project "${projectTitle}"` : 'your target role';
  for (const g of gaps) {
    if (g.verified >= g.required) continue;
    const current = g.verified || 0;
    const target = g.required;
    const existing = await prisma.learningRecommendation.findUnique({ where: { employeeId_skillId: { employeeId, skillId: g.skillId } } });
    if (existing && existing.status !== 'COMPLETED' && existing.targetLevel >= target) {
      created.push(existing);
      continue;
    }
    let explanationText = rulesExplanation(g.skillName, current, target, context);
    let explanationBy = 'rules';
    if (useAi) {
      const r = await ai.explainLearning({ skill: g.skillName, currentLevel: current, targetLevel: target, context, critical: !!g.critical });
      if (r && r.text && r.source === 'gemini') {
        explanationText = r.text;
        explanationBy = 'gemini';
      }
    }
    const tasks = buildTasks(g.skillName, current, target);
    const data = {
      skillId: g.skillId,
      projectId,
      currentLevel: current,
      targetLevel: target,
      priority: g.critical ? 'HIGH' : target - current >= 2 ? 'MEDIUM' : 'LOW',
      reason: `${g.critical ? 'Critical ' : ''}gap for ${context}: verified L${current} vs required L${target}`,
      resources: buildResources(g.skillName, current, target),
      tasks,
      estimatedHours: tasks.length * 4,
      status: 'NOT_STARTED',
      progressPercent: 0,
      explanationText,
      explanationBy,
    };
    const rec = existing
      ? await prisma.learningRecommendation.update({ where: { id: existing.id }, data })
      : await prisma.learningRecommendation.create({ data: { employeeId, ...data } });
    created.push(rec);
  }
  return created;
}

module.exports = { generatePlan, buildTasks, buildResources };
