import { useEffect, useState } from 'react';
import { Save, RefreshCw, Cpu, ScrollText, Settings2, Copy } from 'lucide-react';
import { useGet, useAction } from '../../lib/hooks';
import { put, post } from '../../lib/api';
import { useToast } from '../../components/toast';
import { Card, PageHeader, PageSkeleton, ErrorState, Table, Badge, Button, Field, Tabs, Callout, Modal } from '../../components/ui';
import { fmtDateTime, humanize } from '../../lib/format';

function AuditLog() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [detail, setDetail] = useState(null);
  const { data, isLoading, error, refetch } = useGet('audit', '/admin/audit', { page, action: action || undefined, pageSize: 20 }, { placeholderData: (p) => p });
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (isLoading && !data) return <PageSkeleton />;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <Card padded={false} title={`${data.total} audit events`} actions={<select className="input w-56 py-1" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}><option value="">All actions</option>{data.actions.map((a) => <option key={a.action} value={a.action}>{humanize(a.action)} ({a.count})</option>)}</select>}>
      <Table>
        <thead><tr><th className="th">When</th><th className="th">User</th><th className="th">Action</th><th className="th">Entity</th><th className="th">Change</th><th className="th">IP</th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.rows.map((r) => (
            <tr key={r.id} className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/30" onClick={() => setDetail(r)}>
              <td className="td whitespace-nowrap text-xs muted">{fmtDateTime(r.createdAt)}</td>
              <td className="td text-sm">{r.user ? `${r.user.firstName} ${r.user.lastName}` : 'System'} {r.user && <Badge>{r.user.role}</Badge>}</td>
              <td className="td"><Badge tone="brand">{humanize(r.action)}</Badge></td>
              <td className="td text-xs muted">{r.entityType}</td>
              <td className="td max-w-md truncate text-xs">{r.after ? JSON.stringify(r.after) : '—'}</td>
              <td className="td text-xs muted">{r.ipAddress || '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm dark:border-slate-800">
        <span className="muted">Page {page} of {pages}</span>
        <div className="flex gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>
      </div>
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? humanize(detail.action) : ''} wide>
        {detail && <div className="grid gap-4 text-xs sm:grid-cols-2">
          <div><div className="label">Before</div><pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 dark:bg-slate-800">{JSON.stringify(detail.before, null, 2) || 'null'}</pre></div>
          <div><div className="label">After</div><pre className="overflow-x-auto rounded-lg bg-slate-100 p-3 dark:bg-slate-800">{JSON.stringify(detail.after, null, 2) || 'null'}</pre></div>
          <div className="sm:col-span-2 muted">Entity {detail.entityType} · {detail.entityId || '—'} · {fmtDateTime(detail.createdAt)}</div>
        </div>}
      </Modal>
    </Card>
  );
}

function Settings() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useGet('settings', '/admin/settings');
  const [s, setS] = useState(null);
  useEffect(() => { if (data) setS({ name: data.organization.name, ...data.settings }); }, [data]);
  const save = useAction((b) => put('/admin/settings', b), { invalidate: ['settings', 'hiring'], success: 'Settings saved — re-run matching to apply new weights' });
  const rotate = useAction(() => post('/admin/settings/rotate-join-code'), { invalidate: ['settings'], success: 'Join code rotated' });
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (isLoading || !s) return <PageSkeleton />;
  const W = s.matchingWeights;
  const sum = Object.values(W).reduce((a, b) => a + Number(b), 0);
  const setW = (k) => (e) => setS({ ...s, matchingWeights: { ...W, [k]: Number(e.target.value) } });
  const setA = (k) => (e) => setS({ ...s, hiringAssumptions: { ...s.hiringAssumptions, [k]: k === 'currency' ? e.target.value : Number(e.target.value) } });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Organization">
        <div className="space-y-4">
          <Field label="Organization name"><input className="input" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="Employee join code" hint="Employees use this code to self-register into your organization.">
            <div className="flex gap-2"><input className="input font-mono" readOnly value={data.organization.joinCode} /><Button variant="secondary" icon={Copy} onClick={() => { navigator.clipboard?.writeText(data.organization.joinCode); toast('Copied'); }} /><Button variant="secondary" icon={RefreshCw} loading={rotate.isPending} onClick={() => rotate.mutate()}>Rotate</Button></div>
          </Field>
          <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
            <div className="flex items-center gap-2 font-medium"><Cpu className="h-4 w-4" />AI service</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={data.aiService.status === 'online' ? 'green' : 'amber'}>{data.aiService.status}</Badge>
              {data.aiService.status === 'online' ? <span className="muted">spaCy {data.aiService.spacy} · Gemini {data.aiService.gemini ? 'configured' : 'not configured (rule-based text)'}</span> : <span className="muted">{data.aiService.note}</span>}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={s.geminiExplanations} onChange={(e) => setS({ ...s, geminiExplanations: e.target.checked })} />Allow Gemini to word explanations (never ranks or decides)</label>
            <p className="mt-1 text-xs muted">API keys live only in server environment variables and are never sent to the browser.</p>
          </div>
        </div>
      </Card>
      <Card title="Matching engine weights" subtitle="Initial formula 40 / 25 / 15 / 10 / 10. Must total 100.">
        <div className="space-y-3">
          {[['skillMatch', 'Verified skill match'], ['practical', 'Practical assessment'], ['experience', 'Relevant experience'], ['feedback', 'Documented feedback'], ['availability', 'Availability']].map(([k, l]) => (
            <div key={k} className="flex items-center gap-3"><span className="w-44 text-sm">{l}</span><input type="range" min="0" max="60" value={W[k]} onChange={setW(k)} className="flex-1 accent-brand-600" /><span className="w-10 text-right text-sm font-semibold">{W[k]}</span></div>
          ))}
          <div className={`text-right text-sm font-medium ${sum === 100 ? 'text-emerald-600' : 'text-rose-600'}`}>Total {sum}</div>
          <Field label="'Close to ready' — max total critical-skill level gap"><input type="number" min="0" max="6" className="input w-24" value={s.nearlyReadyMaxGap} onChange={(e) => setS({ ...s, nearlyReadyMaxGap: Number(e.target.value) })} /></Field>
        </div>
      </Card>
      <Card className="lg:col-span-2" title="Hiring planning assumptions" subtitle="Used only by Internal vs External Hiring Insights — clearly labelled as assumptions there.">
        <div className="grid gap-4 sm:grid-cols-5">
          <Field label="Currency"><input className="input" maxLength={3} value={s.hiringAssumptions.currency} onChange={setA('currency')} /></Field>
          <Field label="External hire cost"><input type="number" min="0" className="input" value={s.hiringAssumptions.externalHireCost} onChange={setA('externalHireCost')} /></Field>
          <Field label="External time to fill (days)"><input type="number" min="0" className="input" value={s.hiringAssumptions.externalTimeToFillDays} onChange={setA('externalTimeToFillDays')} /></Field>
          <Field label="Internal redeploy cost"><input type="number" min="0" className="input" value={s.hiringAssumptions.internalRedeployCost} onChange={setA('internalRedeployCost')} /></Field>
          <Field label="Internal time to deploy (days)"><input type="number" min="0" className="input" value={s.hiringAssumptions.internalTimeToDeployDays} onChange={setA('internalTimeToDeployDays')} /></Field>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <Callout>Changes are recorded in the audit log with before/after values.</Callout>
          <Button icon={Save} loading={save.isPending} disabled={sum !== 100} onClick={() => save.mutate({ name: s.name, matchingWeights: W, nearlyReadyMaxGap: s.nearlyReadyMaxGap, hiringAssumptions: s.hiringAssumptions, geminiExplanations: s.geminiExplanations })}>Save settings</Button>
        </div>
      </Card>
    </div>
  );
}

export default function AuditSettings() {
  const [tab, setTab] = useState('audit');
  return (
    <div>
      <PageHeader eyebrow="Audit logs & system settings" title={tab === 'audit' ? 'Audit trail' : 'System settings'} subtitle="Every sign-in, skill change, assessment, matching run, shortlist, approval and configuration change is recorded." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'audit', label: <span className="inline-flex items-center gap-1.5"><ScrollText className="h-4 w-4" />Audit log</span> }, { value: 'settings', label: <span className="inline-flex items-center gap-1.5"><Settings2 className="h-4 w-4" />Settings</span> }]} />
      {tab === 'audit' ? <AuditLog /> : <Settings />}
    </div>
  );
}
