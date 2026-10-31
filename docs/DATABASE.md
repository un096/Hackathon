# Database

PostgreSQL via Prisma 7 (`backend/prisma/schema.prisma`, migration `prisma/migrations/20261031000000_init`). 28 models, UUID keys, `createdAt/updatedAt` timestamps, foreign keys with cascade rules, unique constraints and indexes on every tenant/lookup column.

**ER diagram:** [er-diagram.svg](er-diagram.svg) (source: [er-diagram.mmd](er-diagram.mmd), render with any Mermaid viewer).

## Model groups

| Group | Models | Notes |
|---|---|---|
| Tenancy & people | Organization, User, Department, Employee | `Organization.joinCode` for self-registration, `settings` JSON for weights/assumptions. Every user has an Employee (Skill Passport) row |
| Skills taxonomy | Skill, SkillAlias | Global curated dictionary (not tenant data); aliases drive normalisation |
| Skill Passport | EmployeeSkill, SkillEvidence, Certification, ManagerFeedback | `claimedLevel` vs `verifiedLevel` + `status`, `confidence`, `verificationNotes` breakdown. Evidence stores type, score, level, reviewer, source id, date |
| Assessments | Assessment, AssessmentQuestion, AssessmentSubmission | `type` MCQ/PRACTICAL; `correctIndex` never sent before submission; submissions keep graded answers, score, level, attempt |
| Projects | Project, ProjectSkillRequirement, ProjectRecommendation, ProjectAssignment | Requirements: `minLevel`, `isCritical`, `weight`. Recommendations persist every score component + JSON explanation + decision trail (manager → HR). Assignments keep `skillsUsed` and readiness at assignment |
| Learning & rewards | LearningRecommendation, LearningProgress, Badge, EmployeeBadge | Plans hold resources/tasks JSON, status, progress; progress log per event |
| Market | MarketSource, MarketDataRun, MarketJobPosting, MarketJobSkill, MarketSkillDemand, MarketSkillTrend | `kind` = OBSERVED / DEMO / FORECAST on sources, demand and trend rows; run keeps pipeline, counts, period, unmatched terms |
| Audit | AuditLog | action, entity, before/after JSON, user, IP, time |

## Tenant isolation
`organizationId` is stored on Organization-owned roots (User, Department, Employee, Project, Assessment, AuditLog, market tables). Child rows (EmployeeSkill, SkillEvidence, ProjectRecommendation, …) are reached only through an org-scoped parent in every query. The API never accepts an organization id from the client — it comes from the authenticated user.

## Commands
```bash
npx prisma migrate deploy   # apply migrations
npm run db:seed             # reset data + seed demo organization (idempotent)
npm run db:reset            # drop schema, re-apply migrations, seed
npx prisma studio           # browse data
```
