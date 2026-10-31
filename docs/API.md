# REST API

Base URL `http://localhost:5000/api`. JSON in/out. Authenticated routes need `Authorization: Bearer <token>`.
Responses: `{ success: true, data, message? }` or `{ success: false, message, details? }` (400 validation, 401 unauthenticated, 403 forbidden role, 404 not found / other tenant, 409 conflict).

Roles: **E** employee · **M** manager · **H** HR/Admin. Managers and HR also have a Skill Passport, so `/me/*` works for every role.

## Auth
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | `mode:"join"` (joinCode → EMPLOYEE) or `mode:"create"` (new organization → HR) |
| POST | `/auth/login` | public | Returns JWT + user (rate limited) |
| GET | `/auth/me` | any | Current user |
| GET | `/health` | public | API + DB status |

## Employee self-service (`/me`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/me/dashboard` | Summary, claims to verify, top opportunities, learning, activity |
| GET / PUT | `/me/profile` | Profile (experience, location, work mode, interests) |
| GET | `/me/passport` | Skill Passport: skills, evidence, certifications, feedback, projects, badges |
| POST | `/me/skills` | Claim / update a skill `{skillId, claimedLevel, yearsUsed}` |
| DELETE | `/me/skills/:id` | Remove a claim (only without evidence) |
| POST | `/me/certifications` | Add certification (pending verification) |
| GET | `/me/gap?projectId=` | Gap vs a project + vs observed market demand |
| GET | `/me/learning` | Learning plans with linked assessments |
| POST | `/me/learning/generate` | Plan from gaps for `{projectId}` |
| PATCH | `/me/learning/:id/tasks/:taskId` | Toggle a task `{done}` |
| GET | `/me/opportunities` | Open projects with live readiness + explanation |
| POST | `/me/opportunities/:projectId/interest` | Express interest (visible to the manager) |
| GET | `/me/badges` | Badges, points, leaderboard |

## Assessments
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/assessments` | any | Catalogue with my attempts and claimed/verified levels |
| GET | `/assessments/:id/start` | any | Questions **without** answer keys |
| POST | `/assessments/:id/submit` | any | Server-side grading → submission + evidence → verification → badges → learning loop |
| GET | `/assessments/submissions/:id` | owner, M, H | Result with answer review and verification breakdown |

## People (`/employees`) — M, H
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/employees?scope=team\|all&q=&skillId=&availability=&departmentId=` | M, H | Directory (filter by *verified* skill) |
| GET | `/employees/:id` | M, H | Passport + recommendations + learning |
| POST | `/employees/:id/feedback` | M, H | Manager/team-lead feedback with skill ratings → evidence |
| POST | `/employees/:id/certifications/:certId/verify` | M, H | Verify certification → evidence |
| POST | `/employees` | H | Create user + passport, returns one-time temp password |
| PUT | `/employees/:id` | H | Department, manager, availability, allocation… |

## Projects & matching — M, H
| Method | Path | Purpose |
|---|---|---|
| GET | `/projects?scope=all&status=` | List (managers default to their own) |
| POST | `/projects` | Create with requirements `[{skillId, minLevel, isCritical, weight}]` |
| GET / PUT | `/projects/:id` | Details (+ internal supply, interests) / update (owner or HR) |
| POST | `/projects/:id/match` | Run the matching engine, persist ranked recommendations |
| GET | `/projects/:id/recommendations` | Ranked candidates with full explanation |
| GET | `/projects/:id/compare?employeeIds=a,b,c` | Side-by-side comparison (2–4) |
| GET | `/projects/:id/recommendations/:recId/narrative` | Optional Gemini wording (rule fallback) |
| POST | `/projects/:id/recommendations/:recId/shortlist` | Manager shortlist (eligible only) → HR queue |
| POST | `/projects/:id/recommendations/:recId/reject` | Not a fit |
| POST | `/projects/:id/recommendations/:recId/learning` | Assign learning plan for the candidate's gaps |
| POST | `/projects/:id/assignments/:assignmentId/complete` | Delivery → PROJECT evidence → re-verification |

## Approvals
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/approvals?status=` | M, H | Shortlisted / approved / rejected |
| POST | `/approvals/:recId/approve` | **H** | Creates assignment, updates allocation & availability, badge, project status |
| POST | `/approvals/:recId/reject` | H (or owning M to withdraw) | Reject shortlist |

## Insights
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/manager/dashboard` | M, H | Team, projects, skill distribution, reviews needed |
| GET | `/hr/dashboard` | H | Headcount, verification rate, fill rate, market top skills, activity |
| GET | `/analytics/workforce` | H, M | Inventory, level distribution, departments, evidence timeline, assessments, learning |
| GET | `/analytics/hiring` | H | Internal vs external decision per project, supply per skill, assumption-based savings |

## Market intelligence
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/market/summary?runId=` | any | Demand vs internal supply, categories, trend, forecast flag, unmatched terms |
| GET | `/market/runs` | H | Import history |
| POST | `/market/import` | H | multipart `file` (.csv ≤ 50 MB), `kind` OBSERVED\|DEMO, `sourceName` |
| POST | `/market/import-sample` | H | Re-import the bundled observed sample |

## Administration (`/admin`)
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/admin/departments` | any | Departments |
| POST | `/admin/departments` | H | Create department |
| GET | `/admin/managers` | M, H | Users who can manage projects |
| GET | `/admin/users?role=&q=` | H | Users |
| PATCH | `/admin/users/:id` | H | Change role / activate (keeps ≥ 1 HR, cannot demote self) |
| POST | `/admin/users/:id/reset-password` | H | One-time temp password |
| GET | `/admin/audit?page=&action=` | H | Paginated audit log |
| GET / PUT | `/admin/settings` | H | Matching weights, close-to-ready gap, hiring assumptions, Gemini toggle, AI-service status |
| POST | `/admin/settings/rotate-join-code` | H | New registration code |

## AI service (internal, `:8000`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Status, spaCy version, Gemini configured |
| POST | `/market/process` | `{path}` → cleaned postings with normalised skills, unmatched terms, optional forecast |
| POST | `/explain/learning` | Learning-plan wording `{text, source: gemini\|rules}` |
| POST | `/explain/match` | Match narrative wording `{text, source}` |

Optional header `X-Service-Token` when `AI_SERVICE_TOKEN` is set on both sides.
