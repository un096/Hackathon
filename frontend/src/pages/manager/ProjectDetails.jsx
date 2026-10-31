import { Link, useParams } from 'react-router-dom';
import { Pencil, Sparkles, CheckCircle2, Users, Calendar, MapPin, Hand } from 'lucide-react';
import { useGet, useAction, useBase } from '../../lib/hooks';
import { post } from '../../lib/api';
import { Card, PageHeader, PageSkeleton, ErrorState, Button, StatusBadge, Badge, Table, Stat, Empty, Avatar } from '../../components/ui';
import { fmtDate, humanize, ago } from '../../lib/format';

export default function ProjectDetails() {
  const { id } = useParams();
  const base = useBase();
  const { data, isLoading, error, refetch } = useGet('project', `/projects/${id}`);
  const complete = useAction((aid) => post(`/projects/${id}/assignments/${aid}/complete`, {}), { invalidate: ['project', 'projects'], success: (d) => `Assignment completed · ${d.data.skillUpdates} skill(s) received project evidence` });
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const supplyBy = new Map(data.supply.map((s) => [s.skillId, s]));
  const counts = Object.fromEntries(data.recommendationCounts.map((c) => [c.status, c._count]));
  const active = data.assignments.filter((a) => a.status === 'ACTIVE');

  return (
    <div>
      <PageHeader eyebrow="Project details" title={data.title}
        subtitle={<span className="flex flex-wrap items-center gap-3"><StatusBadge status={data.status} /><StatusBadge status={data.priority} /><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{humanize(data.workMode)}{data.location ? ` · ${data.location}` : ''}</span><span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmtDate(data.startDate)} – {fmtDate(data.endDate)}</span></span>}
        actions={<>
          {data.canManage && <Link to={`${base}/projects/${id}/edit`}><Button variant="secondary" icon={Pencil}>Edit</Button></Link>}
          {!['COMPLETED', 'CANCELLED'].includes(data.status) && <Link to={`${base}/projects/${id}/matching`}><Button icon={Sparkles}>AI talent matching</Button></Link>}
        </>} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat icon={Users} label="Positions filled" value={`${active.length}/${data.openPositions}`} />
        <Stat label="Recommended" value={counts.RECOMMENDED || 0} tone="violet" hint={data.lastMatchedAt ? `matched ${ago(data.lastMatchedAt)}` : 'matching not run'} />
        <Stat label="Shortlisted (awaiting HR)" value={counts.SHORTLISTED || 0} tone="amber" />
        <Stat label="Min. experience" value={`${data.minExperience} yrs`} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="About">
            <p className="text-sm leading-relaxed">{data.description || 'No description.'}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs muted">Manager</dt><dd>{data.manager ? `${data.manager.firstName} ${data.manager.lastName}` : '—'}</dd></div>
              <div><dt className="text-xs muted">Department</dt><dd>{data.department?.name || '—'}</dd></div>
              <div><dt className="text-xs muted">Created by</dt><dd>{data.createdBy.firstName} {data.createdBy.lastName} · {fmtDate(data.createdAt)}</dd></div>
            </dl>
          </Card>
          <Card title="Skill requirements & internal supply" subtitle="People in the organization whose VERIFIED level meets each threshold" padded={false}>
            <Table>
              <thead><tr><th className="th">Skill</th><th className="th">Min level</th><th className="th">Weight</th><th className="th">Verified at level</th><th className="th">Claimed only</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.requirements.map((r) => { const s = supplyBy.get(r.skillId); return (
                  <tr key={r.id}><td className="td font-medium">{r.skill.name} {r.isCritical && <Badge tone="red">Critical</Badge>}</td><td className="td">L{r.minLevel}</td><td className="td">{r.weight}×</td><td className="td"><span className={s.verifiedAtLevel ? 'font-semibold text-emerald-600' : 'text-rose-600'}>{s.verifiedAtLevel}</span></td><td className="td muted">{s.claimedOnly}</td></tr>
                ); })}
              </tbody>
            </Table>
          </Card>
          <Card title="Team & assignment history" padded={false}>
            {data.assignments.length ? (
              <Table>
                <thead><tr><th className="th">Employee</th><th className="th">Role</th><th className="th">Allocation</th><th className="th">Readiness at assign</th><th className="th">Status</th><th className="th" /></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.assignments.map((a) => (
                    <tr key={a.id}>
                      <td className="td"><div className="flex items-center gap-2"><Avatar size="sm" name={`${a.employee.user.firstName} ${a.employee.user.lastName}`} />{a.employee.user.firstName} {a.employee.user.lastName}</div></td>
                      <td className="td text-sm">{a.role || '—'}</td><td className="td text-sm">{a.allocationPercent}%</td><td className="td text-sm">{a.readinessAtAssign ?? '—'}</td>
                      <td className="td"><StatusBadge status={a.status} /></td>
                      <td className="td text-right">{a.status === 'ACTIVE' && data.canManage && <Button size="sm" variant="secondary" icon={CheckCircle2} loading={complete.isPending && complete.variables === a.id} onClick={() => complete.mutate(a.id)}>Mark delivered</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <Empty icon={Users} title="Nobody deployed yet" text="Run AI talent matching, shortlist candidates and send them to HR for approval." />}
          </Card>
        </div>
        <Card title="Employee interest" subtitle="Employees who raised their hand from Project Opportunities">
          {data.interests.length ? (
            <ul className="space-y-2 text-sm">{data.interests.map((i) => <li key={i.at} className="flex items-center justify-between"><span className="flex items-center gap-2"><Hand className="h-4 w-4 text-brand-500" />{i.name}</span><span className="text-xs muted">{ago(i.at)}</span></li>)}</ul>
          ) : <p className="text-sm muted">No one has expressed interest yet.</p>}
        </Card>
      </div>
    </div>
  );
}
