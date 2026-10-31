# Team contribution guide

## Ownership (suggested split for a 4-person team)
| Area | Folder | Owner focus |
|---|---|---|
| Frontend portals & UI kit | `frontend/src` | screens, `components/ui.jsx`, charts, accessibility |
| API, RBAC, workflow | `backend/src/routes`, `middleware` | endpoints, validation, audit |
| Engines & data model | `backend/src/engines`, `prisma/` | verification/matching/learning logic, schema, seed |
| AI service & market data | `ai-service/`, `shared/`, `data/` | pipeline, dictionary curation, Gemini prompts |

## Workflow
1. Branch from `main`: `feat/<area>-<short-name>` or `fix/<…>`.
2. Keep PRs small; describe *what* and *why*, add screenshots for UI.
3. Before pushing: `npm run db:seed && npm run test:e2e` (backend running) and `npm run build` in `frontend/`.
4. One reviewer approval required; squash-merge.

## Conventions
- **Never trust the client:** every new route needs `authorize(...)`, Zod validation and an `organizationId` scope.
- **Audit** state-changing actions with `audit(req, ACTION, Entity, id, before, after)`.
- **Engines stay deterministic.** LLM output may only change wording, never levels, scores or decisions.
- **Label data:** anything not observed must be stored/displayed as `DEMO` or `FORECAST`.
- Schema change: edit `schema.prisma` → `npx prisma migrate dev --name <change>` → commit the migration folder → update the seed if needed.
- New skill or alias: edit `shared/skill_dictionary.json` (used by seed, backend fallback and AI service) and re-seed.
- New assessment: add it to `backend/prisma/data/assessments.js` (options are shuffled deterministically at seed time).
- Frontend: data fetching through `useGet` / `useAction` (TanStack Query + toasts); reuse `components/ui.jsx` primitives; support dark mode classes.
- Secrets only in `.env` files, which are git-ignored.
