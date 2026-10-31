import { Link } from 'react-router-dom';
import { Users, BadgeCheck, AlertCircle, GraduationCap, PlusSquare, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from 'recharts';
import { useGet } from '../../lib/hooks';
import { Card, PageHeader, Stat, PageSkeleton, ErrorState, Empty, StatusBadge, Button, Badge, Table, Callout } from '../../components/ui';
import { axis, grid, tooltip, PALETTE } from '../../components/charts';
import { humanize, ago } from '../../lib/format';

export default function ManagerDashboard() {
  const { data, isLoading, error, refetch } = useGet('manager-dashboard', '/manager/dashboard');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  return (
    <div>
      <PageHeader eyebrow="Manager dashboard" title="Your team and projects" subtitle="Find verified talent for your projects, review unverified claims and shortlist candidates for HR approval."
        actions={<Link to="/manager/projects/new"><Button icon={PlusSquare}>Create project</Button></Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Direct reports" value={data.teamSize} />
        <Stat icon={BadgeCheck} tone="green" label="Team verified skills" value={data.teamVerifiedSkills} />
        <Stat icon={AlertCircle} tone="amber" label="Unverified claims" value={data.teamUnverifiedClaims} hint="Review or ask for assessments" />
        <Stat icon={GraduationCap} tone="violet" label="Active learning plans" value={data.teamLearningActive} />
      </div>
      {data.awaitingHr > 0 && <div className="mt-4"><Callout tone="brand" title={`${data.awaitingHr} shortlisted candidate(s) waiting for HR approval`}><Link to="/manager/approvals" className="underline">Track approvals</Link></Callout></div>}

      <Card className="mt-6" title="My projects" padded={false} actions={<Link to="/manager/projects" className="text-xs font-medium text-brand-600">All projects</Link>}>
        {data.projects.length ? (
          <Table>
            <thead><tr><th className="th">Project</th><th className="th">Status</th><th className="th">Staffing</th><th className="th">Eligible</th><th className="th">Close to ready</th><th className="th">Last matched</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.projects.map((p) => (
                <tr key={p.id}>
                  <td className="td"><div className="font-medium">{p.title}</div><div className="text-xs muted">{p.requirements.join(' · ')}</div></td>
                  <td className="td"><StatusBadge status={p.status} /></td>
                  <td className="td">{p.filled}/{p.openPositions}</td>
                  <td className="td">{p.lastMatchedAt ? p.eligible : '—'}</td>
                  <td className="td">{p.lastMatchedAt ? p.nearlyReady : '—'}</td>
                  <td className="td text-xs muted">{p.lastMatchedAt ? ago(p.lastMatchedAt) : 'Not run'}</td>
                  <td className="td text-right"><Link to={`/manager/projects/${p.id}/matching`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">Talent matching <ArrowRight className="h-3.5 w-3.5" /></Link></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <Empty title="No projects yet" action={<Link to="/manager/projects/new"><Button size="sm">Create project</Button></Link>} />}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Team skill inventory" subtitle="Verified vs claimed-only (top 10 skills)">
          {data.skillDistribution.length ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.skillDistribution} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid {...grid} horizontal={false} vertical />
                  <XAxis type="number" {...axis} allowDecimals={false} />
                  <YAxis type="category" dataKey="skill" {...axis} width={90} />
                  <Tooltip {...tooltip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="verified" name="Verified" stackId="a" fill="#10b981" />
                  <Bar dataKey="claimedOnly" name="Claimed only" stackId="a" fill="#cbd5e1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="No team skills yet" />}
        </Card>
        <Card title="Team availability">
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart><Pie data={data.availability.filter((a) => a.count)} dataKey="count" nameKey="status" innerRadius={45} outerRadius={70} paddingAngle={2}>
                {data.availability.filter((a) => a.count).map((a, i) => <Cell key={a.status} fill={PALETTE[i]} />)}
              </Pie><Tooltip {...tooltip} formatter={(v, n) => [v, humanize(n)]} /></PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-sm">{data.availability.filter((a) => a.count).map((a, i) => <li key={a.status} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i] }} />{humanize(a.status)}</span><span>{a.count}</span></li>)}</ul>
        </Card>
      </div>

      <Card className="mt-6" title="Needs your review" subtitle="Team members with claimed skills that have no objective evidence yet">
        {data.needsReview.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.needsReview.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium">{e.name}</span>
                <span className="flex flex-wrap gap-1">{e.unverified.map((s) => <Badge key={s} tone="amber">{s}</Badge>)}</span>
                <Link to={`/manager/team/${e.id}`} className="text-xs font-medium text-brand-600">Review →</Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm muted">Every claim in your team is backed by evidence.</p>}
      </Card>
    </div>
  );
}
