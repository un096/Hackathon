import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { Eye, AlertTriangle, ShieldCheck, Users } from 'lucide-react';
import { useGet } from '../../lib/hooks';
import { Card, PageHeader, PageSkeleton, ErrorState, Stat, Table, Badge, Progress, SearchInput } from '../../components/ui';
import { axis, grid, tooltip } from '../../components/charts';
import { humanize } from '../../lib/format';

export default function WorkforceAnalytics() {
  const { data, isLoading, error, refetch } = useGet('workforce', '/analytics/workforce');
  const [q, setQ] = useState('');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const t = data.totals;
  const inv = data.inventory.filter((x) => !q || x.skill.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader eyebrow="Workforce analytics" title="Skill inventory & verification" subtitle="Computed from Skill Passports, evidence, assessments and learning records in your organization." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="People with skills recorded" value={t.employeesWithSkills} />
        <Stat icon={ShieldCheck} tone="green" label="Verified skill records" value={t.verified} hint={`${t.claimed} claimed`} />
        <Stat icon={Eye} tone="violet" label="Hidden talent" value={t.hiddenTalent} hint="Verified skills nobody claimed" />
        <Stat icon={AlertTriangle} tone="amber" label="Over-claimed" value={t.overClaimed} hint="Claimed above verified level" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Claimed vs verified by skill" subtitle="Top 12 skills">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.inventory.slice(0, 12)}>
                <CartesianGrid {...grid} /><XAxis dataKey="skill" {...axis} interval={0} angle={-25} textAnchor="end" height={55} /><YAxis {...axis} allowDecimals={false} width={24} />
                <Tooltip {...tooltip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="claimed" name="Claimed" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="verified" name="Verified" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Verified level distribution">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.levelDistribution}><CartesianGrid {...grid} /><XAxis dataKey="level" {...axis} /><YAxis {...axis} allowDecimals={false} width={24} /><Tooltip {...tooltip} /><Bar dataKey="count" name="Skill records" fill="#1d4ed8" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Evidence recorded per month" subtitle="How fast the organization is turning claims into proof">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={data.evidenceTimeline}><CartesianGrid {...grid} /><XAxis dataKey="month" {...axis} /><YAxis {...axis} allowDecimals={false} width={24} /><Tooltip {...tooltip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="assessments" name="Assessments" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                <Line dataKey="feedback" name="Feedback" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line dataKey="projects" name="Project delivery" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line dataKey="certifications" name="Certifications" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Assessments & learning">
          {data.assessments.map((a) => (
            <div key={a.type} className="mb-4">
              <div className="flex justify-between text-sm"><span className="font-medium">{a.type === 'MCQ' ? 'MCQ' : 'Practical'}</span><span className="muted">{a.attempts} attempts · avg {a.avgScore}%</span></div>
              <Progress className="mt-1" value={a.passRate} tone="green" /><div className="mt-0.5 text-xs muted">{a.passRate}% pass rate</div>
            </div>
          ))}
          <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide muted">Learning plans</div>
            <ul className="space-y-1 text-sm">{data.learning.map((l) => <li key={l.status} className="flex justify-between"><span>{humanize(l.status)}</span><span className="font-medium">{l.count}</span></li>)}</ul>
          </div>
        </Card>
      </div>

      <Card className="mt-6" title="Verification by department" padded={false}>
        <Table>
          <thead><tr><th className="th">Department</th><th className="th">Headcount</th><th className="th">Claimed skills</th><th className="th">Verified skills</th><th className="th">Claim verification rate</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.byDepartment.map((d) => <tr key={d.department}><td className="td font-medium">{d.department}</td><td className="td">{d.headcount}</td><td className="td">{d.claimed}</td><td className="td">{d.verified}</td><td className="td w-64"><div className="flex items-center gap-2"><Progress value={d.verificationRate} tone="green" /><span className="w-12 text-right text-xs">{d.verificationRate}%</span></div></td></tr>)}</tbody>
        </Table>
      </Card>

      <Card className="mt-6" title="Skill inventory" padded={false} actions={<SearchInput value={q} onChange={setQ} placeholder="Filter skills…" />}>
        <Table>
          <thead><tr><th className="th">Skill</th><th className="th">Category</th><th className="th">Claimed</th><th className="th">Verified</th><th className="th">Avg verified level</th><th className="th">L1–L5 distribution</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{inv.map((s) => <tr key={s.skill}><td className="td font-medium">{s.skill}</td><td className="td text-sm muted">{s.category}</td><td className="td">{s.claimed}</td><td className="td">{s.verified}</td><td className="td">{s.avgVerifiedLevel || '—'}</td><td className="td"><div className="flex gap-1">{s.levels.map((c, i) => <Badge key={i} tone={c ? 'green' : 'slate'}>L{i + 1}:{c}</Badge>)}</div></td></tr>)}</tbody>
        </Table>
      </Card>
    </div>
  );
}
