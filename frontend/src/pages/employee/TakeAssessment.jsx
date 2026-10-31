import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { useGet, useAction } from '../../lib/hooks';
import { post } from '../../lib/api';
import { Card, PageSkeleton, ErrorState, Button, Progress, Badge, Modal, cx } from '../../components/ui';

export default function TakeAssessment() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, isLoading, error } = useGet('assessment-start', `/assessments/${id}/start`, null, { staleTime: Infinity, gcTime: 0 });
  const [answers, setAnswers] = useState({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const started = useRef(Date.now());
  const submitted = useRef(false);

  const submit = useAction((body) => post(`/assessments/${id}/submit`, body), {
    invalidate: ['assessments', 'passport', 'me-dashboard', 'learning', 'badges'],
    success: (d) => `Score ${d.data.score}% · verified ${d.data.after.verifiedLevel ? `L${d.data.after.verifiedLevel}` : 'pending'}`,
    onSuccess: (d) => nav(`/employee/results/${d.data.submissionId}`, { replace: true, state: { fresh: d.data } }),
  });

  const doSubmit = () => {
    if (submitted.current) return;
    submitted.current = true;
    submit.mutate({ answers: data.questions.map((q) => ({ questionId: q.id, selectedIndex: answers[q.id] ?? -1 })), timeTakenSecs: Math.round((Date.now() - started.current) / 1000) });
  };

  useEffect(() => { if (data) { setLeft(data.durationMins * 60); started.current = Date.now(); } }, [data]);
  useEffect(() => {
    if (left == null) return undefined;
    if (left <= 0) { doSubmit(); return undefined; }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} />;
  const q = data.questions[i];
  const answered = Object.keys(answers).length;
  const mm = String(Math.floor((left || 0) / 60)).padStart(2, '0');
  const ss = String((left || 0) % 60).padStart(2, '0');

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">{data.skill.name} · {data.type === 'PRACTICAL' ? 'Practical assessment' : 'MCQ assessment'}</div>
          <h1 className="text-xl font-semibold">{data.title}</h1>
        </div>
        <div className={cx('flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm', left < 60 ? 'border-rose-300 text-rose-600' : 'border-slate-200 dark:border-slate-700')}><Clock className="h-4 w-4" />{mm}:{ss}</div>
      </div>
      <Progress value={((i + 1) / data.questions.length) * 100} />
      <div className="mt-1 flex justify-between text-xs muted"><span>Question {i + 1} of {data.questions.length}</span><span>{answered} answered</span></div>

      <Card className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-base font-medium leading-relaxed">{q.prompt}</p>
          <Badge tone={q.difficulty >= 4 ? 'red' : q.difficulty >= 3 ? 'amber' : 'slate'}>Difficulty {q.difficulty}</Badge>
        </div>
        {q.codeSnippet && <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-[13px] leading-relaxed text-slate-100"><code>{q.codeSnippet}</code></pre>}
        <div className="mt-5 space-y-2" role="radiogroup">
          {q.options.map((opt, idx) => (
            <button key={idx} role="radio" aria-checked={answers[q.id] === idx} onClick={() => setAnswers({ ...answers, [q.id]: idx })}
              className={cx('flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition', answers[q.id] === idx ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700')}>
              <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold', answers[q.id] === idx ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300')}>{String.fromCharCode(65 + idx)}</span>
              <span className="font-[450]">{opt}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="secondary" icon={ChevronLeft} disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
        <div className="hidden gap-1 sm:flex">{data.questions.map((qq, k) => <button key={qq.id} onClick={() => setI(k)} className={cx('h-2.5 w-2.5 rounded-full', k === i ? 'bg-brand-600' : answers[qq.id] != null ? 'bg-brand-300' : 'bg-slate-200 dark:bg-slate-700')} aria-label={`Question ${k + 1}`} />)}</div>
        {i < data.questions.length - 1
          ? <Button onClick={() => setI(i + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          : <Button icon={Send} variant="success" onClick={() => setConfirm(true)} loading={submit.isPending}>Submit</Button>}
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Submit assessment?"
        footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Keep working</Button><Button variant="success" loading={submit.isPending} onClick={doSubmit}>Submit now</Button></>}>
        <p className="text-sm">You answered {answered} of {data.questions.length} questions.{answered < data.questions.length && ' Unanswered questions count as incorrect.'} Your result is graded on the server and recorded as evidence in your Skill Passport.</p>
      </Modal>
    </div>
  );
}
