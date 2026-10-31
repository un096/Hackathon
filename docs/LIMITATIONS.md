# Known limitations & next steps

1. **Practical assessments are controlled scenarios**, not live coding. Running candidate code needs an isolated sandbox (e.g. Judge0 / Firecracker containers) — deliberately out of scope for the MVP.
2. **Question bank is small** (14 assessments, ~70 questions, 10 skills). Skills without an assessment can only reach *IN_REVIEW* through feedback/certifications. Next: HR authoring UI and randomised question pools per attempt.
3. **Market data is a snapshot.** The bundled sample covers 6 days of January 2024, so no forecast is shown (needs ≥ 8 weeks). Importing longer histories enables the scikit-learn trend forecast automatically.
4. **Skill extraction is dictionary-based** (spaCy PhraseMatcher over 43 curated skills). Frequent unmatched terms are reported for curation; an embedding/NER model could raise recall.
5. **Hiring cost/time** comparisons use HR-entered assumptions, not market salary data.
6. **Sessions** use stateless JWTs (8 h) stored in `localStorage`; deactivation is enforced on the next request because users are re-loaded per request. Refresh tokens / httpOnly cookies and password-change-on-first-login are next.
7. **Matching runs synchronously** — fine for hundreds of employees; for tens of thousands, move to a job queue and pre-computed skill vectors.
8. **Email / notifications** (shortlist, approval) are not sent; status is visible in-app and in the audit log.
9. **Single currency/locale** per organization; no i18n.
10. Frontend has no unit tests yet; coverage comes from the backend e2e suite and a Playwright smoke sweep used during development.
