import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, ListChecks, Wrench, PlayCircle, FileText } from 'lucide-react';
import { useGet } from '../../lib/hooks';
import { Card, PageHeader, PageSkeleton, ErrorState, Badge, Button, LevelPill, Empty, SearchInput, Callout, cx } from '../../components/ui';

export default function Assessments() {
  const { data, isLoading, error, refetch } = useGet('assessments', '/assessments');
  const [params] = useSearchParams();
  const focus = params.get('skill');
  const [q, setQ] = useState('');
  const [type, setType] = useState('ALL');
  const list = useMemo(() => (data || [])
    .filter((a) => type === 'ALL' || a.type === type)
    .filter((a) => !q || `${a.title} ${a.skill.name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.skill.id === focus) - (a.skill.id === focus) || b.recommended - a.recommended), [data, q, type, focus]);
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <div>
      <PageHeader eyebrow="Skill assessments" title="Prove your skills" subtitle="MCQ tests evidence knowledge (max L4). Practical assessments are controlled code-reading and debugging scenarios — they evidence applied skill and can verify up to L5. No code is executed on the server." />
      <Callout title="How scores become levels">≥90% → L5 · ≥75% → L4 · ≥60% → L3 · ≥40% → L2 · otherwise L1. Every attempt is stored as evidence; your latest result per type counts.</Callout>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search skill or test…" />
        {['ALL', 'MCQ', 'PRACTICAL'].map((t) => <button key={t} onClick={() => setType(t)} className={cx('rounded-full px-3 py-1 text-xs font-medium', type === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{t === 'ALL' ? 'All' : t === 'MCQ' ? 'MCQ' : 'Practical'}</button>)}
      </div>
      {list.length === 0 ? <Card className="mt-4"><Empty title="No assessments match" /></Card> : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => (
            <div key={a.id} className={cx('card flex flex-col p-5', a.skill.id === focus && 'ring-2 ring-brand-500')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={cx('rounded-lg p-2', a.type === 'PRACTICAL' ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/15' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15')}>{a.type === 'PRACTICAL' ? <Wrench className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}</div>
                  <div><div className="text-xs muted">{a.skill.name} · {a.type === 'PRACTICAL' ? 'Practical' : 'MCQ'}</div><div className="font-semibold leading-tight">{a.title}</div></div>
                </div>
                {a.recommended && <Badge tone="amber">Verify claim</Badge>}
              </div>
              <p className="mt-3 flex-1 text-sm muted">{a.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs muted">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.durationMins} min</span>
                <span>{a.questionCount} questions</span><span>Pass {a.passingScore}%</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <span className="flex items-center gap-1.5">Claimed <LevelPill level={a.claimedLevel} kind="claimed" /> Verified <LevelPill level={a.verifiedLevel} /></span>
                {a.attempts > 0 && <span className={a.lastPassed ? 'text-emerald-600' : 'text-amber-600'}>Last {a.lastScore}% · {a.attempts} attempt(s)</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <Link to={`/employee/assessments/${a.id}/take`} className="flex-1"><Button className="w-full" icon={PlayCircle}>{a.attempts ? 'Re-take' : 'Start'}</Button></Link>
                {a.lastSubmissionId && <Link to={`/employee/results/${a.lastSubmissionId}`}><Button variant="secondary" icon={FileText}>Result</Button></Link>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
