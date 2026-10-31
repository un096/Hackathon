import { Link } from 'react-router-dom';
import { BadgeCheck, ClipboardCheck, GraduationCap, Trophy, ArrowRight, Briefcase, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useGet } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { Card, PageHeader, Stat, PageSkeleton, ErrorState, Empty, Badge, StatusBadge, Progress, ScoreRing, Button, LevelPill } from '../../components/ui';
import { axis, grid, tooltip } from '../../components/charts';
import { ago, humanize } from '../../lib/format';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useGet('me-dashboard', '/me/dashboard');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const s = data.summary;
  const chart = data.skills.slice(0, 8).map((x) => ({ name: x.name, Claimed: x.claimed, Verified: x.verified }));

  return (
    <div>
      <PageHeader eyebrow="Employee dashboard" title={`Hi ${user.firstName}, here is your growth snapshot`} subtitle="Your verified skills unlock internal projects. Prove what you can do, close the gaps, get deployed."
        actions={<Link to="/employee/assessments"><Button icon={ClipboardCheck}>Take an assessment</Button></Link>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={BadgeCheck} tone="green" label="Verified skills" value={s.verifiedCount} hint={`${s.claimedCount} claimed · avg verified L${s.avgVerifiedLevel}`} />
        <Stat icon={ClipboardCheck} tone="amber" label="Claims awaiting proof" value={s.unverifiedClaims} hint="Take assessments to verify" />
        <Stat icon={GraduationCap} tone="violet" label="Learning plans" value={data.learning.active} hint={`${data.learning.completed} completed`} />
        <Stat icon={Trophy} label="Reward points" value={data.employee.points} hint={`${data.badges} badges earned`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Claimed vs verified proficiency" subtitle="Claimed levels are self-reported; verified levels come only from evidence.">
          {chart.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={chart} barGap={2}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="name" {...axis} interval={0} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} {...axis} width={24} />
                  <Tooltip {...tooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Claimed" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Verified" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No skills yet" text="Add skills to your Skill Passport to get started." action={<Link to="/employee/passport"><Button size="sm">Open Skill Passport</Button></Link>} />}
        </Card>

        <Card title="Prove these next" subtitle="Claimed skills without objective evidence">
          {data.toVerify.length ? (
            <ul className="space-y-2.5">
              {data.toVerify.slice(0, 5).map((t) => (
                <li key={t.skillId} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">{t.name} <LevelPill level={t.claimedLevel} kind="claimed" /></span>
                  <Link to={`/employee/assessments?skill=${t.skillId}`} className="text-xs font-medium text-brand-600 hover:underline">Assess →</Link>
                </li>
              ))}
            </ul>
          ) : <Empty icon={BadgeCheck} title="All claims verified" text="Great — every claimed skill has evidence." />}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Best-matching internal projects" subtitle="Live readiness from the explainable matching engine" actions={<Link to="/employee/opportunities" className="text-xs font-medium text-brand-600">View all</Link>}>
          {data.topOpportunities.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.topOpportunities.map((o) => (
                <div key={o.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <ScoreRing value={o.readiness} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-medium">{o.title}{o.eligible ? <Badge tone="green">Eligible</Badge> : o.nearlyReady ? <Badge tone="amber">Close to ready</Badge> : <Badge>Gaps</Badge>}</div>
                    <p className="mt-0.5 truncate text-xs muted">{o.summary}</p>
                  </div>
                  <Link to="/employee/opportunities"><ArrowRight className="h-4 w-4 text-slate-400" /></Link>
                </div>
              ))}
            </div>
          ) : <Empty icon={Briefcase} title="No open projects" text="New internal projects will appear here." />}
        </Card>

        <Card title="Active learning" actions={<Link to="/employee/learning" className="text-xs font-medium text-brand-600">Open plan</Link>}>
          {data.learning.items.length ? (
            <ul className="space-y-4">
              {data.learning.items.map((l) => (
                <li key={l.id}>
                  <div className="flex items-center justify-between text-sm"><span className="font-medium">{l.skill.name}</span><span className="text-xs muted">L{l.currentLevel} → L{l.targetLevel}</span></div>
                  <Progress className="mt-1.5" value={l.progressPercent} />
                  <div className="mt-1 flex justify-between text-xs muted"><StatusBadge status={l.status} /><span>{Math.round(l.progressPercent)}%</span></div>
                </li>
              ))}
            </ul>
          ) : <Empty icon={Sparkles} title="No active plans" text="Run a gap analysis against a project to get a personalised plan." action={<Link to="/employee/gap"><Button size="sm" variant="secondary">Analyse my gaps</Button></Link>} />}
        </Card>
      </div>

      <Card className="mt-6" title="Recent activity">
        {data.activity.length ? (
          <ul className="space-y-2 text-sm">
            {data.activity.map((a) => <li key={a.id} className="flex justify-between gap-4"><span>{humanize(a.action)}{a.after?.assessment ? ` · ${a.after.assessment} (${a.after.score}%)` : a.after?.skill ? ` · ${a.after.skill}` : a.after?.project ? ` · ${a.after.project}` : ''}</span><span className="shrink-0 text-xs muted">{ago(a.createdAt)}</span></li>)}
          </ul>
        ) : <p className="text-sm muted">No activity yet.</p>}
      </Card>
    </div>
  );
}
