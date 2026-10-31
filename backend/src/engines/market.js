/**
 * Market Intelligence Engine
 * Ingestion -> Cleaning -> Skill Extraction -> Normalisation -> Demand Analytics -> Database
 *
 * Primary pipeline runs in the Python AI service (pandas + spaCy PhraseMatcher + scikit-learn).
 * If the AI service is unreachable, an equivalent deterministic Node pipeline is used so the demo
 * never depends on it. Demand is ALWAYS computed from actual posting counts in the uploaded file.
 * Forecasts are stored separately with kind=FORECAST and only when the time span supports it.
 */
const fs = require('fs');
const prisma = require('../lib/prisma');
const { aliasIndex, bySlug } = require('../lib/dictionary');
const ai = require('../lib/aiClient');

/** RFC-4180 CSV parser (quotes, escaped quotes, embedded commas/newlines). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] && r[0].trim()));
}

const COLS = {
  id: ['job_link', 'job_id', 'id', 'url'],
  title: ['job_title', 'title', 'position'],
  company: ['company', 'company_name', 'employer'],
  location: ['job_location', 'location', 'city'],
  country: ['search_country', 'country'],
  level: ['job_level', 'seniority', 'level'],
  type: ['job_type', 'work_type', 'employment_type'],
  date: ['first_seen', 'posted_at', 'date_posted', 'date', 'posted'],
  skills: ['job_skills', 'skills', 'skill_list'],
};

function normaliseToken(t) {
  return t.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9+#./ -]/g, ' ').replace(/\s+/g, ' ').trim();
}

const STRIP = [/^(experience|proficiency|knowledge|expertise) (with|in|of) /, / (experience|skills|programming|development|framework|language)$/];
function matchToken(raw) {
  let t = normaliseToken(raw);
  if (!t) return null;
  if (aliasIndex.has(t)) return aliasIndex.get(t);
  for (const re of STRIP) t = t.replace(re, '').trim();
  return aliasIndex.get(t) || null;
}

// title scan (word-boundary) for a few unambiguous aliases
const TITLE_ALIASES = [...aliasIndex.entries()].filter(([a]) => a.length >= 4 || ['aws', 'gcp', 'sql', 'c++', 'c#', 'java'].includes(a));
function scanTitle(title) {
  const t = ` ${normaliseToken(title)} `;
  const out = new Map();
  for (const [a, d] of TITLE_ALIASES) {
    if (t.includes(` ${a} `)) out.set(d.slug, a);
  }
  return out;
}

function nodePipeline(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV has no data rows');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {};
  for (const [k, names] of Object.entries(COLS)) idx[k] = header.findIndex((h) => names.includes(h));
  if (idx.title < 0 || idx.skills < 0) throw new Error('CSV must contain a job title column and a skills column (e.g. job_title, job_skills)');

  const seen = new Set();
  const postings = [];
  const unmatched = new Map();
  let dropped = 0;
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    const get = (k) => (idx[k] >= 0 ? (row[idx[k]] || '').trim() : '');
    const title = get('title');
    const skillsRaw = get('skills');
    const externalId = get('id') || `row-${r}`;
    if (!title || !skillsRaw || seen.has(externalId)) { dropped += 1; continue; }
    seen.add(externalId);
    const skills = new Map();
    for (const tok of skillsRaw.split(/[,;|]/)) {
      const d = matchToken(tok);
      if (d) { if (!skills.has(d.slug)) skills.set(d.slug, tok.trim()); }
      else {
        const n = normaliseToken(tok);
        if (n) unmatched.set(n, (unmatched.get(n) || 0) + 1);
      }
    }
    for (const [slug, a] of scanTitle(title)) if (!skills.has(slug)) skills.set(slug, `title:${a}`);
    const dateStr = get('date');
    const d = dateStr ? new Date(dateStr) : null;
    postings.push({
      externalId: externalId.slice(0, 500),
      title: title.slice(0, 300),
      company: get('company').slice(0, 200) || null,
      location: get('location').slice(0, 200) || null,
      country: get('country') || null,
      jobLevel: get('level') || null,
      jobType: get('type') || null,
      postedAt: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      skills: [...skills.entries()].map(([slug, raw]) => ({ slug, raw: raw.slice(0, 200) })),
    });
  }
  const unmatchedTop = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([term, count]) => ({ term, count }));
  return { rowsRead: rows.length - 1, rowsDropped: dropped, postings, unmatchedTop, forecast: [], forecastNote: 'Node fallback pipeline does not forecast.' };
}

async function ingestMarketCsv({ organizationId, filePath, fileName, sourceName = 'Uploaded CSV', kind = 'OBSERVED', userId = null, preferAi = true }) {
  const source = await prisma.marketSource.upsert({
    where: { name: sourceName },
    update: {},
    create: { name: sourceName, kind, description: 'Job-posting CSV imported through TalentBridge' },
  });
  const run = await prisma.marketDataRun.create({ data: { organizationId, sourceId: source.id, fileName, status: 'RUNNING' } });

  try {
    let result = null;
    let pipeline = 'node-fallback';
    if (preferAi) {
      result = await ai.processMarketCsv({ path: filePath });
      if (result && Array.isArray(result.postings)) pipeline = 'ai-service';
      else result = null;
    }
    if (!result) result = nodePipeline(fs.readFileSync(filePath, 'utf8'));

    const skills = await prisma.skill.findMany({ select: { id: true, slug: true } });
    const skillId = new Map(skills.map((s) => [s.slug, s.id]));

    const postings = result.postings.filter((p) => p.skills && p.skills.length);
    const noSkill = result.postings.length - postings.length;

    // persist postings + skills in batches
    const BATCH = 2000;
    const idByExternal = new Map();
    for (let i = 0; i < postings.length; i += BATCH) {
      const slice = postings.slice(i, i + BATCH);
      await prisma.marketJobPosting.createMany({
        data: slice.map((p) => ({
          organizationId, runId: run.id, externalId: p.externalId, title: p.title, company: p.company, location: p.location,
          country: p.country, jobLevel: p.jobLevel, jobType: p.jobType, postedAt: p.postedAt ? new Date(p.postedAt) : null,
        })),
        skipDuplicates: true,
      });
      const ids = await prisma.marketJobPosting.findMany({ where: { runId: run.id, externalId: { in: slice.map((p) => p.externalId) } }, select: { id: true, externalId: true } });
      ids.forEach((x) => idByExternal.set(x.externalId, x.id));
    }
    const jobSkills = [];
    for (const p of postings) {
      const pid = idByExternal.get(p.externalId);
      for (const s of p.skills) if (skillId.has(s.slug)) jobSkills.push({ postingId: pid, skillId: skillId.get(s.slug), rawText: s.raw });
    }
    for (let i = 0; i < jobSkills.length; i += 5000) {
      await prisma.marketJobSkill.createMany({ data: jobSkills.slice(i, i + 5000), skipDuplicates: true });
    }

    // Demand analytics from actual counts
    const total = postings.length;
    const counts = new Map();
    const senior = new Map();
    const daily = new Map();
    let minD = null;
    let maxD = null;
    for (const p of postings) {
      const isSenior = /senior|lead|principal|staff/i.test(p.jobLevel || '');
      const day = p.postedAt ? p.postedAt.slice(0, 10) : null;
      if (day) { if (!minD || day < minD) minD = day; if (!maxD || day > maxD) maxD = day; }
      for (const s of p.skills) {
        counts.set(s.slug, (counts.get(s.slug) || 0) + 1);
        if (isSenior) senior.set(s.slug, (senior.get(s.slug) || 0) + 1);
        if (day) daily.set(`${s.slug}|${day}`, (daily.get(`${s.slug}|${day}`) || 0) + 1);
      }
    }
    const demandRows = [...counts.entries()].filter(([slug]) => skillId.has(slug)).map(([slug, c]) => ({
      organizationId, runId: run.id, skillId: skillId.get(slug), postingCount: c, totalPostings: total,
      demandPercent: Math.round((c / total) * 10000) / 100, seniorShare: Math.round(((senior.get(slug) || 0) / c) * 1000) / 10, kind,
    }));
    await prisma.marketSkillDemand.createMany({ data: demandRows });
    const trendRows = [...daily.entries()].map(([k, c]) => {
      const [slug, period] = k.split('|');
      return { organizationId, runId: run.id, skillId: skillId.get(slug), period, postingCount: c, kind };
    }).filter((r) => r.skillId);
    const forecastRows = (result.forecast || []).filter((f) => skillId.has(f.slug)).map((f) => ({
      organizationId, runId: run.id, skillId: skillId.get(f.slug), period: f.period, postingCount: Math.round(f.count), kind: 'FORECAST',
    }));
    for (let i = 0; i < trendRows.length; i += 5000) await prisma.marketSkillTrend.createMany({ data: trendRows.slice(i, i + 5000), skipDuplicates: true });
    if (forecastRows.length) await prisma.marketSkillTrend.createMany({ data: forecastRows, skipDuplicates: true });

    const spanDays = minD && maxD ? Math.round((new Date(maxD) - new Date(minD)) / 86400000) + 1 : 0;
    const done = await prisma.marketDataRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED', pipeline, completedAt: new Date(),
        rowsRead: result.rowsRead, rowsKept: total, rowsDropped: result.rowsDropped + noSkill, skillsMatched: jobSkills.length,
        unmatchedTop: result.unmatchedTop || [],
        periodStart: minD ? new Date(minD) : null, periodEnd: maxD ? new Date(maxD) : null,
        stats: {
          distinctSkills: demandRows.length, spanDays,
          forecastAvailable: forecastRows.length > 0,
          forecastNote: result.forecastNote || (forecastRows.length ? 'Linear trend forecast (scikit-learn)' : `Not enough history to forecast (${spanDays} day span; needs ≥ 8 weeks).`),
          extractor: result.extractor || (pipeline === 'ai-service' ? 'spaCy PhraseMatcher + dictionary' : 'dictionary alias match'),
          kind,
        },
      },
    });
    return done;
  } catch (e) {
    await prisma.marketDataRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: e.message, completedAt: new Date() } });
    throw e;
  }
}

/** Latest completed run for an organisation (dashboard source). */
async function latestRun(organizationId) {
  return prisma.marketDataRun.findFirst({ where: { organizationId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, include: { source: true } });
}

module.exports = { ingestMarketCsv, nodePipeline, parseCsv, latestRun, bySlug };
