import { useState } from 'react';
import { Briefcase, MapPin, Calendar, Users, Hand, ChevronDown, ChevronUp } from 'lucide-react';
import { useGet, useAction } from '../../lib/hooks';
import { post } from '../../lib/api';
import { PageHeader, PageSkeleton, ErrorState, Badge, StatusBadge, Empty, Button, ScoreRing, Card, cx } from '../../components/ui';
import GapTable from '../../components/GapTable';
import { fmtDate, humanize } from '../../lib/format';

export default function Opportunities() {
  const { data, isLoading, error, refetch } = useGet('opportunities', '/me/opportunities');
  const [open, setOpen] = useState(null);
  const interest = useAction((id) => post(`/me/opportunities/${id}/interest`), { invalidate: ['opportunities'] });
  const gen = useAction((projectId) => post('/me/learning/generate', { projectId }), { invalidate: ['learning'], success: (d) => d.message || `Learning plan created for ${d.data.length} skill(s)` });
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <div>
      <PageHeader eyebrow="Internal project opportunities" title="Projects you could join" subtitle="Your readiness is calculated live from your verified Skill Passport with the same engine managers use. Express interest — your manager sees it on the project." />
      {!data.length ? <Card><Empty icon={Briefcase} title="No open projects right now" /></Card> : (
        <div className="space-y-4">
          {data.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex flex-wrap items-start gap-4">
                <ScoreRing value={p.readiness} size={64} label="Readiness" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{p.title}</h3>
                    {p.eligible ? <Badge tone="green">You are eligible</Badge> : p.nearlyReady ? <Badge tone="amber">Close to ready</Badge> : <Badge>Gaps to close</Badge>}
                    <StatusBadge status={p.priority} />
                    {p.recommendationStatus && p.recommendationStatus !== 'RECOMMENDED' && <StatusBadge status={p.recommendationStatus} label={`You are ${humanize(p.recommendationStatus).toLowerCase()}`} />}
                  </div>
                  <p className="mt-1 text-sm muted">{p.description}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs muted">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.filled}/{p.openPositions} filled</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{humanize(p.workMode)}{p.location ? ` · ${p.location}` : ''}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Starts {fmtDate(p.startDate)}</span>
                    {p.manager && <span>Manager: {p.manager}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{p.requirements.map((r) => <Badge key={r.skill} tone={r.critical ? 'red' : 'slate'}>{r.skill} L{r.minLevel}{r.critical ? ' · critical' : ''}</Badge>)}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" icon={Hand} variant={p.interested ? 'secondary' : 'primary'} disabled={p.interested} loading={interest.isPending && interest.variables === p.id} onClick={() => interest.mutate(p.id)}>{p.interested ? 'Interest shared' : "I'm interested"}</Button>
                  {!p.eligible && <Button size="sm" variant="secondary" loading={gen.isPending && gen.variables === p.id} onClick={() => gen.mutate(p.id)}>Plan to close gaps</Button>}
                  <button className="flex items-center justify-center gap-1 text-xs font-medium text-brand-600" onClick={() => setOpen(open === p.id ? null : p.id)}>Why this score {open === p.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>
                </div>
              </div>
              {open === p.id && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="mb-3 text-sm">{p.explanation.summary}</p>
                  <div className="mb-4 grid gap-2 sm:grid-cols-5">
                    {Object.entries(p.explanation.components).map(([k, c]) => (
                      <div key={k} className="rounded-lg bg-slate-50 p-2.5 text-xs dark:bg-slate-800/50"><div className="muted">{humanize(k.replace(/([A-Z])/g, '_$1'))} ({c.weight}%)</div><div className="mt-0.5 text-sm font-semibold">{c.score} → +{c.contribution}</div></div>
                    ))}
                  </div>
                  <GapTable items={p.explanation.gap} />
                  {p.explanation.blockers.length > 0 && <ul className={cx('mt-3 list-disc pl-5 text-sm text-rose-600')}>{p.explanation.blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
