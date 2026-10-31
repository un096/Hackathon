/**
 * End-to-end workflow test against a running API with a freshly seeded database.
 *   npm run db:seed && npm start   (in another terminal)
 *   npm run test:e2e
 * Covers the full "Grow → Prove → Match → Deploy" flow plus security checks.
 */
require('dotenv').config();
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const prisma = require('../src/lib/prisma');

const B = process.env.E2E_API || `http://localhost:${process.env.PORT || 5000}/api`;
const PW = 'Demo@1234';
async function call(method, url, token, body, raw) {
  const res = await fetch(B + url, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(!raw && body && { 'Content-Type': 'application/json' }) },
    body: raw || (body ? JSON.stringify(body) : undefined),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}
const login = async (email) => (await call('POST', '/auth/login', null, { email, password: PW })).token;
const S = {};

test('auth: login for all three roles, bad password rejected', async () => {
  S.hr = await login('hr@talentbridge.demo');
  S.mgr = await login('manager@talentbridge.demo');
  S.emp = await login('employee@talentbridge.demo');
  assert.ok(S.hr && S.mgr && S.emp);
  assert.equal((await call('POST', '/auth/login', null, { email: 'hr@talentbridge.demo', password: 'wrong-pass1' })).status, 401);
  assert.equal((await call('GET', '/me/dashboard')).status, 401);
});

test('RBAC is enforced by the backend', async () => {
  assert.equal((await call('GET', '/employees', S.emp)).status, 403);
  assert.equal((await call('GET', '/hr/dashboard', S.mgr)).status, 403);
  assert.equal((await call('GET', '/admin/users', S.mgr)).status, 403);
  assert.equal((await call('POST', '/market/import-sample', S.emp)).status, 403);
});

test('validation rejects bad input', async () => {
  const r = await call('POST', '/projects', S.hr, { title: 'x', requirements: [] });
  assert.equal(r.status, 400);
  assert.ok(r.details.length > 0);
});

test('HR creates the demo project (React L4*, Node L4*, Python L3, PostgreSQL L3)', async () => {
  const skills = (await call('GET', '/skills', S.hr)).data;
  const id = (n) => skills.find((s) => s.name === n).id;
  S.skill = { react: id('React'), node: id('Node.js'), python: id('Python'), pg: id('PostgreSQL') };
  const managers = (await call('GET', '/admin/managers', S.hr)).data;
  const r = await call('POST', '/projects', S.hr, {
    title: 'E2E Analytics Portal', priority: 'HIGH', openPositions: 2, minExperience: 3, managerId: managers.find((m) => m.firstName === 'Arjun').id,
    requirements: [
      { skillId: S.skill.react, minLevel: 4, isCritical: true, weight: 1.5 }, { skillId: S.skill.node, minLevel: 4, isCritical: true, weight: 1.5 },
      { skillId: S.skill.python, minLevel: 3, isCritical: false, weight: 1 }, { skillId: S.skill.pg, minLevel: 3, isCritical: false, weight: 1 },
    ],
  });
  assert.equal(r.status, 201);
  S.project = r.data.id;
});

test('matching engine ranks with thresholds and explanations', async () => {
  const m = await call('POST', `/projects/${S.project}/match`, S.mgr);
  assert.equal(m.status, 200);
  assert.ok(m.data.eligible >= 3);
  const recs = (await call('GET', `/projects/${S.project}/recommendations`, S.mgr)).data.recommendations;
  const by = Object.fromEntries(recs.map((r) => [r.employee.name, r]));
  assert.equal(recs[0].employee.name, 'Ananya Iyer');
  assert.ok(by['Fatima Shaikh'].eligible, 'hidden talent (QA title, unclaimed React/Node) is discovered');
  assert.ok(!by['Meera Nair'].eligible && by['Meera Nair'].nearlyReady, 'Meera is close to ready (Node.js L3 < L4)');
  assert.ok(!by['Karthik Rao'].eligible, 'over-claimer is not eligible: claims never count');
  assert.ok(by['Vikram Singh'].readinessScore > by['Rohan Kapoor'].readinessScore && by['Vikram Singh'].rank > by['Rohan Kapoor'].rank, 'thresholds beat raw score');
  for (const r of recs) {
    const c = r.explanation.components;
    const sum = c.skillMatch.contribution + c.practical.contribution + c.experience.contribution + c.feedback.contribution + c.availability.contribution;
    assert.ok(Math.abs(sum - r.readinessScore) < 0.5, `contributions add up for ${r.employee.name}`);
    assert.ok(r.explanation.summary.length > 10);
  }
  S.recs = by;
});

test('ineligible candidates cannot be shortlisted; learning is suggested instead', async () => {
  const meera = S.recs['Meera Nair'];
  assert.equal((await call('POST', `/projects/${S.project}/recommendations/${meera.id}/shortlist`, S.mgr, {})).status, 400);
  const l = await call('POST', `/projects/${S.project}/recommendations/${meera.id}/learning`, S.mgr);
  assert.equal(l.status, 201);
  assert.ok(l.data.some((p) => p.targetLevel === 4));
});

test('assessment: answers are never sent to the client, grading is server-side', async () => {
  const list = (await call('GET', '/assessments', S.emp)).data;
  const nodePractical = list.find((a) => a.skill.name === 'Node.js' && a.type === 'PRACTICAL');
  const start = (await call('GET', `/assessments/${nodePractical.id}/start`, S.emp)).data;
  assert.ok(start.questions.every((q) => q.correctIndex === undefined));
  const key = await prisma.assessmentQuestion.findMany({ where: { assessmentId: nodePractical.id } });
  const r = await call('POST', `/assessments/${nodePractical.id}/submit`, S.emp, { answers: key.map((q) => ({ questionId: q.id, selectedIndex: q.correctIndex })), timeTakenSecs: 300 });
  assert.equal(r.status, 201);
  assert.equal(r.data.score, 100);
  assert.ok(r.data.after.verifiedLevel >= 4, `Node.js verified level now ${r.data.after.verifiedLevel}`);
  assert.equal(r.data.learningUpdate?.status, 'COMPLETED', 'reassessment closes the learning plan');
  const res = (await call('GET', `/assessments/submissions/${r.data.submissionId}`, S.emp)).data;
  assert.equal(res.questions.length, key.length);
});

test('re-matching moves the upskilled employee into the eligible list', async () => {
  await call('POST', `/projects/${S.project}/match`, S.mgr);
  const recs = (await call('GET', `/projects/${S.project}/recommendations`, S.mgr)).data.recommendations;
  assert.ok(recs.find((r) => r.employee.name === 'Meera Nair').eligible);
  S.recs = Object.fromEntries(recs.map((r) => [r.employee.name, r]));
});

test('manager shortlists → only HR can approve → employee deployed', async () => {
  const ananya = S.recs['Ananya Iyer'];
  assert.equal((await call('POST', `/projects/${S.project}/recommendations/${ananya.id}/shortlist`, S.mgr, { note: 'Top verified match' })).status, 200);
  assert.equal((await call('POST', `/approvals/${ananya.id}/approve`, S.mgr, {})).status, 403);
  assert.equal((await call('POST', `/approvals/${ananya.id}/approve`, S.emp, {})).status, 403);
  const a = await call('POST', `/approvals/${ananya.id}/approve`, S.hr, { allocationPercent: 100, role: 'Lead engineer' });
  assert.equal(a.status, 200);
  const emp = await prisma.employee.findUnique({ where: { id: ananya.employeeId }, include: { badges: { include: { badge: true } } } });
  assert.equal(emp.availability, 'ON_PROJECT');
  assert.ok(emp.badges.some((b) => b.badge.code === 'DEPLOYED'));
  S.assignment = a.data.id;
  assert.equal((await call('POST', `/approvals/${ananya.id}/approve`, S.hr, {})).status, 400, 'cannot approve twice');
});

test('delivering the project writes project evidence into the Skill Passport', async () => {
  const r = await call('POST', `/projects/${S.project}/assignments/${S.assignment}/complete`, S.mgr, {});
  assert.equal(r.status, 200);
  const ev = await prisma.skillEvidence.count({ where: { sourceId: S.assignment, type: 'PROJECT' } });
  assert.ok(ev >= 4);
});

test('market CSV import: pipeline computes demand from real counts', async () => {
  const csv = 'job_link,job_title,company,first_seen,job_level,job_skills\n'
    + 'a1,Senior React Developer,Acme,2024-01-10,Mid senior,"React, Node.js, PostgreSQL, Communication"\n'
    + 'a2,Data Engineer,Beta,2024-01-11,Associate,"Python, SQL, Apache Spark, Airflow"\n'
    + 'a3,Python Developer,Gamma,2024-01-12,Mid senior,"Python, Django, Docker"\n'
    + 'a3,Python Developer,Gamma,2024-01-12,Mid senior,"Python, Django, Docker"\n';
  const file = path.join(os.tmpdir(), 'tb-e2e.csv');
  fs.writeFileSync(file, csv);
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)], { type: 'text/csv' }), 'tb-e2e.csv');
  fd.append('kind', 'DEMO');
  const r = await call('POST', '/market/import', S.hr, null, fd);
  assert.equal(r.status, 201);
  assert.equal(r.data.rowsKept, 3, 'duplicate row dropped');
  const demand = await prisma.marketSkillDemand.findMany({ where: { runId: r.data.id }, include: { skill: true } });
  const py = demand.find((d) => d.skill.name === 'Python');
  assert.equal(py.postingCount, 2);
  assert.equal(py.demandPercent, 66.67);
  assert.equal(py.kind, 'DEMO');
  // restore the observed sample as latest run
  await call('POST', '/market/import-sample', S.hr);
});

test('tenant isolation: another organization cannot see this data', async () => {
  const email = `iso-${Date.now()}@other.test`;
  const reg = await call('POST', '/auth/register', null, { mode: 'create', organizationName: 'Other Org', firstName: 'Iso', lastName: 'Lated', email, password: 'Other1234' });
  assert.equal(reg.status, 201);
  assert.equal(reg.user.role, 'HR');
  assert.equal((await call('GET', `/projects/${S.project}`, reg.token)).status, 404);
  assert.equal((await call('GET', `/employees/${S.recs['Ananya Iyer'].employeeId}`, reg.token)).status, 404);
  assert.equal((await call('GET', '/employees?scope=all', reg.token)).data.length, 1);
  assert.equal((await call('GET', '/market/summary', reg.token)).data, null);
});

test('audit log captured the workflow', async () => {
  const a = (await call('GET', '/admin/audit?pageSize=100', S.hr)).data;
  const actions = new Set(a.rows.map((r) => r.action));
  for (const x of ['PROJECT_CREATED', 'MATCHING_RUN', 'LEARNING_ASSIGNED', 'ASSESSMENT_SUBMITTED', 'CANDIDATE_SHORTLISTED', 'ASSIGNMENT_APPROVED', 'ASSIGNMENT_COMPLETED', 'MARKET_CSV_IMPORTED']) assert.ok(actions.has(x), x);
  await prisma.$disconnect();
});
