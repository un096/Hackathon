import { useRef, useState } from 'react';
import { Upload, Database, Globe2, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useGet, useAction } from '../../lib/hooks';
import { api, post } from '../../lib/api';
import { Card, PageHeader, PageSkeleton, ErrorState, Button, DataLabel, Callout, Empty, Table, Badge, Stat, Field, Modal, cx } from '../../components/ui';
import { axis, grid, tooltip, PALETTE } from '../../components/charts';
import { fmtDate, fmtDateTime } from '../../lib/format';

const STEPS = ['Ingestion', 'Cleaning', 'Skill extraction', 'Normalisation', 'Demand analytics', 'Database', 'Dashboard'];

export default function MarketIntel() {
  const [runId, setRunId] = useState('');
  const [tech, setTech] = useState(true);
  const { data, isLoading, error, refetch } = useGet('market', '/market/summary', runId ? { runId } : undefined);
  const { data: runs } = useGet('market-runs', '/market/runs');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('OBSERVED');
  const [sourceName, setSourceName] = useState('');
  const file = useRef();
  const upload = useAction(async () => {
    const fd = new FormData();
    fd.append('file', file.current.files[0]); fd.append('kind', kind); if (sourceName) fd.append('sourceName', sourceName);
    return (await api.post('/market/import', fd)).data;
  }, { invalidate: ['market', 'market-runs', 'hr-dashboard'], success: (d) => `Imported ${d.data.rowsKept.toLocaleString()} postings via ${d.data.pipeline}`, onSuccess: () => { setOpen(false); setRunId(''); } });
  const sample = useAction(() => post('/market/import-sample'), { invalidate: ['market', 'market-runs', 'hr-dashboard'], success: (d) => `Imported ${d.data.rowsKept.toLocaleString()} postings via ${d.data.pipeline}` });

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const actions = <><Button variant="secondary" icon={Database} loading={sample.isPending} onClick={() => sample.mutate()}>Re-import bundled sample</Button><Button icon={Upload} onClick={() => setOpen(true)}>Import CSV</Button></>;

  const modal = (
    <Modal open={open} onClose={() => setOpen(false)} title="Import job-posting CSV" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={upload.isPending} onClick={() => file.current?.files[0] && upload.mutate()}>Run pipeline</Button></>}>
      <div className="space-y-4 text-sm">
        <p>Required columns: a title column (<code>job_title</code>) and a comma-separated skills column (<code>job_skills</code>). Optional: <code>job_link</code>, <code>company</code>, <code>job_location</code>, <code>first_seen</code>, <code>job_level</code>, <code>job_type</code>. Max 50 MB.</p>
        <Field label="CSV file"><input ref={file} type="file" accept=".csv,text/csv" className="input" /></Field>
        <Field label="Source name"><input className="input" placeholder="e.g. Naukri export Q3" value={sourceName} onChange={(e) => setSourceName(e.target.value)} /></Field>
        <Field label="Data label" hint="Mark synthetic or sample files as Demo so dashboards never present them as real market data."><select className="input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="OBSERVED">Observed (real postings)</option><option value="DEMO">Demo / synthetic</option></select></Field>
        {upload.isPending && <Callout>Processing… large files can take a minute.</Callout>}
      </div>
    </Modal>
  );

  if (!data) return <div><PageHeader eyebrow="Market skill intelligence" title="External skill demand" actions={actions} /><Card><Empty icon={Globe2} title="No market data yet" text="Import a job-posting CSV to compute skill demand from real posting counts." action={<Button icon={Upload} onClick={() => setOpen(true)}>Import CSV</Button>} /></Card>{modal}</div>;

  const { run } = data;
  const demand = data.demand.filter((d) => !tech || d.category !== 'Soft Skills');
  const top = demand.slice(0, 15);
  const gaps = [...demand].sort((a, b) => b.gapIndex - a.gapIndex).slice(0, 8);

  return (
    <div>
      <PageHeader eyebrow="Market skill intelligence" title="External skill demand vs internal supply" subtitle="Demand = share of job postings in the imported file that mention a skill. Nothing here is estimated or invented." actions={actions} />
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm"><DataLabel kind={run.kind} /><span className="font-medium">{run.source}</span><span className="muted">· {run.fileName} · imported {fmtDateTime(run.completedAt)} · pipeline: {run.pipeline} ({run.stats?.extractor})</span></div>
          {runs?.length > 1 && <select className="input max-w-xs" value={runId} onChange={(e) => setRunId(e.target.value)}><option value="">Latest run</option>{runs.filter((r) => r.status === 'COMPLETED').map((r) => <option key={r.id} value={r.id}>{fmtDateTime(r.completedAt)} · {r.fileName} ({r.rowsKept})</option>)}</select>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1 text-xs">{STEPS.map((s, i) => <span key={s} className="flex items-center gap-1"><span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{s}</span>{i < STEPS.length - 1 && <span className="muted">→</span>}</span>)}</div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Rows read" value={run.rowsRead.toLocaleString()} />
        <Stat label="Postings kept" value={run.rowsKept.toLocaleString()} tone="green" hint={`${run.rowsDropped.toLocaleString()} dropped (duplicates / no skills)`} />
        <Stat label="Skill mentions matched" value={run.skillsMatched.toLocaleString()} tone="violet" hint={`${run.stats?.distinctSkills} canonical skills`} />
        <Stat label="Observed period" value={`${run.stats?.spanDays || 0} days`} tone="amber" hint={`${fmtDate(run.periodStart)} – ${fmtDate(run.periodEnd)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Top skills by share of postings" actions={<button onClick={() => setTech(!tech)} className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', tech ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800')}><Filter className="h-3 w-3" />{tech ? 'Technical only' : 'Incl. soft skills'}</button>}>
          <div className="h-[380px]">
            <ResponsiveContainer>
              <BarChart data={top} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid {...grid} horizontal={false} vertical />
                <XAxis type="number" {...axis} unit="%" />
                <YAxis type="category" dataKey="skill" {...axis} width={100} />
                <Tooltip {...tooltip} formatter={(v, n, p) => (n === 'demandPercent' ? [`${v}% (${p.payload.postingCount.toLocaleString()} postings)`, 'Demand'] : [v, n])} />
                <Bar dataKey="demandPercent" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Demand by category">
          <div className="h-52"><ResponsiveContainer><PieChart><Pie data={data.categories} dataKey="postings" nameKey="category" innerRadius={50} outerRadius={80} paddingAngle={2}>{data.categories.map((c, i) => <Cell key={c.category} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...tooltip} /></PieChart></ResponsiveContainer></div>
          <ul className="mt-2 space-y-1 text-xs">{data.categories.map((c, i) => <li key={c.category} className="flex justify-between"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />{c.category}</span><span>{c.postings.toLocaleString()} mentions</span></li>)}</ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Biggest market-vs-internal gaps" subtitle="Gap index = market demand % − share of our workforce verified in the skill">
          <Table>
            <thead><tr><th className="th">Skill</th><th className="th">Market</th><th className="th">Internal verified</th><th className="th">Gap index</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{gaps.map((g) => <tr key={g.skillId}><td className="td font-medium">{g.skill}</td><td className="td">{g.demandPercent}%</td><td className="td">{g.internalVerified} ({g.internalShare}%)</td><td className="td"><Badge tone={g.gapIndex > 20 ? 'red' : g.gapIndex > 5 ? 'amber' : 'green'}>{g.gapIndex}</Badge></td></tr>)}</tbody>
          </Table>
        </Card>
        <Card title="Posting volume over time" subtitle="Daily postings mentioning the top skills" actions={<DataLabel kind={data.hasForecast ? 'FORECAST' : run.kind} />}>
          {data.trend.length > 1 ? (
            <div className="h-60">
              <ResponsiveContainer>
                <LineChart data={data.trend}><CartesianGrid {...grid} /><XAxis dataKey="period" {...axis} /><YAxis {...axis} width={36} /><Tooltip {...tooltip} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  {Object.keys(data.trend.reduce((m, r) => ({ ...m, ...r }), {})).filter((k) => k !== 'period').map((k, i) => <Line key={k} dataKey={k} stroke={PALETTE[i % PALETTE.length]} strokeDasharray={k.includes('forecast') ? '4 4' : undefined} dot={false} strokeWidth={2} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty title="Not enough dates for a trend" />}
          <div className="mt-3"><Callout tone={data.hasForecast ? 'brand' : 'amber'} title={data.hasForecast ? 'Forecast available' : 'No forecast shown'}>{run.stats?.forecastNote}</Callout></div>
        </Card>
      </div>

      <Card className="mt-6" title="Full demand table" padded={false}>
        <Table>
          <thead><tr><th className="th">Skill</th><th className="th">Category</th><th className="th">Postings</th><th className="th">Share</th><th className="th">Senior-level share</th><th className="th">Internal verified</th><th className="th">Avg internal level</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{demand.map((d) => <tr key={d.skillId}><td className="td font-medium">{d.skill}</td><td className="td text-sm muted">{d.category}</td><td className="td">{d.postingCount.toLocaleString()}</td><td className="td">{d.demandPercent}%</td><td className="td">{d.seniorShare}%</td><td className="td">{d.internalVerified}</td><td className="td">{d.internalAvgLevel || '—'}</td></tr>)}</tbody>
        </Table>
      </Card>

      {run.unmatchedTop?.length > 0 && (
        <Card className="mt-6" title="Most frequent unmatched terms" subtitle="Not in the curated skill dictionary — candidates for adding as aliases">
          <div className="flex flex-wrap gap-1.5">{run.unmatchedTop.map((u) => <Badge key={u.term}>{u.term} · {u.count}</Badge>)}</div>
        </Card>
      )}
      {modal}
    </div>
  );
}
