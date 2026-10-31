/* eslint-disable no-console */
/**
 * TalentBridge AI — demo seed.
 * Everything in the demo organization is DEMO data (fictional company and people).
 * Evidence is created through the same verification engine the API uses, so verified
 * levels in the seed are computed, not typed in.
 * Market data is OBSERVED data: a 12k tech-role sample of the public Kaggle
 * "LinkedIn Jobs & Skills 2024" dataset, processed by the market pipeline.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const { dictionary } = require('../src/lib/dictionary');
const { recomputeSkill } = require('../src/engines/verification');
const { BADGES, award, evaluateAfterVerification } = require('../src/engines/badges');
const { generatePlan } = require('../src/engines/learning');
const { ingestMarketCsv } = require('../src/engines/market');
const { scoreToLevel } = require('../src/lib/levels');
const { runMatching } = require('../src/engines/matching');
const BANK = require('./data/assessments');

const DEMO_PASSWORD = 'Demo@1234';
// Deterministic option shuffle so correct answers are not clustered at one position.
function shuffleQuestion(x, seed) {
  let h = seed;
  const rnd = () => { h = (h * 1103515245 + 12345) % 2147483648; return h / 2147483648; };
  const order = x.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { ...x, options: order.map((i) => x.options[i]), correct: order.indexOf(x.correct) };
}
const daysAgo = (d) => new Date(Date.now() - d * 86400000);

async function reset() {
  // order respects FKs; global taxonomy is rebuilt too
  const tables = ['AuditLog', 'MarketSkillTrend', 'MarketSkillDemand', 'MarketJobSkill', 'MarketJobPosting', 'MarketDataRun', 'MarketSource',
    'EmployeeBadge', 'Badge', 'LearningProgress', 'LearningRecommendation', 'ProjectAssignment', 'ProjectRecommendation', 'ProjectSkillRequirement',
    'Project', 'ManagerFeedback', 'Certification', 'AssessmentSubmission', 'AssessmentQuestion', 'Assessment', 'SkillEvidence', 'EmployeeSkill',
    'SkillAlias', 'Skill', 'Employee', 'Department', 'User', 'Organization'];
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} CASCADE`);
}

async function main() {
  console.log('Resetting database…');
  await reset();

  // ── Skills taxonomy + aliases ────────────────────────────
  const skill = {};
  for (const d of dictionary) {
    const s = await prisma.skill.create({ data: { name: d.name, slug: d.slug, category: d.category, aliases: { create: d.aliases.map((a) => ({ alias: a })) } } });
    skill[d.slug] = s;
  }
  console.log(`Skills: ${dictionary.length}`);
  for (const b of BADGES) await prisma.badge.create({ data: b });

  // ── Organization, departments ────────────────────────────
  const org = await prisma.organization.create({ data: { name: 'Nimbus Digital Solutions (Demo)', domain: 'nimbus.demo', joinCode: 'NIMBUS24', settings: {} } });
  const dept = {};
  for (const [name, description] of [['Engineering', 'Product engineering squads'], ['Data & AI', 'Analytics, data engineering and ML'], ['Cloud & DevOps', 'Platform, infrastructure and SRE'], ['Quality Engineering', 'Testing and automation'], ['People Operations', 'HR and talent']]) {
    dept[name] = await prisma.department.create({ data: { organizationId: org.id, name, description } });
  }
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  let code = 0;
  async function person({ first, last, email, role = 'EMPLOYEE', designation, department, managerId = null, exp = 0, availability = 'AVAILABLE', allocation = 0, location = 'Bengaluru', bio, interests = [] }) {
    code += 1;
    const u = await prisma.user.create({
      data: {
        organizationId: org.id, email, passwordHash: hash, role, firstName: first, lastName: last, lastLoginAt: daysAgo(code % 5),
        employee: { create: { organizationId: org.id, employeeCode: `NDS-${String(1000 + code)}`, designation, departmentId: dept[department].id, managerId, experienceYears: exp, availability, allocationPercent: allocation, location, bio, careerInterests: interests } },
      },
      include: { employee: true },
    });
    return { user: u, emp: u.employee };
  }

  const hr = await person({ first: 'Priya', last: 'Sharma', email: 'hr@talentbridge.demo', role: 'HR', designation: 'HR Business Partner', department: 'People Operations', exp: 9 });
  const mgr = await person({ first: 'Arjun', last: 'Mehta', email: 'manager@talentbridge.demo', role: 'MANAGER', designation: 'Engineering Manager', department: 'Engineering', exp: 12, availability: 'ON_PROJECT', allocation: 100 });
  const mgr2 = await person({ first: 'Kavya', last: 'Reddy', email: 'manager2@talentbridge.demo', role: 'MANAGER', designation: 'Data & Cloud Manager', department: 'Data & AI', exp: 11, availability: 'ON_PROJECT', allocation: 100 });
  const M1 = mgr.user.id;
  const M2 = mgr2.user.id;

  const E = {};
  E.ananya = await person({ first: 'Ananya', last: 'Iyer', email: 'ananya@talentbridge.demo', designation: 'Senior Full-Stack Engineer', department: 'Engineering', managerId: M1, exp: 6, bio: 'Builds customer-facing React apps and Node APIs.', interests: ['Architecture', 'Mentoring'] });
  E.rohan = await person({ first: 'Rohan', last: 'Kapoor', email: 'rohan@talentbridge.demo', designation: 'Full-Stack Engineer', department: 'Engineering', managerId: M1, exp: 4, location: 'Pune', interests: ['Backend', 'Data'] });
  E.meera = await person({ first: 'Meera', last: 'Nair', email: 'employee@talentbridge.demo', designation: 'Frontend Engineer', department: 'Engineering', managerId: M1, exp: 3.5, location: 'Kochi', bio: 'Frontend specialist moving towards full-stack.', interests: ['Full-stack', 'Node.js'] });
  E.vikram = await person({ first: 'Vikram', last: 'Singh', email: 'vikram@talentbridge.demo', designation: 'Backend Engineer', department: 'Engineering', managerId: M1, exp: 7, location: 'Gurugram', interests: ['Distributed systems'] });
  E.sneha = await person({ first: 'Sneha', last: 'Patel', email: 'sneha@talentbridge.demo', designation: 'Data Scientist', department: 'Data & AI', managerId: M2, exp: 5, location: 'Ahmedabad', interests: ['MLOps', 'NLP'] });
  E.karthik = await person({ first: 'Karthik', last: 'Rao', email: 'karthik@talentbridge.demo', designation: 'Software Engineer', department: 'Engineering', managerId: M1, exp: 3, location: 'Hyderabad' });
  E.divya = await person({ first: 'Divya', last: 'Menon', email: 'divya@talentbridge.demo', designation: 'Full-Stack Engineer', department: 'Engineering', managerId: M1, exp: 5, availability: 'ON_PROJECT', allocation: 100, location: 'Chennai' });
  E.aditya = await person({ first: 'Aditya', last: 'Verma', email: 'aditya@talentbridge.demo', designation: 'DevOps Engineer', department: 'Cloud & DevOps', managerId: M2, exp: 6, location: 'Noida', interests: ['Platform engineering'] });
  E.fatima = await person({ first: 'Fatima', last: 'Shaikh', email: 'fatima@talentbridge.demo', designation: 'QA Automation Engineer', department: 'Quality Engineering', managerId: M1, exp: 4.5, availability: 'PARTIALLY_AVAILABLE', allocation: 40, location: 'Mumbai', bio: 'Writes the React/Node test harnesses for three product teams.', interests: ['Product engineering'] });
  E.nikhil = await person({ first: 'Nikhil', last: 'Joshi', email: 'nikhil@talentbridge.demo', designation: 'Associate Software Engineer', department: 'Engineering', managerId: M1, exp: 1, location: 'Bengaluru', interests: ['Frontend'] });
  console.log('Users: 13 (1 HR, 2 managers, 10 employees)');

  // ── Assessments ─────────────────────────────────────────
  const assess = {};
  for (const a of BANK) {
    const created = await prisma.assessment.create({
      data: {
        organizationId: org.id, skillId: skill[a.skill].id, type: a.type, title: a.title, description: a.description, durationMins: a.durationMins, passingScore: 60,
        questions: { create: a.questions.map((q0, i) => shuffleQuestion(q0, 7919 * (i + 1) + a.title.length)).map((x, i) => ({ skillId: skill[a.skill].id, prompt: x.prompt, codeSnippet: x.code, options: x.options, correctIndex: x.correct, explanation: x.explanation, difficulty: x.difficulty, position: i })) },
      },
      include: { questions: true },
    });
    assess[`${a.skill}:${a.type}`] = created;
  }
  console.log(`Assessments: ${BANK.length}`);

  // ── Evidence helpers (go through the verification engine) ──
  async function claim(p, slug, level, years = 1) {
    await prisma.employeeSkill.upsert({ where: { employeeId_skillId: { employeeId: p.emp.id, skillId: skill[slug].id } }, update: { claimedLevel: level, yearsUsed: years }, create: { employeeId: p.emp.id, skillId: skill[slug].id, claimedLevel: level, yearsUsed: years } });
  }
  async function took(p, slug, type, score, ago) {
    const a = assess[`${slug}:${type}`];
    const total = a.questions.length;
    const correct = Math.round((score / 100) * total);
    const level = type === 'MCQ' ? Math.min(scoreToLevel(score), 4) : scoreToLevel(score);
    const attempt = (await prisma.assessmentSubmission.count({ where: { assessmentId: a.id, employeeId: p.emp.id } })) + 1;
    const sub = await prisma.assessmentSubmission.create({
      data: { assessmentId: a.id, employeeId: p.emp.id, answers: a.questions.map((q, i) => ({ questionId: q.id, selectedIndex: i < correct ? q.correctIndex : (q.correctIndex + 1) % q.options.length, correct: i < correct })), correctCount: correct, totalCount: total, score, passed: score >= 60, levelAwarded: level, attempt, timeTakenSecs: 300 + total * 40, submittedAt: daysAgo(ago) },
    });
    await prisma.skillEvidence.create({ data: { employeeId: p.emp.id, skillId: skill[slug].id, type: type === 'MCQ' ? 'MCQ_ASSESSMENT' : 'PRACTICAL_ASSESSMENT', title: `${a.title} (attempt ${attempt})`, score, level, sourceId: sub.id, reviewerName: 'TalentBridge auto-grader', occurredAt: daysAgo(ago), createdAt: daysAgo(ago) } });
    const r = await recomputeSkill(p.emp.id, skill[slug].id);
    await evaluateAfterVerification(p.emp.id, { ...r, submission: sub, assessmentType: type });
  }
  async function feedback(p, reviewer, rating, comment, skills, ago, role = 'MANAGER') {
    const fb = await prisma.managerFeedback.create({ data: { employeeId: p.emp.id, reviewerId: reviewer.user.id, reviewerRole: role, rating, comment, context: 'Quarterly review', skillRatings: skills.map(([s, l]) => ({ skillId: skill[s].id, level: l })), createdAt: daysAgo(ago) } });
    for (const [s, l] of skills) {
      await prisma.skillEvidence.create({ data: { employeeId: p.emp.id, skillId: skill[s].id, type: role === 'TEAM_LEAD' ? 'TEAM_LEAD_FEEDBACK' : 'MANAGER_FEEDBACK', title: `${role === 'TEAM_LEAD' ? 'Team lead' : 'Manager'} rating: ${skill[s].name}`, level: l, score: l * 20, reviewerId: reviewer.user.id, reviewerName: `${reviewer.user.firstName} ${reviewer.user.lastName}`, sourceId: fb.id, occurredAt: daysAgo(ago), createdAt: daysAgo(ago) } });
      await recomputeSkill(p.emp.id, skill[s].id);
    }
  }

  // Ananya — strongest full-stack candidate
  for (const [s, l] of [['react', 5], ['nodejs', 4], ['python', 3], ['postgresql', 4], ['typescript', 4], ['javascript', 5]]) await claim(E.ananya, s, l, 4);
  await took(E.ananya, 'react', 'MCQ', 92, 120); await took(E.ananya, 'react', 'PRACTICAL', 90, 110);
  await took(E.ananya, 'nodejs', 'MCQ', 83, 100); await took(E.ananya, 'nodejs', 'PRACTICAL', 80, 95);
  await took(E.ananya, 'python', 'MCQ', 70, 60); await took(E.ananya, 'python', 'PRACTICAL', 68, 55);
  await took(E.ananya, 'postgresql', 'MCQ', 80, 75); await took(E.ananya, 'postgresql', 'PRACTICAL', 78, 70);
  await took(E.ananya, 'typescript', 'MCQ', 84, 40); await took(E.ananya, 'javascript', 'MCQ', 100, 150);
  await feedback(E.ananya, mgr, 5, 'Led the partner portal frontend; reliable reviewer and mentor.', [['react', 5], ['nodejs', 4]], 30);

  // Rohan — eligible, slightly weaker Python
  for (const [s, l] of [['react', 4], ['nodejs', 4], ['python', 3], ['postgresql', 3], ['docker', 3]]) await claim(E.rohan, s, l, 3);
  await took(E.rohan, 'react', 'MCQ', 83, 90); await took(E.rohan, 'react', 'PRACTICAL', 78, 85);
  await took(E.rohan, 'nodejs', 'MCQ', 83, 80); await took(E.rohan, 'nodejs', 'PRACTICAL', 76, 78);
  await took(E.rohan, 'python', 'MCQ', 50, 45);
  await took(E.rohan, 'postgresql', 'MCQ', 66, 50); await took(E.rohan, 'postgresql', 'PRACTICAL', 62, 48);
  await took(E.rohan, 'docker', 'MCQ', 60, 20);
  await feedback(E.rohan, mgr, 4, 'Ships consistently; growing in API design.', [['nodejs', 4], ['react', 4]], 25);

  // Meera — React expert, Node one level short (nearly ready) — this is the demo employee login
  for (const [s, l] of [['react', 5], ['nodejs', 4], ['javascript', 5], ['html-css', 5], ['typescript', 4], ['postgresql', 2]]) await claim(E.meera, s, l, 3);
  await took(E.meera, 'react', 'MCQ', 100, 70); await took(E.meera, 'react', 'PRACTICAL', 95, 65);
  await took(E.meera, 'nodejs', 'MCQ', 66, 30);
  await took(E.meera, 'javascript', 'MCQ', 100, 90); await took(E.meera, 'typescript', 'MCQ', 80, 50);
  await took(E.meera, 'postgresql', 'MCQ', 60, 28);
  await feedback(E.meera, mgr, 5, 'Best React engineer on the team; keen to grow on the backend.', [['react', 5], ['javascript', 5]], 20);

  // Vikram — backend expert, React one level short
  for (const [s, l] of [['nodejs', 5], ['postgresql', 5], ['python', 4], ['react', 3], ['microservices', 4], ['docker', 4]]) await claim(E.vikram, s, l, 5);
  await took(E.vikram, 'nodejs', 'MCQ', 100, 140); await took(E.vikram, 'nodejs', 'PRACTICAL', 92, 130);
  await took(E.vikram, 'postgresql', 'MCQ', 92, 120); await took(E.vikram, 'postgresql', 'PRACTICAL', 90, 118);
  await took(E.vikram, 'python', 'MCQ', 80, 60); await took(E.vikram, 'python', 'PRACTICAL', 75, 58);
  await took(E.vikram, 'react', 'MCQ', 66, 35); await took(E.vikram, 'react', 'PRACTICAL', 60, 33);
  await took(E.vikram, 'docker', 'MCQ', 80, 80);
  await feedback(E.vikram, mgr, 4, 'Deep backend knowledge; owns our database performance work.', [['nodejs', 5], ['postgresql', 5]], 40);

  // Sneha — data scientist
  for (const [s, l] of [['python', 5], ['machine-learning', 4], ['postgresql', 4], ['sql', 4], ['data-analysis', 5], ['react', 3]]) await claim(E.sneha, s, l, 4);
  await took(E.sneha, 'python', 'MCQ', 100, 100); await took(E.sneha, 'python', 'PRACTICAL', 92, 95);
  await took(E.sneha, 'machine-learning', 'MCQ', 84, 70);
  await took(E.sneha, 'postgresql', 'MCQ', 80, 60); await took(E.sneha, 'postgresql', 'PRACTICAL', 75, 58);
  await feedback(E.sneha, mgr2, 5, 'Built the churn model end-to-end.', [['python', 5], ['machine-learning', 4], ['sql', 4], ['data-analysis', 4]], 15);
  await prisma.certification.create({ data: { employeeId: E.sneha.emp.id, skillId: skill['machine-learning'].id, name: 'TensorFlow Developer Certificate', issuer: 'Google', issueDate: daysAgo(200), credentialUrl: 'https://www.tensorflow.org/certificate' } });

  // Karthik — over-claims (claimed 5/5, verified much lower)
  for (const [s, l] of [['react', 5], ['nodejs', 5], ['python', 4], ['postgresql', 4], ['aws', 4]]) await claim(E.karthik, s, l, 2);
  await took(E.karthik, 'react', 'MCQ', 66, 50); await took(E.karthik, 'react', 'PRACTICAL', 60, 48);
  await took(E.karthik, 'nodejs', 'MCQ', 50, 45); await took(E.karthik, 'nodejs', 'PRACTICAL', 50, 44);
  await took(E.karthik, 'python', 'MCQ', 60, 30);

  // Divya — qualified but fully allocated on another project
  for (const [s, l] of [['react', 4], ['nodejs', 4], ['python', 3], ['postgresql', 3], ['graphql', 3]]) await claim(E.divya, s, l, 3);
  await took(E.divya, 'react', 'MCQ', 83, 110); await took(E.divya, 'react', 'PRACTICAL', 80, 105);
  await took(E.divya, 'nodejs', 'MCQ', 83, 100); await took(E.divya, 'nodejs', 'PRACTICAL', 76, 98);
  await took(E.divya, 'python', 'MCQ', 70, 90); await took(E.divya, 'python', 'PRACTICAL', 62, 88);
  await took(E.divya, 'postgresql', 'MCQ', 66, 80); await took(E.divya, 'postgresql', 'PRACTICAL', 62, 78);
  await feedback(E.divya, mgr, 4, 'Strong delivery on the billing revamp.', [['react', 4], ['nodejs', 4]], 35);

  // Aditya — DevOps
  for (const [s, l] of [['aws', 4], ['docker', 4], ['kubernetes', 3], ['python', 3], ['linux', 4], ['terraform', 3], ['ci-cd', 4]]) await claim(E.aditya, s, l, 4);
  await took(E.aditya, 'aws', 'MCQ', 100, 90); await took(E.aditya, 'docker', 'MCQ', 100, 85);
  await took(E.aditya, 'python', 'MCQ', 70, 60); await took(E.aditya, 'python', 'PRACTICAL', 62, 58);
  await feedback(E.aditya, mgr2, 4, 'Reduced deployment time by automating our pipelines.', [['kubernetes', 3], ['ci-cd', 4], ['aws', 4], ['terraform', 3]], 22);
  const aws = await prisma.certification.create({ data: { employeeId: E.aditya.emp.id, skillId: skill.aws.id, name: 'AWS Certified Solutions Architect – Associate', issuer: 'Amazon Web Services', issueDate: daysAgo(300), expiryDate: daysAgo(-795), isVerified: true, verifiedById: hr.user.id } });
  await prisma.skillEvidence.create({ data: { employeeId: E.aditya.emp.id, skillId: skill.aws.id, type: 'CERTIFICATION', title: 'AWS Certified Solutions Architect – Associate', level: 3, reviewerId: hr.user.id, reviewerName: 'Priya Sharma', sourceId: aws.id, occurredAt: daysAgo(280) } });
  await recomputeSkill(E.aditya.emp.id, skill.aws.id);

  // Fatima — HIDDEN TALENT: QA title, never claimed React/Node, but assessments prove L4
  for (const [s, l] of [['testing-qa', 5], ['javascript', 4], ['python', 2]]) await claim(E.fatima, s, l, 4);
  await took(E.fatima, 'javascript', 'MCQ', 100, 80);
  await took(E.fatima, 'react', 'MCQ', 83, 18); await took(E.fatima, 'react', 'PRACTICAL', 80, 16);
  await took(E.fatima, 'nodejs', 'MCQ', 83, 14); await took(E.fatima, 'nodejs', 'PRACTICAL', 76, 12);
  await took(E.fatima, 'postgresql', 'MCQ', 66, 10); await took(E.fatima, 'postgresql', 'PRACTICAL', 62, 9);
  await took(E.fatima, 'python', 'MCQ', 50, 8);
  await feedback(E.fatima, E.ananya, 4, 'Her test harnesses are production-grade React/Node code.', [['react', 4], ['nodejs', 4]], 6, 'TEAM_LEAD');

  // Nikhil — junior, learning plan in progress
  for (const [s, l] of [['react', 3], ['nodejs', 2], ['python', 2], ['javascript', 3]]) await claim(E.nikhil, s, l, 1);
  await took(E.nikhil, 'react', 'MCQ', 50, 40); await took(E.nikhil, 'nodejs', 'MCQ', 50, 38); await took(E.nikhil, 'javascript', 'MCQ', 60, 42);

  // Managers' own passports
  await claim(mgr, 'system-design', 4, 8); await claim(mgr, 'agile-scrum', 5, 8); await claim(mgr, 'leadership', 4, 6);
  await claim(mgr2, 'data-engineering', 4, 6); await claim(mgr2, 'leadership', 4, 5);
  console.log('Skill evidence created via verification engine');

  // ── Projects ────────────────────────────────────────────
  const reqs = (list) => list.map(([s, minLevel, isCritical, weight = 1]) => ({ skillId: skill[s].id, minLevel, isCritical, weight }));
  const past = await prisma.project.create({ data: { organizationId: org.id, title: 'Partner Portal Revamp', description: 'Rebuilt the partner self-service portal (React + Node).', status: 'COMPLETED', priority: 'HIGH', openPositions: 3, minExperience: 2, departmentId: dept.Engineering.id, managerId: M1, createdById: M1, startDate: daysAgo(330), endDate: daysAgo(150), requirements: { create: reqs([['react', 3, true], ['nodejs', 3, true], ['postgresql', 3, false]]) }, createdAt: daysAgo(340) } });
  for (const [p, used] of [[E.ananya, [['react', 4], ['nodejs', 4]]], [E.rohan, [['react', 3], ['nodejs', 3]]], [E.vikram, [['nodejs', 4], ['postgresql', 4]]]]) {
    const a = await prisma.projectAssignment.create({ data: { projectId: past.id, employeeId: p.emp.id, role: 'Engineer', allocationPercent: 100, status: 'COMPLETED', assignedById: hr.user.id, skillsUsed: used.map(([s, l]) => ({ skillId: skill[s].id, name: skill[s].name, level: l })), startedAt: daysAgo(330), endedAt: daysAgo(150) } });
    for (const [s, l] of used) {
      await prisma.skillEvidence.create({ data: { employeeId: p.emp.id, skillId: skill[s].id, type: 'PROJECT', title: 'Delivered on project "Partner Portal Revamp"', level: l, reviewerId: M1, reviewerName: 'Arjun Mehta', sourceId: a.id, occurredAt: daysAgo(150) } });
      await recomputeSkill(p.emp.id, skill[s].id);
    }
  }
  const billing = await prisma.project.create({ data: { organizationId: org.id, title: 'Billing Platform Modernisation', description: 'Migrating invoicing from the monolith to GraphQL services.', status: 'ACTIVE', priority: 'HIGH', openPositions: 1, minExperience: 3, departmentId: dept.Engineering.id, managerId: M1, createdById: hr.user.id, startDate: daysAgo(60), endDate: daysAgo(-90), requirements: { create: reqs([['react', 3, true], ['graphql', 3, false], ['nodejs', 3, true]]) }, createdAt: daysAgo(70) } });
  await prisma.projectAssignment.create({ data: { projectId: billing.id, employeeId: E.divya.emp.id, role: 'Full-stack engineer', allocationPercent: 100, status: 'ACTIVE', assignedById: hr.user.id, readinessAtAssign: 78, skillsUsed: [{ skillId: skill.react.id, name: 'React', level: 4 }, { skillId: skill.nodejs.id, name: 'Node.js', level: 4 }], startedAt: daysAgo(60) } });

  // DEMO project — React L4*, Node.js L4*, Python L3, PostgreSQL L3 (not matched yet: run it live)
  const demo = await prisma.project.create({
    data: {
      organizationId: org.id, title: 'Customer Insights Platform', status: 'OPEN', priority: 'CRITICAL', openPositions: 2, minExperience: 3, workMode: 'HYBRID', location: 'Bengaluru',
      description: 'Customer analytics web platform: React dashboard, Node.js APIs, Python scoring jobs and a PostgreSQL warehouse. Client kickoff in 3 weeks.',
      departmentId: dept.Engineering.id, managerId: M1, createdById: hr.user.id, startDate: daysAgo(-21), endDate: daysAgo(-200),
      requirements: { create: reqs([['react', 4, true, 1.5], ['nodejs', 4, true, 1.5], ['python', 3, false], ['postgresql', 3, false]]) },
    },
  });
  const cloud = await prisma.project.create({ data: { organizationId: org.id, title: 'Cloud Cost Optimizer', description: 'Automated rightsizing and cost reporting for AWS workloads.', status: 'OPEN', priority: 'MEDIUM', openPositions: 1, minExperience: 3, workMode: 'REMOTE', departmentId: dept['Cloud & DevOps'].id, managerId: M2, createdById: M2, startDate: daysAgo(-10), endDate: daysAgo(-120), requirements: { create: reqs([['aws', 3, true], ['docker', 3, true], ['python', 3, false], ['kubernetes', 2, false]]) }, createdAt: daysAgo(12) } });
  const dataP = await prisma.project.create({ data: { organizationId: org.id, title: 'Data Quality ML Pipeline', description: 'Anomaly detection on incoming customer data feeds.', status: 'OPEN', priority: 'HIGH', openPositions: 1, minExperience: 3, workMode: 'HYBRID', departmentId: dept['Data & AI'].id, managerId: M2, createdById: M2, startDate: daysAgo(-14), endDate: daysAgo(-150), requirements: { create: reqs([['python', 4, true], ['machine-learning', 3, true], ['sql', 3, false], ['data-engineering', 2, false]]) }, createdAt: daysAgo(9) } });

  // Cloud project: matched, shortlisted and approved -> Aditya deployed
  await runMatching(cloud.id, org.id);
  const recA = await prisma.projectRecommendation.findUnique({ where: { projectId_employeeId: { projectId: cloud.id, employeeId: E.aditya.emp.id } } });
  await prisma.projectRecommendation.update({ where: { id: recA.id }, data: { status: 'APPROVED', managerNote: 'Strongest AWS + Docker evidence.', managerDecidedAt: daysAgo(5), hrNote: 'Approved, 60% allocation.', decidedById: hr.user.id, decidedAt: daysAgo(4) } });
  await prisma.projectAssignment.create({ data: { projectId: cloud.id, employeeId: E.aditya.emp.id, role: 'Cloud engineer', allocationPercent: 60, assignedById: hr.user.id, readinessAtAssign: recA.readinessScore, skillsUsed: [{ skillId: skill.aws.id, name: 'AWS', level: 3 }, { skillId: skill.docker.id, name: 'Docker', level: 3 }], startedAt: daysAgo(4) } });
  await prisma.employee.update({ where: { id: E.aditya.emp.id }, data: { availability: 'PARTIALLY_AVAILABLE', allocationPercent: 60 } });
  await prisma.project.update({ where: { id: cloud.id }, data: { status: 'ACTIVE' } });
  await award(E.aditya.emp.id, 'DEPLOYED', 'Deployed to Cloud Cost Optimizer');

  // Data project: matched, Sneha shortlisted by manager -> waiting for HR (approve live in the demo)
  await runMatching(dataP.id, org.id);
  await prisma.projectRecommendation.update({ where: { projectId_employeeId: { projectId: dataP.id, employeeId: E.sneha.emp.id } }, data: { status: 'SHORTLISTED', managerNote: 'Verified Python L5 and ML L4; built our churn model.', managerDecidedAt: daysAgo(1) } });
  console.log('Projects: 5 (1 completed, 2 active, 2 open incl. demo project)');

  // Learning plan in progress for Nikhil (React L2 -> L3 for the billing-style work)
  const nikhilPlan = await generatePlan(E.nikhil.emp.id, [{ skillId: skill.react.id, skillName: 'React', verified: 2, required: 3, critical: true }], { projectId: billing.id, projectTitle: billing.title, useAi: false });
  const p0 = nikhilPlan[0];
  const tasks = p0.tasks.map((t, i) => (i === 0 ? { ...t, done: true, doneAt: daysAgo(3).toISOString() } : t));
  await prisma.learningRecommendation.update({ where: { id: p0.id }, data: { tasks, status: 'IN_PROGRESS', progressPercent: Math.round(100 / tasks.length) } });
  await prisma.learningProgress.create({ data: { learningRecommendationId: p0.id, employeeId: E.nikhil.emp.id, event: 'TASK_DONE', taskId: tasks[0].id, progressPercent: Math.round(100 / tasks.length), createdAt: daysAgo(3) } });

  // ── Audit trail for realism ──────────────────────────────
  const log = (user, action, entityType, entityId, after, ago) => prisma.auditLog.create({ data: { organizationId: org.id, userId: user.user.id, action, entityType, entityId, after, createdAt: daysAgo(ago) } });
  await log(hr, 'ORGANIZATION_CREATED', 'Organization', org.id, { name: org.name }, 400);
  await log(hr, 'PROJECT_CREATED', 'Project', billing.id, { title: billing.title }, 70);
  await log(mgr2, 'PROJECT_CREATED', 'Project', cloud.id, { title: cloud.title }, 12);
  await log(mgr2, 'MATCHING_RUN', 'Project', cloud.id, { evaluated: 12 }, 6);
  await log(mgr2, 'CANDIDATE_SHORTLISTED', 'ProjectRecommendation', recA.id, { employee: 'Aditya Verma', project: cloud.title }, 5);
  await log(hr, 'ASSIGNMENT_APPROVED', 'ProjectAssignment', recA.id, { employee: 'Aditya Verma', project: cloud.title, allocationPercent: 60 }, 4);
  await log(mgr2, 'PROJECT_CREATED', 'Project', dataP.id, { title: dataP.title }, 9);
  await log(mgr2, 'CANDIDATE_SHORTLISTED', 'ProjectRecommendation', null, { employee: 'Sneha Patel', project: dataP.title }, 1);
  await log(hr, 'PROJECT_CREATED', 'Project', demo.id, { title: demo.title, requirements: ['React L4 (critical)', 'Node.js L4 (critical)', 'Python L3', 'PostgreSQL L3'] }, 0);
  await prisma.auditLog.create({ data: { organizationId: org.id, userId: E.meera.user.id, action: 'PROJECT_INTEREST', entityType: 'Project', entityId: demo.id, after: { employeeId: E.meera.emp.id, project: demo.title } } });

  // ── Market intelligence (OBSERVED public data) ───────────
  const sample = process.env.MARKET_SAMPLE_CSV || path.join(__dirname, '../../data/market_sample_tech_jobs.csv');
  if (fs.existsSync(sample)) {
    const run = await ingestMarketCsv({ organizationId: org.id, filePath: sample, fileName: path.basename(sample), sourceName: 'LinkedIn Job Postings 2024 (Kaggle sample)', kind: 'OBSERVED', preferAi: process.env.SEED_USE_AI !== '0' });
    console.log(`Market run: ${run.rowsKept} postings kept of ${run.rowsRead} rows (${run.pipeline})`);
  } else {
    console.warn(`Market sample CSV not found at ${sample} — skipping market data`);
  }

  console.log('\nDemo logins (password for all: Demo@1234)');
  console.log('  HR       hr@talentbridge.demo');
  console.log('  Manager  manager@talentbridge.demo   (Arjun Mehta, Engineering)');
  console.log('  Manager  manager2@talentbridge.demo  (Kavya Reddy, Data & Cloud)');
  console.log('  Employee employee@talentbridge.demo  (Meera Nair)');
  console.log('  Join code for registration: NIMBUS24');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
