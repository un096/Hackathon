import { useState } from 'react';
import { KeyRound, Copy, ShieldCheck } from 'lucide-react';
import { useGet, useAction } from '../../lib/hooks';
import { patch, post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../components/toast';
import { Card, PageHeader, PageSkeleton, ErrorState, Table, Avatar, Badge, Button, Modal, SearchInput, Callout, Tabs } from '../../components/ui';
import { fmtDateTime } from '../../lib/format';

const PERMS = [
  ['Own Skill Passport, assessments, learning, opportunities', true, true, true],
  ['Team directory, employee review, feedback, certification verification', false, true, true],
  ['Create / edit projects, run matching, shortlist candidates', false, true, true],
  ['Approve assignments (deploy employees)', false, false, true],
  ['Employee management, users & roles', false, false, true],
  ['Market data import, workforce & hiring analytics', false, false, true],
  ['Audit log & system settings', false, false, true],
];

export default function UserRoles() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [pwd, setPwd] = useState(null);
  const { data, isLoading, error, refetch } = useGet('users', '/admin/users', { q: q || undefined, role: role || undefined }, { placeholderData: (p) => p });
  const change = useAction(({ id, body }) => patch(`/admin/users/${id}`, body), { invalidate: ['users', 'employees', 'managers'], success: 'User updated' });
  const reset = useAction((id) => post(`/admin/users/${id}/reset-password`), { onSuccess: (d) => setPwd(d.data.tempPassword), success: 'Temporary password generated' });
  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <div>
      <PageHeader eyebrow="User & role management" title="Access control" subtitle="Roles are enforced by the backend on every request. Changes are audit-logged." />
      <Card className="mb-6" title="Role permissions" padded={false}>
        <Table>
          <thead><tr><th className="th">Capability</th><th className="th">Employee</th><th className="th">Manager</th><th className="th">HR / Admin</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-sm dark:divide-slate-800">{PERMS.map(([c, ...r]) => <tr key={c}><td className="td">{c}</td>{r.map((v, i) => <td key={i} className="td">{v ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <span className="muted">—</span>}</td>)}</tr>)}</tbody>
        </Table>
      </Card>
      <Tabs value={role} onChange={setRole} tabs={[{ value: '', label: 'All users' }, { value: 'EMPLOYEE', label: 'Employees' }, { value: 'MANAGER', label: 'Managers' }, { value: 'HR', label: 'HR' }]} />
      <div className="mb-4"><SearchInput value={q} onChange={setQ} placeholder="Search name or email…" /></div>
      <Card padded={false}>
        {isLoading && !data ? <div className="p-6"><PageSkeleton /></div> : (
          <Table>
            <thead><tr><th className="th">User</th><th className="th">Role</th><th className="th">Status</th><th className="th">Last sign-in</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id}>
                    <td className="td"><div className="flex items-center gap-3"><Avatar name={`${u.firstName} ${u.lastName}`} size="sm" /><div><div className="font-medium">{u.firstName} {u.lastName} {self && <Badge tone="brand">You</Badge>}</div><div className="text-xs muted">{u.email} · {u.employee?.designation || ''}</div></div></div></td>
                    <td className="td"><select className="input w-36 py-1" value={u.role} disabled={self || change.isPending} onChange={(e) => change.mutate({ id: u.id, body: { role: e.target.value } })}><option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option><option value="HR">HR / Admin</option></select></td>
                    <td className="td">{u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>}</td>
                    <td className="td text-xs muted">{fmtDateTime(u.lastLoginAt)}</td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => reset.mutate(u.id)}>Reset password</Button>
                        {!self && <Button size="sm" variant={u.isActive ? 'secondary' : 'success'} onClick={() => change.mutate({ id: u.id, body: { isActive: !u.isActive } })}>{u.isActive ? 'Deactivate' : 'Reactivate'}</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <Modal open={!!pwd} onClose={() => setPwd(null)} title="Temporary password" footer={<Button onClick={() => setPwd(null)}>Done</Button>}>
        <div className="space-y-3 text-sm"><p>Share this securely. It is shown only once.</p>
          <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 font-mono dark:bg-slate-800">{pwd}<button onClick={() => { navigator.clipboard?.writeText(pwd); toast('Copied'); }} aria-label="Copy"><Copy className="h-4 w-4" /></button></div>
          <Callout tone="amber">Deactivated users cannot sign in; their tokens are rejected on the next request.</Callout></div>
      </Modal>
    </div>
  );
}
