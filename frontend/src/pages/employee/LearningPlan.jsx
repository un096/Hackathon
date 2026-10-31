import { Link } from 'react-router-dom';
import { GraduationCap, ExternalLink, CheckSquare, Square, PlayCircle, Sparkles, Bot } from 'lucide-react';
import { useGet, useAction } from '../../lib/hooks';
import { patch } from '../../lib/api';
import { Card, PageHeader, PageSkeleton, ErrorState, Badge, StatusBadge, Progress, Empty, Button, LevelPill, Callout, cx } from '../../components/ui';
import { ago } from '../../lib/format';

export default function LearningPlan() {
  const { data, isLoading, error, refetch } = useGet('learning', '/me/learning');
  const toggle = useAction(({ id, taskId, done }) => patch(`/me/learning/${id}/tasks/${taskId}`, { done }), { invalidate: ['learning', 'me-dashboard'] });
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const active = data.filter((l) => l.status !== 'COMPLETED');
  const done = data.filter((l) => l.status === 'COMPLETED');

  return (
    <div>
      <PageHeader eyebrow="Personalised learning plan" title="Close your gaps, then prove it" subtitle="Each plan comes from a real gap between your verified level and a requirement. Complete the tasks, then re-take the assessment — the plan completes automatically when the new level is verified."
        actions={<Link to="/employee/gap"><Button variant="secondary" icon={Sparkles}>New plan from gap analysis</Button></Link>} />
      {!data.length ? <Card><Empty icon={GraduationCap} title="No learning plans yet" text="Run a gap analysis against a project to generate one, or your manager can assign one." action={<Link to="/employee/gap"><Button>Analyse my gaps</Button></Link>} /></Card> : (
        <div className="space-y-5">
          {active.map((l) => (
            <Card key={l.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">{l.skill.name}</h3><StatusBadge status={l.status} /><StatusBadge status={l.priority} label={`${l.priority.toLowerCase()} priority`} /></div>
                  <div className="mt-1 flex items-center gap-2 text-sm muted">Current <LevelPill level={l.currentLevel} /> → Target <LevelPill level={l.targetLevel} kind="claimed" />{l.project && <span>· for {l.project.title}</span>}<span>· ~{l.estimatedHours} h</span></div>
                </div>
                <div className="w-48"><Progress value={l.progressPercent} tone={l.progressPercent === 100 ? 'green' : 'brand'} /><div className="mt-1 text-right text-xs muted">{Math.round(l.progressPercent)}% complete</div></div>
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/50">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium muted"><Bot className="h-3.5 w-3.5" />{l.explanationBy === 'gemini' ? 'Explanation worded by Gemini from engine facts' : 'Explanation (rule-based)'}</div>
                {l.explanationText}
              </div>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide muted">Practical tasks</div>
                  <ul className="space-y-1.5">
                    {l.tasks.map((t) => (
                      <li key={t.id}>
                        <button onClick={() => toggle.mutate({ id: l.id, taskId: t.id, done: !t.done })} disabled={toggle.isPending} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          {t.done ? <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
                          <span className={cx(t.done && 'text-slate-400 line-through')}>{t.title}</span><Badge className="ml-auto">L{t.level}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide muted">Resources</div>
                  <ul className="space-y-2">
                    {l.resources.map((r) => (
                      <li key={r.title} className="flex items-center justify-between gap-2 text-sm">
                        {r.url.startsWith('http') ? <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-brand-600 hover:underline">{r.title}<ExternalLink className="h-3.5 w-3.5" /></a> : <Link to={r.url} className="text-brand-600 hover:underline">{r.title}</Link>}
                        <span className="shrink-0 text-xs muted">{r.type} · {r.hours} h</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {l.assessments.length ? (
                      <div className="flex flex-wrap gap-2">{l.assessments.map((a) => <Link key={a.id} to={`/employee/assessments/${a.id}/take`}><Button size="sm" variant={l.status === 'READY_FOR_REASSESSMENT' ? 'primary' : 'secondary'} icon={PlayCircle}>Reassess: {a.type === 'PRACTICAL' ? 'Practical' : 'MCQ'}</Button></Link>)}</div>
                    ) : <p className="text-xs muted">No assessment available for this skill yet — your manager can verify it through feedback.</p>}
                  </div>
                </div>
              </div>
              {l.status === 'READY_FOR_REASSESSMENT' && <div className="mt-4"><Callout tone="green">All tasks done — take the reassessment to verify L{l.targetLevel}.</Callout></div>}
              {l.progress?.length > 0 && <div className="mt-3 text-xs muted">Last activity: {l.progress[0].event.replace('_', ' ').toLowerCase()} · {ago(l.progress[0].createdAt)}{l.progress[0].note ? ` · ${l.progress[0].note}` : ''}</div>}
            </Card>
          ))}
          {done.length > 0 && (
            <Card title="Completed plans">
              <ul className="space-y-2 text-sm">{done.map((l) => <li key={l.id} className="flex items-center justify-between"><span>{l.skill.name} · L{l.currentLevel} → L{l.targetLevel}</span><Badge tone="green">Verified</Badge></li>)}</ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
