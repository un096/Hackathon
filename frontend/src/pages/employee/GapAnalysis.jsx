import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useGet, useAction } from '../../lib/hooks';
import { post } from '../../lib/api';
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Field, Empty, ScoreRing, Callout, DataLabel, Stat } from '../../components/ui';
import GapTable from '../../components/GapTable';
import { axis, grid, tooltip } from '../../components/charts';
import { fmtDate } from '../../lib/format';

export default function GapAnalysis() {
  const nav = useNavigate();
  const [projectId, setProjectId] = useState('');
  const { data, isLoading, error, refetch } = useGet('gap', '/me/gap', projectId ? { projectId } : undefined, { placeholderData: (p) => p });
  useEffect(() => { if (!projectId && data?.projects?.length) setProjectId(data.projects[0].id); }, [data, projectId]);
  const gen = useAction((b) => post('/me/learning/generate', b), { invalidate: ['learning', 'me-dashboard'], success: (d) => d.message || `Learning plan created for ${d.data.length} skill(s)`, onSuccess: (d) => d.data.length && nav('/employee/learning') });

  if (isLoading && !data) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const g = data.projectGap;

  return (
    <div>
      <PageHeader eyebrow="Skill gap analysis" title="Where am I versus what's needed?" subtitle="The Skill Gap Engine compares your verified levels — never claims — with project requirements and observed market demand." />
      <Card title="Gap against an internal project" actions={
        <Field><select className="input min-w-[240px]" value={projectId} onChange={(e) => setProjectId(e.target.value)}>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>}>
        {!g ? <Empty icon={Target} title="Select a project" text="Choose an open project to analyse your readiness." /> : (
          <div>
            <div className="mb-5 grid gap-4 sm:grid-cols-4">
              <div className="card flex items-center gap-3 p-4"><ScoreRing value={g.readiness.readinessScore} /><div><div className="text-xs muted">Readiness</div><div className="text-sm font-semibold">{g.readiness.eligible ? 'Eligible' : g.readiness.nearlyReady ? 'Close to ready' : 'Not yet eligible'}</div></div></div>
              <Stat label="Requirements met" value={`${g.matched.length}/${g.items.length}`} tone="green" />
              <Stat label="Total level gap" value={g.totalGapLevels} tone="amber" hint={`${g.criticalGapLevels} on critical skills`} />
              <Stat label="Coverage" value={`${g.coveragePercent}%`} tone="violet" />
            </div>
            <GapTable items={g.items} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-sm muted">{g.readiness.explanation.summary}</p>
              {g.totalGapLevels > 0 && <Button icon={Sparkles} loading={gen.isPending} onClick={() => gen.mutate({ projectId })}>Generate my learning plan</Button>}
            </div>
            {g.items.some((i) => i.state === 'UNVERIFIED') && <div className="mt-4"><Callout tone="amber">Some required skills are claimed but not verified. Taking the assessment may close the gap immediately.</Callout></div>}
          </div>
        )}
      </Card>

      <Card className="mt-6" title="Gap against market demand" subtitle={data.marketRun ? `${data.marketRun.source} · ${data.marketRun.rowsKept.toLocaleString()} postings · ${fmtDate(data.marketRun.periodStart)} – ${fmtDate(data.marketRun.periodEnd)}` : undefined}
        actions={data.marketRun && <DataLabel kind={data.marketRun.kind} title="Share of real job postings that mention the skill" />}>
        {data.marketGap.length ? (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.marketGap.map((m) => ({ name: m.skillName, 'Market demand %': m.demandPercent, 'My verified level': m.verified }))} margin={{ left: 0, right: 8 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="name" {...axis} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis yAxisId="l" {...axis} width={32} unit="%" />
                <YAxis yAxisId="r" orientation="right" domain={[0, 5]} {...axis} width={20} />
                <Tooltip {...tooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="l" dataKey="Market demand %" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="r" dataKey="My verified level" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty title="No market data yet" text="HR has not imported job-posting data." />}
      </Card>
    </div>
  );
}
