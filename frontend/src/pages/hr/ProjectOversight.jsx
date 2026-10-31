import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusSquare, CheckSquare, FolderKanban } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useGet } from '../../lib/hooks';
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Stat, Empty, SearchInput } from '../../components/ui';
import { ProjectsTable } from '../manager/ProjectList';
import { PALETTE, tooltip } from '../../components/charts';
import { humanize } from '../../lib/format';

export default function ProjectOversight() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, isLoading, error, refetch } = useGet('projects', '/projects', { status: status || undefined });
  const { data: approvals } = useGet('approvals', '/approvals');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const rows = data.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()));
  const byStatus = Object.entries(data.reduce((m, p) => ((m[p.status] = (m[p.status] || 0) + 1), m), {})).map(([s, c]) => ({ s, c }));
  const open = data.filter((p) => ['OPEN', 'STAFFING', 'ACTIVE'].includes(p.status));
  const pending = (approvals || []).filter((a) => a.status === 'SHORTLISTED').length;

  return (
    <div>
      <PageHeader eyebrow="Project oversight" title="All projects across the organization" subtitle="Staffing status, matching coverage and pending decisions for every project."
        actions={<><Link to="/hr/approvals"><Button variant={pending ? 'primary' : 'secondary'} icon={CheckSquare}>Pending approvals ({pending})</Button></Link><Link to="/hr/projects/new"><Button variant="secondary" icon={PlusSquare}>Create project</Button></Link></>} />
      <div className="grid gap-4 lg:grid-cols-4">
        <Stat label="Projects" value={data.length} icon={FolderKanban} />
        <Stat label="Open positions" value={open.reduce((a, p) => a + p.openPositions, 0)} tone="violet" hint={`${open.reduce((a, p) => a + p.filled, 0)} filled internally`} />
        <Stat label="Not yet matched" value={open.filter((p) => !p.lastMatchedAt).length} tone="amber" />
        <div className="card p-3">
          <div className="text-xs font-medium muted">By status</div>
          <div className="flex items-center">
            <div className="h-20 w-20"><ResponsiveContainer><PieChart><Pie data={byStatus} dataKey="c" nameKey="s" innerRadius={22} outerRadius={36}>{byStatus.map((x, i) => <Cell key={x.s} fill={PALETTE[i]} />)}</Pie><Tooltip {...tooltip} formatter={(v, n) => [v, humanize(n)]} /></PieChart></ResponsiveContainer></div>
            <ul className="ml-2 space-y-0.5 text-xs">{byStatus.map((x, i) => <li key={x.s} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i] }} />{humanize(x.s)} {x.c}</li>)}</ul>
          </div>
        </div>
      </div>
      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search projects…" />
        <select className="input max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['DRAFT', 'OPEN', 'STAFFING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select>
      </div>
      <Card padded={false}>{rows.length ? <ProjectsTable rows={rows} base="/hr" /> : <Empty title="No projects match" />}</Card>
    </div>
  );
}
