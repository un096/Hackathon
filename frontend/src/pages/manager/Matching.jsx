import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Sparkles, ChevronDown, ChevronUp, UserCheck, GraduationCap, XCircle, GitCompare, Bot, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useGet, useAction, useBase } from '../../lib/hooks';
import { post, get, errMsg } from '../../lib/api';
import { useToast } from '../../components/toast';
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Badge, StatusBadge, Tabs, Empty, ScoreRing, Modal, Callout, Field, Avatar, LevelPill, Table, cx } from '../../components/ui';
import GapTable from '../../components/GapTable';
import { PALETTE, tooltip } from '../../components/charts';
import { ago, humanize } from '../../lib/format';

const COMP = [['skillMatch', 'Verified skill match', '#4f46e5'], ['practical', 'Practical assessment', '#0ea5e9'], ['experience', 'Relevant experience', '#10b981'], ['feedback', 'Documented feedback', '#f59e0b'], ['availability', 'Availability', '#8b5cf6']];

function ScoreBar({ components }) {
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {COMP.map(([k, , c]) => <div key={k} style={{ width: `${components[k].contribution}%`, background: c }} title={`${k}: +${components[k].contribution}`} />)}
      </div>
    </div>
  );
}

export default function Matching() {
  const { id } = useParams();
  const base = useBase();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useGet('recs', `/projects/${id}/recommendations`);
  const [tab, setTab] = useState('eligible');
  const [open, setOpen] = useState(null);
  const [sel, setSel] = useState([]);
  const [compare, setCompare] = useState(null);
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState('');
  const [narr, setNarr] = useState({});

  const run = useAction(() => post(`/projects/${id}/match`), { invalidate: ['recs', 'projects', 'project', 'manager-dashboard'], success: (d) => `Evaluated ${d.data.evaluated} people · ${d.data.eligible} eligible · ${d.data.nearlyReady} close to ready` });
  const act = useAction(({ rec, kind, note: n }) => post(`/projects/${id}/recommendations/${rec.id}/${kind}`, kind === 'learning' ? undefined : { note: n || undefined }), {
    invalidate: ['recs', 'approvals', 'manager-dashboard', 'projects'], onSuccess: () => { setDecision(null); setNote(''); },
  });

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const { project, recommendations: recs } = data;
  const groups = { eligible: recs.filter((r) => r.eligible), nearly: recs.filter((r) => !r.eligible && r.nearlyReady), not: recs.filter((r) => !r.eligible && !r.nearlyReady) };
  const list = groups[tab];

  const doCompare = async () => {
    try { setCompare(await get(`/projects/${id}/compare`, { employeeIds: sel.join(',') })); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const loadNarr = async (r) => {
    setNarr({ ...narr, [r.id]: { loading: true } });
    try { setNarr((n) => ({ ...n, [r.id]: null })); const d = await get(`/projects/${id}/recommendations/${r.id}/narrative`); setNarr((n) => ({ ...n, [r.id]: d })); } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <div>
      <PageHeader eyebrow="AI talent matching & candidate comparison" title={project.title}
        subtitle={<span>Requirements: {project.requirements.map((r) => `${r.skill.name} L${r.minLevel}${r.isCritical ? ' (critical)' : ''}`).join(' · ')} · {project.openPositions} position(s)</span>}
        actions={<>
          <Link to={`${base}/projects/${id}`}><Button variant="secondary">Project details</Button></Link>
          <Button icon={Sparkles} loading={run.isPending} onClick={() => run.mutate()}>{project.lastMatchedAt ? 'Re-run matching' : 'Run AI matching'}</Button>
        </>} />

      <Callout title="How candidates are ranked">
        Readiness = 40% verified skill match + 25% practical assessment + 15% relevant experience + 10% documented feedback + 10% availability (weights set by HR). Critical skills are a hard threshold on <b>verified</b> levels — a high score cannot override them. Ranking is deterministic; Gemini can only re-word an explanation.
      </Callout>

      {!project.lastMatchedAt ? (
        <Card className="mt-6"><Empty icon={Sparkles} title="Matching has not been run for this project" text="The engine will read every Skill Passport, check verified levels, practical results, project history, feedback and availability, then apply the thresholds." action={<Button icon={Sparkles} loading={run.isPending} onClick={() => run.mutate()}>Run AI matching</Button>} /></Card>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm muted">{recs.length} people evaluated · last run {ago(project.lastMatchedAt)}</div>
            {sel.length > 0 && <div className="flex items-center gap-2 text-sm"><span>{sel.length} selected</span><Button size="sm" variant="secondary" icon={GitCompare} disabled={sel.length < 2} onClick={doCompare}>Compare</Button><button className="text-xs muted underline" onClick={() => setSel([])}>clear</button></div>}
          </div>
          <div className="mt-3"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'eligible', label: 'Eligible', count: groups.eligible.length }, { value: 'nearly', label: 'Close to ready', count: groups.nearly.length }, { value: 'not', label: 'Not eligible', count: groups.not.length }]} /></div>
          {tab === 'nearly' && groups.nearly.length > 0 && <div className="mb-4"><Callout tone="amber" icon={GraduationCap}>These people miss critical thresholds by a small margin. Assign a learning plan — after reassessment they can re-enter the eligible list without an external hire.</Callout></div>}
          {!list.length ? <Card><Empty title="Nobody in this group" /></Card> : (
            <div className="space-y-3">
              {list.map((r) => {
                const ex = r.explanation;
                const isOpen = open === r.id;
                return (
                  <div key={r.id} className={cx('card p-4', r.status === 'SHORTLISTED' && 'ring-1 ring-violet-300', r.status === 'APPROVED' && 'ring-1 ring-emerald-300')}>
                    <div className="flex flex-wrap items-center gap-4">
                      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={sel.includes(r.employeeId)} onChange={(e) => setSel(e.target.checked ? [...sel, r.employeeId].slice(-4) : sel.filter((x) => x !== r.employeeId))} aria-label="Select for comparison" />
                      <div className="w-6 text-center text-sm font-semibold muted">#{r.rank}</div>
                      <ScoreRing value={r.readinessScore} size={56} />
                      <div className="min-w-[200px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Avatar name={r.employee.name} size="sm" />
                          <Link to={`${base}/${base === '/hr' ? 'employees' : 'team'}/${r.employee.id}`} className="font-semibold hover:underline">{r.employee.name}</Link>
                          <span className="text-xs muted">{r.employee.designation} · {r.employee.department} · {r.employee.experienceYears} yrs</span>
                          {r.status !== 'RECOMMENDED' && <StatusBadge status={r.status} />}
                          <StatusBadge status={r.employee.availability} />
                        </div>
                        <p className="mt-1 text-sm">{ex.summary}</p>
                        <div className="mt-2 max-w-xl"><ScoreBar components={ex.components} /></div>
                        <div className="mt-2 flex flex-wrap gap-1">{ex.gap.map((g) => <span key={g.skillId} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-xs dark:border-slate-700">{g.skillName}<LevelPill level={g.verified} required={g.required} /><span className="muted">/{g.required}</span></span>)}</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        {r.eligible && ['RECOMMENDED', 'REJECTED'].includes(r.status) && <Button size="sm" icon={UserCheck} onClick={() => setDecision({ rec: r, kind: 'shortlist' })}>Shortlist for HR</Button>}
                        {!r.eligible && <Button size="sm" variant="secondary" icon={GraduationCap} loading={act.isPending && act.variables?.rec.id === r.id} onClick={() => act.mutate({ rec: r, kind: 'learning' })}>Assign learning plan</Button>}
                        {['RECOMMENDED', 'SHORTLISTED'].includes(r.status) && r.status !== 'SHORTLISTED' && <Button size="sm" variant="ghost" icon={XCircle} onClick={() => setDecision({ rec: r, kind: 'reject' })}>Not a fit</Button>}
                        <button className="flex items-center justify-center gap-1 text-xs font-medium text-brand-600" onClick={() => setOpen(isOpen ? null : r.id)}>Explanation {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-4 grid gap-5 border-t border-slate-100 pt-4 lg:grid-cols-5 dark:border-slate-800">
                        <div className="lg:col-span-2">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide muted">Score breakdown</div>
                          <ul className="space-y-1.5 text-sm">
                            {COMP.map(([k, label, c]) => <li key={k} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{label} <span className="text-xs muted">({ex.components[k].weight}%)</span></span><span>{ex.components[k].score} → <b>+{ex.components[k].contribution}</b></span></li>)}
                            <li className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold dark:border-slate-800"><span>Readiness</span><span>{r.readinessScore}</span></li>
                          </ul>
                          {ex.components.experience.detail && <p className="mt-2 text-xs muted">{ex.components.experience.detail}</p>}
                          {ex.blockers.length > 0 && <div className="mt-3 space-y-1">{ex.blockers.map((b) => <div key={b} className="flex gap-1.5 text-sm text-rose-600"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{b}</div>)}</div>}
                          {ex.strengths.length > 0 && <div className="mt-3 space-y-1">{ex.strengths.map((b) => <div key={b} className="flex gap-1.5 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{b}</div>)}</div>}
                          {ex.concerns.length > 0 && <div className="mt-3 space-y-1">{ex.concerns.map((b) => <div key={b} className="flex gap-1.5 text-sm muted"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />{b}</div>)}</div>}
                          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                            {narr[r.id]?.text ? <><div className="mb-1 flex items-center gap-1 text-xs muted"><Bot className="h-3.5 w-3.5" />{narr[r.id].source === 'gemini' ? 'Worded by Gemini from the facts above' : 'Rule-based narrative (Gemini not configured)'}</div>{narr[r.id].text}</>
                              : <Button size="sm" variant="ghost" icon={Bot} onClick={() => loadNarr(r)}>Generate narrative</Button>}
                          </div>
                        </div>
                        <div className="lg:col-span-3"><div className="mb-2 text-xs font-semibold uppercase tracking-wide muted">Skill gap</div><GapTable items={ex.gap} />
                          {(r.managerNote || r.hrNote) && <div className="mt-3 text-xs muted">{r.managerNote && <div>Manager note: {r.managerNote}</div>}{r.hrNote && <div>HR note: {r.hrNote}</div>}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal open={!!decision} onClose={() => setDecision(null)} title={decision?.kind === 'shortlist' ? `Shortlist ${decision?.rec.employee.name}` : `Mark ${decision?.rec.employee.name} as not a fit`}
        footer={<><Button variant="secondary" onClick={() => setDecision(null)}>Cancel</Button><Button variant={decision?.kind === 'shortlist' ? 'primary' : 'danger'} loading={act.isPending} onClick={() => act.mutate({ ...decision, note })}>{decision?.kind === 'shortlist' ? 'Send to HR for approval' : 'Confirm'}</Button></>}>
        <Field label="Note (stored in the audit log)"><textarea className="input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder={decision?.kind === 'shortlist' ? 'Why this person?' : 'Reason'} /></Field>
      </Modal>

      <Modal open={!!compare} onClose={() => setCompare(null)} title="Candidate comparison" wide>
        {compare && (
          <div>
            <div className="h-72">
              <ResponsiveContainer>
                <RadarChart data={COMP.map(([k, label]) => ({ k: label.split(' ').slice(-1)[0], ...Object.fromEntries(compare.map((c) => [c.name, c.explanation.components[k].score])) }))}>
                  <PolarGrid /><PolarAngleAxis dataKey="k" tick={{ fontSize: 11 }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  {compare.map((c, i) => <Radar key={c.name} name={c.name} dataKey={c.name} stroke={PALETTE[i]} fill={PALETTE[i]} fillOpacity={0.12} />)}
                  <Legend wrapperStyle={{ fontSize: 12 }} /><Tooltip {...tooltip} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <Table className="mt-4">
              <thead><tr><th className="th" />{compare.map((c) => <th key={c.id} className="th">{c.name}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <tr><td className="td font-medium">Readiness</td>{compare.map((c) => <td key={c.id} className="td font-semibold">{c.readinessScore}</td>)}</tr>
                <tr><td className="td font-medium">Eligible</td>{compare.map((c) => <td key={c.id} className="td">{c.eligible ? <Badge tone="green">Yes</Badge> : c.nearlyReady ? <Badge tone="amber">Close</Badge> : <Badge tone="red">No</Badge>}</td>)}</tr>
                {COMP.map(([k, label]) => <tr key={k}><td className="td">{label}</td>{compare.map((c) => <td key={c.id} className="td">{c.explanation.components[k].score}</td>)}</tr>)}
                {compare[0].explanation.gap.map((g) => <tr key={g.skillId}><td className="td">{g.skillName} (L{g.required}{g.critical ? '*' : ''})</td>{compare.map((c) => { const x = c.explanation.gap.find((y) => y.skillId === g.skillId); return <td key={c.id} className="td"><LevelPill level={x.verified} required={x.required} /></td>; })}</tr>)}
                <tr><td className="td">Experience</td>{compare.map((c) => <td key={c.id} className="td">{c.experienceYears} yrs</td>)}</tr>
                <tr><td className="td">Status</td>{compare.map((c) => <td key={c.id} className="td">{humanize(c.status)}</td>)}</tr>
              </tbody>
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
}
