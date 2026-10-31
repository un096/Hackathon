import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusSquare, FolderKanban, Sparkles } from 'lucide-react';
import { useGet, useBase } from '../../lib/hooks';
import { Card, PageHeader, PageSkeleton, ErrorState, Table, StatusBadge, Badge, Empty, Button, Tabs, SearchInput } from '../../components/ui';
import { fmtDate } from '../../lib/format';

export function ProjectsTable({ rows, base }) {
  return (
    <Table>
      <thead><tr><th className="th">Project</th><th className="th">Status</th><th className="th">Priority</th><th className="th">Requirements</th><th className="th">Staffing</th><th className="th">Matching</th><th className="th">Start</th><th className="th" /></tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
            <td className="td"><Link to={`${base}/projects/${p.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">{p.title}</Link><div className="text-xs muted">{p.department?.name}{p.manager ? ` · ${p.manager.firstName} ${p.manager.lastName}` : ''}</div></td>
            <td className="td"><StatusBadge status={p.status} /></td>
            <td className="td"><StatusBadge status={p.priority} /></td>
            <td className="td"><div className="flex max-w-xs flex-wrap gap-1">{p.requirements.map((r) => <Badge key={r.id} tone={r.isCritical ? 'red' : 'slate'}>{r.skill.name} L{r.minLevel}</Badge>)}</div></td>
            <td className="td text-sm">{p.filled}/{p.openPositions}</td>
            <td className="td text-xs">{p.lastMatchedAt ? <span>{p.stats.eligible} eligible · {p.stats.nearlyReady} close{p.stats.shortlisted ? ` · ${p.stats.shortlisted} shortlisted` : ''}</span> : <span className="muted">Not run</span>}</td>
            <td className="td text-xs muted">{fmtDate(p.startDate)}</td>
            <td className="td text-right">{!['COMPLETED', 'CANCELLED'].includes(p.status) && <Link to={`${base}/projects/${p.id}/matching`}><Button size="sm" variant="secondary" icon={Sparkles}>Match</Button></Link>}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export default function ProjectList() {
  const base = useBase();
  const [scope, setScope] = useState('mine');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading, error, refetch } = useGet('projects', '/projects', { scope: scope === 'all' ? 'all' : undefined, status: status || undefined }, { placeholderData: (p) => p });
  if (error) return <ErrorState error={error} retry={refetch} />;
  const rows = (data || []).filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader eyebrow="Projects" title="Project list" subtitle="Define skill requirements, run AI talent matching and staff projects from inside the organization."
        actions={<Link to={`${base}/projects/new`}><Button icon={PlusSquare}>Create project</Button></Link>} />
      <Tabs value={scope} onChange={setScope} tabs={[{ value: 'mine', label: 'My projects' }, { value: 'all', label: 'All organization projects' }]} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search projects…" />
        <select className="input max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['DRAFT', 'OPEN', 'STAFFING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select>
      </div>
      <Card padded={false}>{isLoading && !data ? <div className="p-6"><PageSkeleton /></div> : rows.length ? <ProjectsTable rows={rows} base={base} /> : <Empty icon={FolderKanban} title="No projects found" action={<Link to={`${base}/projects/new`}><Button size="sm">Create project</Button></Link>} />}</Card>
    </div>
  );
}
