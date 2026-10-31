import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowRight, Award, RotateCcw } from 'lucide-react';
import { useGet } from '../../lib/hooks';
import { Card, PageHeader, PageSkeleton, ErrorState, Badge, Button, LevelPill, ScoreRing, Callout, StatusBadge } from '../../components/ui';
import { fmtDateTime, humanize, LEVELS } from '../../lib/format';

export default function AssessmentResult() {
  const { id } = useParams();
  const { state } = useLocation();
  const fresh = state?.fresh;
  const { data, isLoading, error, refetch } = useGet('submission', `/assessments/submissions/${id}`);
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const st = data.skillStatus;

  return (
    <div>
      <PageHeader eyebrow="Assessment results" title={data.assessment.title} subtitle={`${data.assessment.skill} · ${data.assessment.type === 'PRACTICAL' ? 'Practical' : 'MCQ'} · attempt ${data.attempt} · ${fmtDateTime(data.submittedAt)}`}
        actions={<><Link to={`/employee/assessments/${data.assessment.id}/take`}><Button variant="secondary" icon={RotateCcw}>Re-take</Button></Link><Link to="/employee/passport"><Button icon={ArrowRight}>View Skill Passport</Button></Link></>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-4">
            <ScoreRing value={data.score} size={84} />
            <div>
              <div className="text-sm muted">Score</div>
              <div className="text-2xl font-semibold">{data.score}%</div>
              <div className="mt-1">{data.passed ? <Badge tone="green" icon={CheckCircle2}>Passed</Badge> : <Badge tone="red" icon={XCircle}>Below pass mark ({data.assessment.passingScore}%)</Badge>}</div>
            </div>
          </div>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="muted">Correct answers</dt><dd>{data.correctCount} / {data.totalCount}</dd></div>
            <div className="flex justify-between"><dt className="muted">Evidence level from this attempt</dt><dd><LevelPill level={data.levelAwarded} /></dd></div>
            <div className="flex justify-between"><dt className="muted">Time taken</dt><dd>{data.timeTakenSecs ? `${Math.floor(data.timeTakenSecs / 60)}m ${data.timeTakenSecs % 60}s` : '—'}</dd></div>
          </dl>
        </Card>

        <Card className="lg:col-span-2" title="Skill Passport update" subtitle="The Skill Verification Engine recalculated your verified level from all evidence">
          {st ? (
            <div>
              <div className="flex flex-wrap items-center gap-6">
                <div><div className="text-xs muted">Claimed</div><div className="mt-1"><LevelPill level={st.claimedLevel} kind="claimed" /></div></div>
                {fresh?.before && <div><div className="text-xs muted">Verified before</div><div className="mt-1"><LevelPill level={fresh.before.verifiedLevel} /></div></div>}
                <div><div className="text-xs muted">Verified now</div><div className="mt-1 flex items-center gap-2"><LevelPill level={st.verifiedLevel} /><span className="text-sm">{LEVELS[st.verifiedLevel || 0]}</span></div></div>
                <div><div className="text-xs muted">Status</div><div className="mt-1"><StatusBadge status={st.status} /></div></div>
                <div><div className="text-xs muted">Confidence</div><div className="mt-1 text-sm font-medium">{Math.round(st.confidence * 100)}%</div></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">{st.breakdown.map((b) => <Badge key={b.type}>{humanize(b.type)}: L{b.level} (weight {b.weight})</Badge>)}</div>
              {fresh?.badges?.length > 0 && <div className="mt-4"><Callout tone="green" icon={Award} title="New badge unlocked">{fresh.badges.map((b) => b.badge.name).join(', ')}</Callout></div>}
              {fresh?.learningUpdate?.status === 'COMPLETED' && <div className="mt-3"><Callout tone="green" title="Learning plan completed">You reached your target level — the gap is closed.</Callout></div>}
              {st.claimedLevel > (st.verifiedLevel || 0) && <div className="mt-3"><Callout tone="amber">Your claimed level is higher than the evidence so far. A <Link className="underline" to="/employee/gap">learning plan</Link> can help close the gap.</Callout></div>}
            </div>
          ) : <p className="text-sm muted">No passport entry.</p>}
        </Card>
      </div>

      <Card className="mt-6" title="Answer review">
        <ol className="space-y-5">
          {data.questions.map((q, n) => (
            <li key={q.id} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0 dark:border-slate-800">
              <div className="flex items-start gap-2">{q.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}<p className="text-sm font-medium">{n + 1}. {q.prompt}</p></div>
              {q.codeSnippet && <pre className="ml-6 mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100"><code>{q.codeSnippet}</code></pre>}
              <ul className="ml-6 mt-2 space-y-1 text-sm">
                {q.options.map((o, k) => (
                  <li key={k} className={k === q.correctIndex ? 'font-medium text-emerald-700 dark:text-emerald-400' : k === q.selectedIndex ? 'text-rose-600 line-through' : 'muted'}>{String.fromCharCode(65 + k)}. {o}{k === q.correctIndex ? ' ✓' : k === q.selectedIndex ? ' (your answer)' : ''}</li>
                ))}
              </ul>
              {q.explanation && <p className="ml-6 mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">{q.explanation}</p>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
