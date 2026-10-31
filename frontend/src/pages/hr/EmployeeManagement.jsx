import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Pencil, Building2, Copy } from 'lucide-react';
import { useGet, useAction } from '../../lib/hooks';
import { post, put } from '../../lib/api';
import { useToast } from '../../components/toast';
import { Card, PageHeader, PageSkeleton, ErrorState, Table, Avatar, StatusBadge, Button, Modal, Field, SearchInput, Empty, Callout } from '../../components/ui';

const BLANK = { firstName: '', lastName: '', email: '', role: 'EMPLOYEE', designation: '', departmentId: '', managerId: '', experienceYears: 0, location: '' };

export default function EmployeeManagement() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const { data, isLoading, error, refetch } = useGet('employees', '/employees', { scope: 'all', q: q || undefined, departmentId: dept || undefined }, { placeholderData: (p) => p });
  const { data: depts } = useGet('departments', '/admin/departments');
  const { data: managers } = useGet('managers', '/admin/managers');
  const [create, setCreate] = useState(null);
  const [edit, setEdit] = useState(null);
  const [created, setCreated] = useState(null);
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptName, setDeptName] = useState('');

  const add = useAction((b) => post('/employees', b), { invalidate: ['employees', 'hr-dashboard'], success: 'Employee created', onSuccess: (d) => { setCreate(null); setCreated(d.data); } });
  const upd = useAction(({ id, body }) => put(`/employees/${id}`, body), { invalidate: ['employees', 'employee'], success: 'Employee updated', onSuccess: () => setEdit(null) });
  const addDept = useAction((b) => post('/admin/departments', b), { invalidate: ['departments'], success: 'Department created', onSuccess: () => { setDeptOpen(false); setDeptName(''); } });

  if (error) return <ErrorState error={error} retry={refetch} />;
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));

  return (
    <div>
      <PageHeader eyebrow="Employee management" title="People in your organization" subtitle="Add employees and managers, set departments, reporting lines and availability. Employees can also self-register with your join code."
        actions={<><Button variant="secondary" icon={Building2} onClick={() => setDeptOpen(true)}>New department</Button><Button icon={UserPlus} onClick={() => setCreate(BLANK)}>Add person</Button></>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search people or skills…" />
        <select className="input max-w-[200px]" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{(depts || []).map((d) => <option key={d.id} value={d.id}>{d.name} ({d._count.employees})</option>)}</select>
      </div>
      <Card padded={false}>
        {isLoading && !data ? <div className="p-6"><PageSkeleton /></div> : !data.length ? <Empty title="No people found" /> : (
          <Table>
            <thead><tr><th className="th">Person</th><th className="th">Role</th><th className="th">Department</th><th className="th">Manager</th><th className="th">Verified / claimed</th><th className="th">Availability</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="td"><Link to={`/hr/employees/${e.id}`} className="flex items-center gap-3"><Avatar name={e.name} size="sm" /><div><div className="font-medium text-brand-700 hover:underline dark:text-brand-300">{e.name}</div><div className="text-xs muted">{e.email} · {e.employeeCode}</div></div></Link></td>
                  <td className="td"><StatusBadge status={e.role} /></td>
                  <td className="td text-sm">{e.department || '—'}</td>
                  <td className="td text-sm">{e.manager || '—'}</td>
                  <td className="td text-sm">{e.verifiedCount} / {e.claimedCount}</td>
                  <td className="td"><StatusBadge status={e.availability} />{e.allocationPercent > 0 && <span className="ml-1 text-xs muted">{e.allocationPercent}%</span>}</td>
                  <td className="td text-right"><Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit({ id: e.id, name: e.name, designation: e.designation || '', departmentId: e.departmentId || '', managerId: e.managerId || '', experienceYears: e.experienceYears, availability: e.availability, allocationPercent: e.allocationPercent, location: e.location || '' })}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={!!create} onClose={() => setCreate(null)} title="Add a person" wide
        footer={<><Button variant="secondary" onClick={() => setCreate(null)}>Cancel</Button><Button loading={add.isPending} disabled={!create?.email || !create?.firstName || !create?.lastName} onClick={() => add.mutate({ ...clean(create), experienceYears: Number(create.experienceYears) })}>Create account</Button></>}>
        {create && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><input className="input" value={create.firstName} onChange={(e) => setCreate({ ...create, firstName: e.target.value })} /></Field>
          <Field label="Last name"><input className="input" value={create.lastName} onChange={(e) => setCreate({ ...create, lastName: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className="input" value={create.email} onChange={(e) => setCreate({ ...create, email: e.target.value })} /></Field>
          <Field label="Role"><select className="input" value={create.role} onChange={(e) => setCreate({ ...create, role: e.target.value })}><option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option><option value="HR">HR</option></select></Field>
          <Field label="Job title"><input className="input" value={create.designation} onChange={(e) => setCreate({ ...create, designation: e.target.value })} /></Field>
          <Field label="Experience (years)"><input type="number" min="0" className="input" value={create.experienceYears} onChange={(e) => setCreate({ ...create, experienceYears: e.target.value })} /></Field>
          <Field label="Department"><select className="input" value={create.departmentId} onChange={(e) => setCreate({ ...create, departmentId: e.target.value })}><option value="">—</option>{(depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Manager"><select className="input" value={create.managerId} onChange={(e) => setCreate({ ...create, managerId: e.target.value })}><option value="">—</option>{(managers || []).map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></Field>
        </div>}
      </Modal>

      <Modal open={!!created} onClose={() => setCreated(null)} title="Account created" footer={<Button onClick={() => setCreated(null)}>Done</Button>}>
        {created && <div className="space-y-3 text-sm">
          <p>Share these credentials securely with <b>{created.email}</b>. The temporary password is shown only once.</p>
          <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 font-mono dark:bg-slate-800">{created.tempPassword}<button onClick={() => { navigator.clipboard?.writeText(created.tempPassword); toast('Copied'); }} aria-label="Copy"><Copy className="h-4 w-4" /></button></div>
          <Callout tone="amber">The person should change this password after first sign-in.</Callout>
        </div>}
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Edit ${edit?.name}`} wide
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button loading={upd.isPending} onClick={() => { const { id, name, ...b } = edit; upd.mutate({ id, body: { ...b, departmentId: b.departmentId || null, managerId: b.managerId || null, experienceYears: Number(b.experienceYears), allocationPercent: Number(b.allocationPercent) } }); }}>Save</Button></>}>
        {edit && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Job title"><input className="input" value={edit.designation} onChange={(e) => setEdit({ ...edit, designation: e.target.value })} /></Field>
          <Field label="Location"><input className="input" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
          <Field label="Department"><select className="input" value={edit.departmentId} onChange={(e) => setEdit({ ...edit, departmentId: e.target.value })}><option value="">—</option>{(depts || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Manager"><select className="input" value={edit.managerId} onChange={(e) => setEdit({ ...edit, managerId: e.target.value })}><option value="">—</option>{(managers || []).map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></Field>
          <Field label="Availability"><select className="input" value={edit.availability} onChange={(e) => setEdit({ ...edit, availability: e.target.value })}><option value="AVAILABLE">Available</option><option value="PARTIALLY_AVAILABLE">Partially available</option><option value="ON_PROJECT">On project</option><option value="ON_LEAVE">On leave</option></select></Field>
          <Field label="Allocation %"><input type="number" min="0" max="100" className="input" value={edit.allocationPercent} onChange={(e) => setEdit({ ...edit, allocationPercent: e.target.value })} /></Field>
          <Field label="Experience (years)"><input type="number" min="0" className="input" value={edit.experienceYears} onChange={(e) => setEdit({ ...edit, experienceYears: e.target.value })} /></Field>
        </div>}
      </Modal>

      <Modal open={deptOpen} onClose={() => setDeptOpen(false)} title="New department" footer={<><Button variant="secondary" onClick={() => setDeptOpen(false)}>Cancel</Button><Button loading={addDept.isPending} disabled={deptName.trim().length < 2} onClick={() => addDept.mutate({ name: deptName })}>Create</Button></>}>
        <Field label="Department name"><input className="input" value={deptName} onChange={(e) => setDeptName(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}
