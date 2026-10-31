import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, CheckSquare } from 'lucide-react';
import { useGet, useAction, useBase } from '../../lib/hooks';
import { post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card, PageHeader, PageSkeleton, ErrorState, Table, StatusBadge, Empty, Button, Tabs, Avatar, Modal, Field, Callout } from '../../components/ui';
import { fmtDateTime } from '../../lib/format';

export default function Approvals() {
  const { user } = useAuth();
  const base = useBase();
  const isHr = user.role === 'HR';
  const [tab, setTab] = useState('SHORTLISTED');
  const [dlg, setDlg] = useState(null);
  const [form, setForm] = useState({ note: '', allocationPercent: 100, role: '' });
  const { data, isLoading, error, refetch } = useGet('approvals', '/approvals');
  const decide = useAction(({ rec, kind }) => post(`/approvals/${rec.id}/${kind}`, { note: form.note || undefined, allocationPercent: Number(form.allocationPercent), role: form.role || undefined }), {
    invalidate: ['approvals', 'recs', 'projects', 'project', 'hr-dashboard', 'manager-dashboard', 'employees'],
    onSuccess: () => { setDlg(null); setForm({ note: '', allocationPercent: 100, role: '' }); },
  });
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const rows = data.filter((r) => r.status === tab);

  return (
    <div>
      <PageHeader eyebrow="Assignment approvals" title={isHr ? 'Approve internal deployments' : 'Shortlists & decisions'}
        subtitle={isHr ? 'Managers shortlist eligible candidates. HR approval creates the assignment, updates allocation and the Skill Passport, and awards the deployment badge.' : 'Track candidates you shortlisted for HR approval and the final decisions.'} />
      {!isHr && <div className="mb-4"><Callout>Only HR can approve an assignment. You can withdraw a shortlist before HR decides.</Callout></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'SHORTLISTED', label: 'Awaiting HR', count: data.filter((r) => r.status === 'SHORTLISTED').length }, { value: 'APPROVED', label: 'Approved', count: data.filter((r) => r.status === 'APPROVED').length }, { value: 'REJECTED', label: 'Rejected', count: data.filter((r) => r.status === 'REJECTED').length }]} />
      <Card padded={false}>
        {!rows.length ? <Empty icon={CheckSquare} title="Nothing here" text={tab === 'SHORTLISTED' ? 'No shortlisted candidates are waiting.' : undefined} /> : (
          <Table>
            <thead><tr><th className="th">Candidate</th><th className="th">Project</th><th className="th">Readiness</th><th className="th">Manager note</th><th className="th">Current allocation</th><th className="th">{tab === 'SHORTLISTED' ? 'Shortlisted' : 'Decided'}</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td"><div className="flex items-center gap-2"><Avatar name={r.employee.name} size="sm" /><div><div className="font-medium">{r.employee.name}</div><div className="text-xs muted">{r.employee.designation}</div></div></div></td>
                  <td className="td"><Link className="text-brand-600 hover:underline" to={`${base}/projects/${r.project.id}/matching`}>{r.project.title}</Link><div className="text-xs muted">PM: {r.projectManager || '—'}</div></td>
                  <td className="td font-semibold">{r.readinessScore}</td>
                  <td className="td max-w-xs text-xs">{r.managerNote || '—'}{r.hrNote && <div className="mt-1 muted">HR: {r.hrNote}</div>}</td>
                  <td className="td text-sm">{r.employee.allocationPercent}% · <StatusBadge status={r.employee.availability} /></td>
                  <td className="td text-xs muted">{fmtDateTime(tab === 'SHORTLISTED' ? r.managerDecidedAt : r.decidedAt)}{r.decidedBy && <div>by {r.decidedBy}</div>}</td>
                  <td className="td text-right">
                    {tab === 'SHORTLISTED' && (
                      <div className="flex justify-end gap-2">
                        {isHr && <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => { setForm({ note: '', role: '', allocationPercent: Math.min(100, 100 - r.employee.allocationPercent) || 100 }); setDlg({ rec: r, kind: 'approve' }); }}>Approve</Button>}
                        <Button size="sm" variant="secondary" icon={XCircle} onClick={() => setDlg({ rec: r, kind: 'reject' })}>{isHr ? 'Reject' : 'Withdraw'}</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={!!dlg} onClose={() => setDlg(null)} title={dlg?.kind === 'approve' ? `Deploy ${dlg?.rec.employee.name} to ${dlg?.rec.project.title}` : 'Reject shortlist'}
        footer={<><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button variant={dlg?.kind === 'approve' ? 'success' : 'danger'} loading={decide.isPending} onClick={() => decide.mutate(dlg)}>{dlg?.kind === 'approve' ? 'Approve & deploy' : 'Reject'}</Button></>}>
        <div className="space-y-4">
          {dlg?.kind === 'approve' && (<>
            <p className="text-sm">{dlg.rec.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Allocation %" hint={`Currently ${dlg.rec.employee.allocationPercent}% allocated`}><input type="number" min="10" max="100" step="10" className="input" value={form.allocationPercent} onChange={(e) => setForm({ ...form, allocationPercent: e.target.value })} /></Field>
              <Field label="Project role"><input className="input" placeholder="e.g. Full-stack engineer" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
            </div>
          </>)}
          <Field label="Note (audit log)"><textarea className="input min-h-[70px]" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
