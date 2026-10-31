# Judging demo (~7 minutes)

**Message to prove:** *We identify hidden internal talent, verify their real capabilities, close skill gaps and deploy employees to projects before recommending external hiring.*

Reset before the demo: `cd backend && npm run db:seed` (AI service running for the spaCy pipeline). Password everywhere: `Demo@1234`. Works fully offline from external APIs.

## 1 · HR creates the project (1 min) — `hr@talentbridge.demo`
1. HR Dashboard: headcount, claim-verification rate, internal fill rate, market demand vs internal supply (tagged **Observed data**).
2. Project Oversight → **Create project** → *Fill demo scenario* → requirements **React L4 (critical), Node.js L4 (critical), Python L3, PostgreSQL L3**, 2 positions, manager Arjun Mehta → *Create & open matching*.
   (A ready-made copy, *Customer Insights Platform*, is already seeded if you prefer to skip this.)

## 2 · AI talent matching (2 min) — same screen, or log in as `manager@talentbridge.demo`
1. **Run AI matching**: 12 Skill Passports evaluated → **4 eligible · 2 close to ready · 6 not eligible**.
2. Explain #1 **Ananya Iyer** (~91): expand *Explanation* — per-component contributions add up to the score; strengths/concerns from evidence.
3. **Fatima Shaikh — hidden talent:** QA Automation Engineer who never *claimed* React or Node, yet her assessments verify L4 in both → eligible.
4. **Thresholds beat raw score:** *Close to ready* tab — **Vikram Singh** scores ~88 (higher than eligible Rohan) but React is verified L3 < L4 critical, so he is not eligible. No LLM can override this.
5. **Karthik Rao** (*Not eligible*) claims L5 React/Node, verified L3/L2 → claims never count.
6. Select Ananya, Rohan, Fatima → **Compare** (radar + side-by-side).
7. On **Meera Nair** (close to ready, Node.js L3/4) → **Assign learning plan**.

## 3 · Grow and prove (1.5 min) — `employee@talentbridge.demo` (Meera)
1. Dashboard → Learning Plan: Node.js L3 → L4 with official resources and practical tasks; tick tasks.
2. **Reassess: Practical** → answer the code-reading scenarios → Results: score, server-side answer review, *Skill Passport update* (verified before/after + evidence breakdown), badge.
3. Skill Passport: claimed (outline) vs verified (filled), confidence, expandable evidence trail.
4. Project Opportunities: live readiness — Meera is now eligible; *I'm interested*.

## 4 · Shortlist → approve → deploy (1 min)
1. Manager → Matching → **Re-run matching**: Meera moves into *Eligible*. **Shortlist for HR** on Ananya (and Meera).
2. HR → Approvals → **Approve & deploy** (allocation %, role). Employee availability, allocation, project staffing and the *Internal Mobility* badge update; the project goes **Active** when full.
3. (Optional) Project Details → **Mark delivered** → project evidence flows back into the Skill Passport.

## 5 · Workforce intelligence (1.5 min) — HR
1. **Internal vs External Hiring Insights:** per project *Deploy internal / Upskill / External hire*; supply per required skill; savings computed from **HR-configured assumptions** (labelled, editable in Settings).
2. **Market Skill Intelligence:** 11.5k real tech postings (Kaggle LinkedIn Jobs & Skills 2024 sample) → pipeline steps, demand %, gap index vs our verified workforce, unmatched terms. Trend chart says **why no forecast** is shown (6-day span < 8 weeks) — we never invent market statistics. Import any CSV live with *Import CSV*.
3. **Workforce Analytics:** claimed vs verified, hidden-talent and over-claimed counts, evidence per month.
4. **Audit & Settings:** every action above in the audit log with before/after JSON; matching weights (must sum to 100) and Gemini toggle.

## Backup answers
- *Is the ranking AI?* Deterministic and explainable by design; Gemini only rewrites wording of computed facts and is optional.
- *Code execution?* Practical assessments are controlled code-reading/debugging scenarios graded against a key — no untrusted code runs on the server.
- *Data isolation?* Every query is scoped to the caller's organization; the e2e suite verifies another org gets 404s.
