import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquarePlus, Mail, Building2, ArrowLeft } from 'lucide-react';
import { useGet, useAction, useBase } from '../../lib/hooks';
import { post } from '../../lib/api';
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Modal, Field, Avatar, StatusBadge, Stat, Badge, Table } from '../../components/ui';
import { SkillsTable, EvidenceSide } from '../../components/PassportView';
import { LEVELS } from '../../lib/format';

export default function EmployeeReview() {
  const { id } = useParams();
  const base = useBase();
  const { data, isLoading, error, refetch } = useGet('employee', `/employees/${id}`);
  const [open, setOpen] = useState(false);
  const [fb, setFb] = useState({ rating: 4, comment: '', reviewerRole: 'MANAGER', context: '', skillRatings: {} });
  const [certLevel, setCertLevel] = useState(null);

  const give = useAction((b) => post(`/employees/${id}/feedback`, b), {
    invalidate: ['employee', 'employees', 'manager-dashboard'],
    success: (d) => `Feedback recorded${d.data.skillUpdates.length ? ` · ${d.data.skillUpdates.map((u) => `${u.skill}: ${u.verifiedLevel ? `L${u.verifiedLevel}` : 'in review'}`).join(', ')}` : ''}`,
    onSuccess: () => { setOpen(false); setFb({ rating: 4, comment: '', reviewerRole: 'MANAGER', context: '', skillRatings: {} }); },
  });
  const verify = useAction(({ cert, level }) => post(`/employees/${id}/certifications/${cert.id}/verify`, { level }), { success: 'Certification verified and added as evidence', invalidate: ['employee'], onSuccess: () => setCertLevel(null) });

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const name = `${data.user.firstName} ${data.user.lastName}`;
  const submit = () => give.mutate({ rating: Number(fb.rating), comment: fb.comment, reviewerRole: fb.reviewerRole, context: fb.context || undefined, skillRatings: Object.entries(fb.skillRatings).filter(([, l]) => l).map(([skillId, level]) => ({ skillId, level: Number(level) })) });

  return (
    <div>
      <Link to={base === '/hr' ? '/hr/employees' : '/manager/team'} className="mb-3 inline-flex items-center gap-1 text-sm muted hover:text-slate-700"><ArrowLeft className="h-4 w-4" />Back</Link>
      <PageHeader eyebrow="Employee details & skill review" title={<span className="flex items-center gap-3"><Avatar name={name} />{name}</span>}
        subtitle={<span className="flex flex-wrap items-center gap-3"><span>{data.designation}</span><span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{data.department?.name}</span><span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{data.user.email}</span><StatusBadge status={data.availability} /></span>}
        actions={<Button icon={MessageSquarePlus} onClick={() => setOpen(true)}>Record feedback</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Verified skills" value={data.summary.verifiedCount} tone="green" />
        <Stat label="Unverified claims" value={data.summary.unverifiedClaims} tone="amber" />
        <Stat label="Experience" value={`${data.experienceYears} yrs`} />
        <Stat label="Allocation" value={`${data.allocationPercent}%`} tone="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Skill Passport" subtitle="Claimed (outline) vs verified (filled). Expand a row to see the evidence and how the level was computed." padded={false}><SkillsTable passport={data} /></Card>
          <Card title="Project recommendations" padded={false}>
            {data.recommendations.length ? (
              <Table>
                <thead><tr><th className="th">Project</th><th className="th">Readiness</th><th className="th">Eligible</th><th className="th">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.recommendations.map((r) => <tr key={r.id}><td className="td"><Link className="text-brand-600 hover:underline" to={`${base}/projects/${r.project.id}/matching`}>{r.project.title}</Link></td><td className="td">{r.readinessScore}</td><td className="td">{r.eligible ? <Badge tone="green">Yes</Badge> : r.nearlyReady ? <Badge tone="amber">Close</Badge> : <Badge>No</Badge>}</td><td className="td"><StatusBadge status={r.status} /></td></tr>)}</tbody>
              </Table>
            ) : <p className="p-5 text-sm muted">Not evaluated for any project yet.</p>}
          </Card>
          {data.learning.length > 0 && (
            <Card title="Learning plans">
              <ul className="space-y-2 text-sm">{data.learning.map((l) => <li key={l.id} className="flex items-center justify-between"><span>{l.skill.name} · L{l.currentLevel} → L{l.targetLevel}</span><span className="flex items-center gap-2"><span className="text-xs muted">{Math.round(l.progressPercent)}%</span><StatusBadge status={l.status} /></span></li>)}</ul>
            </Card>
          )}
        </div>
        <EvidenceSide passport={data} onVerifyCert={(c) => setCertLevel({ cert: c, level: 3 })} />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={`Feedback for ${name}`} wide
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={give.isPending} disabled={fb.comment.trim().length < 5} onClick={submit}>Save feedback</Button></>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Reviewer role"><select className="input" value={fb.reviewerRole} onChange={(e) => setFb({ ...fb, reviewerRole: e.target.value })}><option value="MANAGER">Manager</option><option value="TEAM_LEAD">Team lead</option></select></Field>
          <Field label="Overall rating (1–5)"><select className="input" value={fb.rating} onChange={(e) => setFb({ ...fb, rating: e.target.value })}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select></Field>
          <Field label="Context"><input className="input" placeholder="e.g. Q3 review" value={fb.context} onChange={(e) => setFb({ ...fb, context: e.target.value })} /></Field>
          <div className="sm:col-span-3"><Field label="Comment (documented, visible to the employee)"><textarea className="input min-h-[80px]" value={fb.comment} onChange={(e) => setFb({ ...fb, comment: e.target.value })} /></Field></div>
        </div>
        <div className="mt-4">
          <div className="label">Skill ratings — become MANAGER/TEAM LEAD evidence (weight 10% / 5%)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.skills.map((s) => (
              <div key={s.skillId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <span>{s.skill.name} <span className="text-xs muted">(claimed L{s.claimedLevel || 0}, verified L{s.verifiedLevel || 0})</span></span>
                <select className="input w-28 py-1" value={fb.skillRatings[s.skillId] || ''} onChange={(e) => setFb({ ...fb, skillRatings: { ...fb.skillRatings, [s.skillId]: e.target.value } })}>
                  <option value="">—</option>{[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>L{l} {LEVELS[l]}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs muted">Feedback alone does not verify a skill: the engine still requires an objective assessment.</p>
        </div>
      </Modal>

      <Modal open={!!certLevel} onClose={() => setCertLevel(null)} title="Verify certification"
        footer={<><Button variant="secondary" onClick={() => setCertLevel(null)}>Cancel</Button><Button loading={verify.isPending} onClick={() => verify.mutate(certLevel)}>Verify</Button></>}>
        {certLevel && <div className="space-y-3 text-sm"><p>Confirm <b>{certLevel.cert.name}</b> ({certLevel.cert.issuer}) is genuine. It will be recorded as certification evidence.</p>
          <Field label="Level evidenced by this certification"><select className="input" value={certLevel.level} onChange={(e) => setCertLevel({ ...certLevel, level: Number(e.target.value) })}>{[2, 3, 4].map((l) => <option key={l} value={l}>L{l} {LEVELS[l]}</option>)}</select></Field></div>}
      </Modal>
    </div>
  );
}
