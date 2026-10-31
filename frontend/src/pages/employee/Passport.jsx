import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileBadge2, ClipboardCheck, Download } from 'lucide-react';
import { useGet, useAction } from '../../lib/hooks';
import { post, del } from '../../lib/api';
import { Card, PageHeader, PageSkeleton, ErrorState, Button, Modal, Field, Stat, Callout } from '../../components/ui';
import { SkillsTable, EvidenceSide, levelHelp } from '../../components/PassportView';
import { LEVELS } from '../../lib/format';

export default function Passport() {
  const { data, isLoading, error, refetch } = useGet('passport', '/me/passport');
  const { data: skills } = useGet('skills', '/skills');
  const [addOpen, setAddOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [claim, setClaim] = useState({ skillId: '', claimedLevel: 3, yearsUsed: 1 });
  const [cert, setCert] = useState({ name: '', issuer: '', skillId: '', issueDate: '', credentialUrl: '' });

  const addSkill = useAction((b) => post('/me/skills', b), { success: 'Skill claim saved — take an assessment to verify it', invalidate: ['passport', 'me-dashboard'], onSuccess: () => setAddOpen(false) });
  const remove = useAction((s) => del(`/me/skills/${s.id}`), { success: 'Claim removed', invalidate: ['passport'] });
  const addCert = useAction((b) => post('/me/certifications', b), { invalidate: ['passport'], onSuccess: () => { setCertOpen(false); setCert({ name: '', issuer: '', skillId: '', issueDate: '', credentialUrl: '' }); } });

  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const s = data.summary;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ name: `${data.user.firstName} ${data.user.lastName}`, exportedAt: new Date().toISOString(), skills: data.skills.map((x) => ({ skill: x.skill.name, claimedLevel: x.claimedLevel, verifiedLevel: x.verifiedLevel, status: x.status, confidence: x.confidence })), evidence: data.evidence.map((e) => ({ skill: e.skill.name, type: e.type, title: e.title, score: e.score, level: e.level, date: e.occurredAt })) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skill-passport.json'; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <PageHeader eyebrow="Skill Passport" title="Your verified capability record"
        subtitle="Claim the skills you have. Verified levels are set only by the Skill Verification Engine from assessments, project delivery, certifications and feedback."
        actions={<>
          <Button variant="secondary" icon={Download} onClick={exportJson}>Export</Button>
          <Button variant="secondary" icon={FileBadge2} onClick={() => setCertOpen(true)}>Add certification</Button>
          <Button icon={Plus} onClick={() => setAddOpen(true)}>Claim a skill</Button>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Claimed skills" value={s.claimedCount} />
        <Stat label="Verified skills" value={s.verifiedCount} tone="green" />
        <Stat label="Awaiting objective evidence" value={s.unverifiedClaims} tone="amber" />
        <Stat label="Evidence records" value={s.evidenceCount} tone="violet" />
      </div>

      {s.unverifiedClaims > 0 && (
        <div className="mt-4"><Callout tone="amber" title={`${s.unverifiedClaims} claimed skill(s) are not verified yet`}>Unverified claims do not count in project matching. <Link className="font-medium underline" to="/employee/assessments">Take an assessment</Link> to prove them.</Callout></div>
      )}

      <div className="mt-6 grid gap-6 2xl:grid-cols-3">
        <Card className="2xl:col-span-2" title="Skills" subtitle={levelHelp} padded={false}>
          <SkillsTable passport={data} onRemove={(x) => remove.mutate(x)}
            extraActions={(x) => x.status !== 'VERIFIED' ? <Link to={`/employee/assessments?skill=${x.skillId}`} className="rounded p-1 text-brand-600 hover:bg-brand-50" title="Verify with an assessment"><ClipboardCheck className="h-4 w-4" /></Link> : null} />
        </Card>
        <EvidenceSide passport={data} />
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Claim a skill"
        footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button loading={addSkill.isPending} disabled={!claim.skillId} onClick={() => addSkill.mutate({ ...claim, claimedLevel: Number(claim.claimedLevel), yearsUsed: Number(claim.yearsUsed) })}>Save claim</Button></>}>
        <div className="space-y-4">
          <Field label="Skill">
            <select className="input" value={claim.skillId} onChange={(e) => setClaim({ ...claim, skillId: e.target.value })}>
              <option value="">Select a skill…</option>
              {Object.entries((skills || []).reduce((m, x) => ((m[x.category] = m[x.category] || []).push(x), m), {})).map(([cat, xs]) => (
                <optgroup key={cat} label={cat}>{xs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
              ))}
            </select>
          </Field>
          <Field label={`Self-assessed level: L${claim.claimedLevel} — ${LEVELS[claim.claimedLevel]}`}>
            <input type="range" min="1" max="5" value={claim.claimedLevel} onChange={(e) => setClaim({ ...claim, claimedLevel: e.target.value })} className="w-full accent-brand-600" />
          </Field>
          <Field label="Years of hands-on use"><input type="number" min="0" max="40" step="0.5" className="input" value={claim.yearsUsed} onChange={(e) => setClaim({ ...claim, yearsUsed: e.target.value })} /></Field>
          <Callout>This is a <b>claim</b>. It stays separate from your verified level until evidence is recorded.</Callout>
        </div>
      </Modal>

      <Modal open={certOpen} onClose={() => setCertOpen(false)} title="Add certification"
        footer={<><Button variant="secondary" onClick={() => setCertOpen(false)}>Cancel</Button><Button loading={addCert.isPending} disabled={!cert.name || !cert.issuer} onClick={() => addCert.mutate(Object.fromEntries(Object.entries(cert).filter(([, v]) => v)))}>Submit for verification</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Certification name"><input className="input" value={cert.name} onChange={(e) => setCert({ ...cert, name: e.target.value })} /></Field></div>
          <Field label="Issuer"><input className="input" value={cert.issuer} onChange={(e) => setCert({ ...cert, issuer: e.target.value })} /></Field>
          <Field label="Issue date"><input type="date" className="input" value={cert.issueDate} onChange={(e) => setCert({ ...cert, issueDate: e.target.value })} /></Field>
          <Field label="Related skill"><select className="input" value={cert.skillId} onChange={(e) => setCert({ ...cert, skillId: e.target.value })}><option value="">None</option>{(skills || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
          <Field label="Credential URL"><input type="url" className="input" placeholder="https://" value={cert.credentialUrl} onChange={(e) => setCert({ ...cert, credentialUrl: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
