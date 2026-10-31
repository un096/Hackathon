import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, Wand2 } from 'lucide-react';
import { useGet, useAction, useBase } from '../../lib/hooks';
import { post, put } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card, PageHeader, PageSkeleton, Button, Field, Callout } from '../../components/ui';
import { LEVELS } from '../../lib/format';

const EMPTY = { title: '', description: '', status: 'OPEN', priority: 'MEDIUM', openPositions: 1, minExperience: 2, workMode: 'HYBRID', location: '', startDate: '', endDate: '', departmentId: '', managerId: '', requirements: [] };
const d10 = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function ProjectForm() {
  const { id } = useParams();
  const base = useBase();
  const nav = useNavigate();
  const { user } = useAuth();
  const editing = !!id;
  const { data: skills } = useGet('skills', '/skills');
  const { data: depts } = useGet('departments', '/admin/departments');
  const { data: managers } = useGet('managers', '/admin/managers');
  const { data: existing, isLoading } = useGet('project', `/projects/${id}`, null, { enabled: editing });
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (existing) setF({ ...EMPTY, ...existing, description: existing.description || '', location: existing.location || '', startDate: d10(existing.startDate), endDate: d10(existing.endDate), departmentId: existing.departmentId || '', managerId: existing.managerId || '', requirements: existing.requirements.map((r) => ({ skillId: r.skillId, minLevel: r.minLevel, isCritical: r.isCritical, weight: r.weight })) });
  }, [existing]);

  const save = useAction((body) => (editing ? put(`/projects/${id}`, body) : post('/projects', body)), {
    invalidate: ['projects', 'project', 'manager-dashboard', 'hr-dashboard'],
    success: editing ? 'Project updated — re-run matching to refresh recommendations' : 'Project created',
    onSuccess: (d) => nav(`${base}/projects/${d.data.id}${editing ? '' : '/matching'}`),
  });

  if (editing && isLoading) return <PageSkeleton />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setReq = (i, k, v) => setF({ ...f, requirements: f.requirements.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });
  const addReq = () => setF({ ...f, requirements: [...f.requirements, { skillId: '', minLevel: 3, isCritical: false, weight: 1 }] });
  const demo = () => {
    const by = (n) => skills.find((s) => s.name === n)?.id;
    setF({ ...f, title: 'Customer Analytics Portal', description: 'React dashboard, Node.js APIs, Python scoring jobs and a PostgreSQL warehouse.', priority: 'HIGH', openPositions: 2, minExperience: 3,
      requirements: [{ skillId: by('React'), minLevel: 4, isCritical: true, weight: 1.5 }, { skillId: by('Node.js'), minLevel: 4, isCritical: true, weight: 1.5 }, { skillId: by('Python'), minLevel: 3, isCritical: false, weight: 1 }, { skillId: by('PostgreSQL'), minLevel: 3, isCritical: false, weight: 1 }] });
  };
  const submit = (e) => {
    e.preventDefault(); setErr('');
    if (!f.requirements.length || f.requirements.some((r) => !r.skillId)) return setErr('Add at least one requirement and choose a skill for each row.');
    save.mutate({
      title: f.title, description: f.description || undefined, status: f.status, priority: f.priority, openPositions: Number(f.openPositions), minExperience: Number(f.minExperience),
      workMode: f.workMode, location: f.location || undefined, startDate: f.startDate || null, endDate: f.endDate || null, departmentId: f.departmentId || null,
      ...(user.role === 'HR' && { managerId: f.managerId || null }),
      requirements: f.requirements.map((r) => ({ skillId: r.skillId, minLevel: Number(r.minLevel), isCritical: !!r.isCritical, weight: Number(r.weight) })),
    });
  };

  return (
    <div>
      <PageHeader eyebrow={editing ? 'Edit project' : 'Create project'} title={editing ? f.title || 'Edit project' : 'New internal project'} subtitle="Requirements drive the matching engine: verified level thresholds per skill, with critical skills enforced as mandatory."
        actions={!editing && skills && <Button variant="secondary" icon={Wand2} onClick={demo}>Fill demo scenario</Button>} />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Project details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Title"><input className="input" required minLength={3} value={f.title} onChange={set('title')} /></Field></div>
            <div className="sm:col-span-2"><Field label="Description"><textarea className="input min-h-[90px]" value={f.description} onChange={set('description')} /></Field></div>
            <Field label="Status"><select className="input" value={f.status} onChange={set('status')}>{['DRAFT', 'OPEN', 'STAFFING', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select></Field>
            <Field label="Priority"><select className="input" value={f.priority} onChange={set('priority')}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select></Field>
            <Field label="Open positions"><input type="number" min="1" max="50" className="input" value={f.openPositions} onChange={set('openPositions')} /></Field>
            <Field label="Minimum experience (years)"><input type="number" min="0" max="30" step="0.5" className="input" value={f.minExperience} onChange={set('minExperience')} /></Field>
            <Field label="Work mode"><select className="input" value={f.workMode} onChange={set('workMode')}><option value="HYBRID">Hybrid</option><option value="REMOTE">Remote</option><option value="ONSITE">On-site</option></select></Field>
            <Field label="Location"><input className="input" value={f.location} onChange={set('location')} /></Field>
            <Field label="Start date"><input type="date" className="input" value={f.startDate} onChange={set('startDate')} /></Field>
            <Field label="End date"><input type="date" className="input" value={f.endDate} onChange={set('endDate')} /></Field>
            <Field label="Department"><select className="input" value={f.departmentId} onChange={set('departmentId')}><option value="">—</option>{(depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
            {user.role === 'HR' && <Field label="Project manager"><select className="input" value={f.managerId} onChange={set('managerId')}><option value="">—</option>{(managers || []).map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></Field>}
          </div>
        </Card>
        <Card title="Skill requirements" subtitle="Critical = mandatory threshold" actions={<Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addReq}>Add</Button>}>
          <div className="space-y-3">
            {f.requirements.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex gap-2">
                  <select className="input" value={r.skillId} onChange={(e) => setReq(i, 'skillId', e.target.value)}><option value="">Skill…</option>{(skills || []).map((s) => <option key={s.id} value={s.id} disabled={f.requirements.some((x, j) => j !== i && x.skillId === s.id)}>{s.name}</option>)}</select>
                  <button type="button" onClick={() => setF({ ...f, requirements: f.requirements.filter((_, j) => j !== i) })} className="rounded p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Field label="Min verified level"><select className="input" value={r.minLevel} onChange={(e) => setReq(i, 'minLevel', e.target.value)}>{[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>L{l} {LEVELS[l]}</option>)}</select></Field>
                  <Field label="Weight"><select className="input" value={r.weight} onChange={(e) => setReq(i, 'weight', e.target.value)}>{[0.5, 1, 1.5, 2, 3].map((w) => <option key={w} value={w}>{w}×</option>)}</select></Field>
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-rose-600" checked={r.isCritical} onChange={(e) => setReq(i, 'isCritical', e.target.checked)} />Critical (mandatory)</label>
              </div>
            ))}
            {!f.requirements.length && <p className="text-sm muted">No requirements yet.</p>}
          </div>
          {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
          {editing && <div className="mt-3"><Callout tone="amber">Changing requirements clears open machine recommendations. Shortlist decisions are kept.</Callout></div>}
          <Button type="submit" className="mt-4 w-full" icon={Save} loading={save.isPending}>{editing ? 'Save project' : 'Create & open matching'}</Button>
        </Card>
      </form>
    </div>
  );
}
