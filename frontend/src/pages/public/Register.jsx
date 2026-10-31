import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../../lib/auth';
import { errMsg } from '../../lib/api';
import { Button, Field, cx } from '../../components/ui';
import { AuthShell } from './Login';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('join');
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', password: '', joinCode: '', organizationName: '', designation: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const base = { mode, firstName: f.firstName, lastName: f.lastName, email: f.email, password: f.password };
    const payload = mode === 'join' ? { ...base, joinCode: f.joinCode, ...(f.designation && { designation: f.designation }) } : { ...base, organizationName: f.organizationName };
    try {
      const u = await register(payload);
      nav(u.role === 'EMPLOYEE' ? '/employee/passport' : homeFor(u.role), { replace: true });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Create your account" subtitle="Join your organization, or set up a new one as HR.">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
        {[['join', 'Join my organization'], ['create', 'Create organization (HR)']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setMode(v)} className={cx('rounded-md px-3 py-1.5 text-sm font-medium', mode === v ? 'bg-white shadow-sm dark:bg-slate-800' : 'text-slate-500')}>{l}</button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'join'
          ? <Field label="Organization join code" hint="Ask HR for the code. Demo organization: NIMBUS24"><input className="input uppercase" required value={f.joinCode} onChange={set('joinCode')} /></Field>
          : <Field label="Organization name"><input className="input" required minLength={2} value={f.organizationName} onChange={set('organizationName')} /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name"><input className="input" required value={f.firstName} onChange={set('firstName')} /></Field>
          <Field label="Last name"><input className="input" required value={f.lastName} onChange={set('lastName')} /></Field>
        </div>
        {mode === 'join' && <Field label="Job title (optional)"><input className="input" value={f.designation} onChange={set('designation')} /></Field>}
        <Field label="Work email"><input className="input" type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" hint="At least 8 characters with a letter and a number"><input className="input" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={set('password')} /></Field>
        {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>{mode === 'join' ? 'Join organization' : 'Create organization'}</Button>
      </form>
      <p className="mt-4 text-sm muted">Already have an account? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link></p>
    </AuthShell>
  );
}
