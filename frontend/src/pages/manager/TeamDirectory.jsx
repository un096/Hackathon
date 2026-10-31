import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useGet, useBase } from '../../lib/hooks';
import { Card, PageHeader, PageSkeleton, ErrorState, Table, Avatar, StatusBadge, Badge, Empty, SearchInput, Tabs } from '../../components/ui';

export default function TeamDirectory() {
  const base = useBase();
  const [scope, setScope] = useState('team');
  const [q, setQ] = useState('');
  const [skillId, setSkillId] = useState('');
  const [availability, setAvailability] = useState('');
  const { data: skills } = useGet('skills', '/skills');
  const { data, isLoading, error, refetch } = useGet('employees', '/employees', { scope, q: q || undefined, skillId: skillId || undefined, availability: availability || undefined }, { placeholderData: (p) => p });
  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <div>
      <PageHeader eyebrow="Team directory" title="People and verified skills" subtitle="Search by name, title or skill. Filter by a verified skill to discover hidden talent anywhere in the organization." />
      <Tabs value={scope} onChange={setScope} tabs={[{ value: 'team', label: 'My direct reports' }, { value: 'all', label: 'Whole organization' }]} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Name, title or skill…" />
        <select className="input max-w-[200px]" value={skillId} onChange={(e) => setSkillId(e.target.value)}><option value="">Any verified skill</option>{(skills || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select className="input max-w-[200px]" value={availability} onChange={(e) => setAvailability(e.target.value)}><option value="">Any availability</option><option value="AVAILABLE">Available</option><option value="PARTIALLY_AVAILABLE">Partially available</option><option value="ON_PROJECT">On project</option><option value="ON_LEAVE">On leave</option></select>
      </div>
      <Card padded={false}>
        {isLoading && !data ? <div className="p-6"><PageSkeleton /></div> : !data.length ? <Empty icon={Users} title="No people match these filters" /> : (
          <Table>
            <thead><tr><th className="th">Employee</th><th className="th">Department</th><th className="th">Experience</th><th className="th">Top verified skills</th><th className="th">Verified / claimed</th><th className="th">Availability</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="td"><Link to={`${base}/${base === '/hr' ? 'employees' : 'team'}/${e.id}`} className="flex items-center gap-3"><Avatar name={e.name} size="sm" /><div><div className="font-medium text-brand-700 hover:underline dark:text-brand-300">{e.name}</div><div className="text-xs muted">{e.designation}</div></div></Link></td>
                  <td className="td text-sm">{e.department || '—'}</td>
                  <td className="td text-sm">{e.experienceYears} yrs</td>
                  <td className="td"><div className="flex flex-wrap gap-1">{e.topSkills.length ? e.topSkills.map((s) => <Badge key={s.name} tone="green">{s.name} L{s.level}</Badge>) : <span className="text-xs muted">none verified</span>}</div></td>
                  <td className="td text-sm">{e.verifiedCount} / {e.claimedCount}</td>
                  <td className="td"><StatusBadge status={e.availability} />{e.allocationPercent > 0 && <div className="mt-0.5 text-xs muted">{e.allocationPercent}% allocated</div>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
