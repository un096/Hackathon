import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, homeFor } from '../../lib/auth';
import { errMsg } from '../../lib/api';
import { Button, Field, Callout } from '../../components/ui';

const DEMO = [
  { role: 'HR / Admin', email: 'hr@talentbridge.demo', who: 'Priya Sharma' },
  { role: 'Manager', email: 'manager@talentbridge.demo', who: 'Arjun Mehta · Engineering' },
  { role: 'Employee', email: 'employee@talentbridge.demo', who: 'Meera Nair · Frontend' },
];

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-10 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500"><svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M7 21 L16 10 L25 21" stroke="currentColor" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <span className="font-semibold">TalentBridge AI</span>
        </Link>
        <div>
          <div className="text-3xl font-semibold leading-tight">Hire from within,<br />with evidence.</div>
          <p className="mt-3 max-w-md text-slate-300">Verified Skill Passports, explainable talent matching and targeted upskilling — so the next project is staffed by the people you already have.</p>
        </div>
        <div className="text-xs text-slate-400">Grow → Prove → Match → Deploy</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e, creds) => {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      const u = await login(creds?.email || email, creds?.password || password);
      nav(loc.state?.from && loc.state.from !== '/' ? loc.state.from : homeFor(u.role), { replace: true });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Sign in" subtitle="Welcome back to TalentBridge AI">
      {params.get('expired') && <div className="mb-4"><Callout tone="amber">Your session expired. Please sign in again.</Callout></div>}
      <form onSubmit={submit} className="space-y-4">
        <Field label="Work email"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
      </form>
      <p className="mt-4 text-sm muted">New here? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create an account</Link></p>

      <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
        <div className="text-xs font-semibold uppercase tracking-wide muted">Demo accounts · password Demo@1234</div>
        <div className="mt-3 space-y-2">
          {DEMO.map((d) => (
            <button key={d.email} type="button" disabled={busy} onClick={() => submit(null, { email: d.email, password: 'Demo@1234' })} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50/50 dark:border-slate-800 dark:hover:bg-slate-900">
              <span><span className="font-medium">{d.role}</span><span className="ml-2 text-xs muted">{d.who}</span></span>
              <span className="text-xs text-brand-600">Sign in →</span>
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
