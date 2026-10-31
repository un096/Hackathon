# The 29 screens

| # | Screen | Route | Portal |
|---|---|---|---|
| 1 | Landing Page | `/` | Public |
| 2 | Login | `/login` | Public |
| 3 | Registration | `/register` | Public |
| 4 | Employee Dashboard | `/employee` | Employee |
| 5 | My Profile | `/employee/profile` | Employee |
| 6 | Skill Passport | `/employee/passport` | Employee |
| 7 | Skill Assessments | `/employee/assessments` | Employee |
| 8 | Take Assessment | `/employee/assessments/:id/take` | Employee |
| 9 | Assessment Results | `/employee/results/:id` | Employee |
| 10 | Skill Gap Analysis | `/employee/gap` | Employee |
| 11 | Personalized Learning Plan | `/employee/learning` | Employee |
| 12 | Internal Project Opportunities | `/employee/opportunities` | Employee |
| 13 | Badges and Achievements | `/employee/badges` | Employee |
| 14 | Manager Dashboard | `/manager` | Manager |
| 15 | Team Directory | `/manager/team` | Manager |
| 16 | Employee Details and Skill Review | `/manager/team/:id` (HR: `/hr/employees/:id`) | Manager / HR |
| 17 | Project List | `/manager/projects` | Manager |
| 18 | Create/Edit Project | `/manager/projects/new`, `/:id/edit` (HR: `/hr/projects/…`) | Manager / HR |
| 19 | Project Details | `/manager/projects/:id` | Manager / HR |
| 20 | AI Talent Matching and Candidate Comparison | `/manager/projects/:id/matching` | Manager / HR |
| 21 | Assignment Approvals | `/manager/approvals` (HR: `/hr/approvals`) | Manager / HR |
| 22 | HR Dashboard | `/hr` | HR |
| 23 | Employee Management | `/hr/employees` | HR |
| 24 | Project Oversight | `/hr/projects` | HR |
| 25 | Market Skill Intelligence | `/hr/market` | HR |
| 26 | Workforce Analytics | `/hr/analytics` | HR |
| 27 | Internal vs External Hiring Insights | `/hr/hiring` | HR |
| 28 | User and Role Management | `/hr/users` | HR |
| 29 | Audit Logs and System Settings | `/hr/audit` | HR |

Each portal has its own sidebar and accent. Managers and HR can open their own Skill Passport ("My passport" in the top bar). Light/dark theme toggle in the top bar; all layouts are responsive down to 360 px.
