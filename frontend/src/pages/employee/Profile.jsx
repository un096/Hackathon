import { useEffect, useState } from 'react';
import { Save, Mail, Building2, User2, MapPin } from 'lucide-react';
import { useGet, useAction } from '../../lib/hooks';
import { put } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Field, Avatar, StatusBadge, Badge } from '../../components/ui';
import { fmtDate } from '../../lib/format';

export default function Profile() {
  const { setUser, user } = useAuth();
  const { data, isLoading, error, refetch } = useGet('passport', '/me/profile');
  const [f, setF] = useState(null);
  useEffect(() => {
    if (data) setF({ firstName: data.user.firstName, lastName: data.user.lastName, designation: data.designation || '', bio: data.bio || '', location: data.location || '', experienceYears: data.experienceYears, workMode: data.workMode, careerInterests: (data.careerInterests || []).join(', ') });
  }, [data]);
  const save = useAction((body) => put('/me/profile', body), {
    success: 'Profile saved', invalidate: ['passport', 'me-dashboard'],
    onSuccess: (_d, b) => setUser({ ...user, firstName: b.firstName, lastName: b.lastName }),
  });
  if (isLoading || !f) return error ? <ErrorState error={error} retry={refetch} /> : <PageSkeleton />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    save.mutate({ ...f, experienceYears: Number(f.experienceYears), careerInterests: f.careerInterests.split(',').map((s) => s.trim()).filter(Boolean) });
  };
  const name = `${data.user.firstName} ${data.user.lastName}`;

  return (
    <div>
      <PageHeader eyebrow="My profile" title="Profile & preferences" subtitle="Experience, location and availability are used by the matching engine. Your manager and HR can see this profile." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="flex flex-col items-center text-center">
            <Avatar name={name} size="lg" />
            <div className="mt-3 text-lg font-semibold">{name}</div>
            <div className="text-sm muted">{data.designation || 'No title yet'}</div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5"><StatusBadge status={data.availability} /><Badge>{data.employeeCode}</Badge></div>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" />{data.user.email}</div>
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-slate-400" />{data.department?.name || 'No department'}</div>
            <div className="flex items-center gap-2"><User2 className="h-4 w-4 text-slate-400" />Manager: {data.manager ? `${data.manager.firstName} ${data.manager.lastName}` : '—'}</div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{data.location || '—'}</div>
          </dl>
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center dark:border-slate-800">
            <div><div className="text-lg font-semibold">{data.summary.verifiedCount}</div><div className="text-xs muted">Verified</div></div>
            <div><div className="text-lg font-semibold">{data.assignments.length}</div><div className="text-xs muted">Projects</div></div>
            <div><div className="text-lg font-semibold">{data.points}</div><div className="text-xs muted">Points</div></div>
          </div>
          <p className="mt-4 text-xs muted">Availability and allocation are maintained by HR and updated automatically on deployment.</p>
        </Card>

        <Card className="lg:col-span-2" title="Edit profile">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="First name"><input className="input" required value={f.firstName} onChange={set('firstName')} /></Field>
            <Field label="Last name"><input className="input" required value={f.lastName} onChange={set('lastName')} /></Field>
            <Field label="Job title"><input className="input" value={f.designation} onChange={set('designation')} /></Field>
            <Field label="Total experience (years)"><input className="input" type="number" min="0" max="50" step="0.5" value={f.experienceYears} onChange={set('experienceYears')} /></Field>
            <Field label="Location"><input className="input" value={f.location} onChange={set('location')} /></Field>
            <Field label="Preferred work mode">
              <select className="input" value={f.workMode} onChange={set('workMode')}><option value="HYBRID">Hybrid</option><option value="REMOTE">Remote</option><option value="ONSITE">On-site</option></select>
            </Field>
            <div className="sm:col-span-2"><Field label="Career interests" hint="Comma separated, e.g. Backend, Cloud, Mentoring"><input className="input" value={f.careerInterests} onChange={set('careerInterests')} /></Field></div>
            <div className="sm:col-span-2"><Field label="About me"><textarea className="input min-h-[96px]" maxLength={1000} value={f.bio} onChange={set('bio')} /></Field></div>
            <div className="flex items-center justify-between sm:col-span-2">
              <span className="text-xs muted">Member since {fmtDate(data.createdAt)}</span>
              <Button type="submit" icon={Save} loading={save.isPending}>Save changes</Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
