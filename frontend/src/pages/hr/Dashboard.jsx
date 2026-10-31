import { Link } from 'react-router-dom';
import { Users, ShieldCheck, FolderKanban, CheckSquare, Scale, Globe2, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useGet } from '../../lib/hooks';
import { Card, PageHeader, Stat, PageSkeleton, ErrorState, Button, Callout, DataLabel, Empty, Progress } from '../../components/ui';
import { axis, grid, tooltip } from '../../components/charts';
import { ago, humanize, fmtDate } from '../../lib/format';

export default function HrDashboard() {
  const { data, isLoading, error, refetch } = useGet('hr-dashboard', '/hr/dashboard');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const learnTotal = data.learning.reduce((a, l) => a + l.count, 0);

  return (
    <div>
      <PageHeader eyebrow="HR workforce intelligence" title="Organization overview" subtitle="Every figure is computed live from your organization's records."
        actions={<><Link to="/hr/approvals"><Button variant={data.pendingApprovals ? 'primary' : 'secondary'} icon={CheckSquare}>Approvals ({data.pendingApprovals})</Button></Link><Link to="/hr/projects/new"><Button variant="secondary">Create project</Button></Link></>} />
      {data.pendingApprovals > 0 && <div className="mb-5"><Callout title={`${data.pendingApprovals} internal deployment(s) waiting for your approval`}>Managers have shortlisted eligible candidates. <Link to="/hr/approvals" className="font-medium underline">Review now</Link></Callout></div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Active headcount" value={data.headcount} />
        <Stat icon={ShieldCheck} tone="green" label="Claim verification rate" value={`${data.verificationRate}%`} hint={`${data.verifiedSkills} verified skill records`} />
        <Stat icon={FolderKanban} tone="violet" label="Open / staffing / active" value={`${data.projects.open} / ${data.projects.staffing} / ${data.projects.active}`} />
        <Stat icon={Scale} tone="amber" label="Internal fill rate" value={`${data.internalFillRate}%`} hint={`${data.filled} of ${data.positions} open positions`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Market demand vs internal verified supply" subtitle={data.marketRun ? `${data.marketRun.source} · ${data.marketRun.rowsKept.toLocaleString()} postings · ${fmtDate(data.marketRun.periodStart)} – ${fmtDate(data.marketRun.periodEnd)}` : 'No market data'}
          actions={<>{data.marketRun && <DataLabel kind={data.marketRun.kind} />}<Link to="/hr/market" className="text-xs font-medium text-brand-600">Details</Link></>}>
          {data.marketTop.length ? (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={data.marketTop}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="skill" {...axis} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis yAxisId="l" {...axis} unit="%" width={36} />
                  <YAxis yAxisId="r" orientation="right" {...axis} allowDecimals={false} width={24} />
                  <Tooltip {...tooltip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="l" dataKey="demandPercent" name="Share of postings (%)" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="r" dataKey="internalVerified" name="Employees verified" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty icon={Globe2} title="No market data imported" action={<Link to="/hr/market"><Button size="sm">Import job postings</Button></Link>} />}
        </Card>
        <Card title="Learning pipeline" subtitle={`${learnTotal} personalised plans`}>
          <ul className="space-y-3">
            {['NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REASSESSMENT', 'COMPLETED'].map((s) => { const c = data.learning.find((l) => l.status === s)?.count || 0; return (
              <li key={s}><div className="flex justify-between text-sm"><span>{humanize(s)}</span><span className="font-medium">{c}</span></div><Progress className="mt-1" value={learnTotal ? (c / learnTotal) * 100 : 0} tone={s === 'COMPLETED' ? 'green' : 'brand'} /></li>
            ); })}
          </ul>
          <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
            <Link to="/hr/analytics" className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Workforce analytics →</Link>
            <Link to="/hr/hiring" className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Hiring insights →</Link>
          </div>
        </Card>
      </div>

      <Card className="mt-6" title="Recent activity" actions={<Link to="/hr/audit" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600">Audit log <ArrowRight className="h-3.5 w-3.5" /></Link>}>
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {data.recentActivity.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span><span className="font-medium">{a.by}</span> · {humanize(a.action)}{a.after?.project ? ` · ${a.after.project}` : a.after?.title ? ` · ${a.after.title}` : a.after?.assessment ? ` · ${a.after.assessment}` : ''}{a.after?.employee ? ` · ${a.after.employee}` : ''}</span>
              <span className="text-xs muted">{ago(a.at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
