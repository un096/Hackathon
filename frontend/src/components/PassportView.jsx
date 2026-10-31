import { useState } from 'react';
import { ShieldCheck, FileBadge2, MessageSquareQuote, FolderGit2, ClipboardCheck, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, Table, LevelPill, LevelBar, StatusBadge, Badge, Empty, Progress, cx } from './ui';
import { fmtDate, humanize, LEVELS } from '../lib/format';

const EV_ICON = { MCQ_ASSESSMENT: ClipboardCheck, PRACTICAL_ASSESSMENT: ClipboardCheck, PROJECT: FolderGit2, CERTIFICATION: FileBadge2, MANAGER_FEEDBACK: MessageSquareQuote, TEAM_LEAD_FEEDBACK: MessageSquareQuote };

export function SkillsTable({ passport, onRemove, extraActions }) {
  const [open, setOpen] = useState(null);
  const evBySkill = passport.evidence.reduce((m, e) => ((m[e.skillId] = m[e.skillId] || []).push(e), m), {});
  if (!passport.skills.length) return <Empty icon={ShieldCheck} title="No skills in this passport yet" text="Claimed skills appear here; verified levels appear once evidence is recorded." />;
  return (
    <Table>
      <thead><tr><th className="th w-8" /><th className="th">Skill</th><th className="th">Claimed</th><th className="th">Verified</th><th className="th">Status</th><th className="th">Confidence</th><th className="th">Evidence</th><th className="th" /></tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {passport.skills.map((s) => {
          const ev = evBySkill[s.skillId] || [];
          const hidden = s.claimedLevel === 0 && s.status === 'VERIFIED';
          const over = s.status === 'VERIFIED' && s.claimedLevel > s.verifiedLevel;
          return [
            <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
              <td className="td"><button onClick={() => setOpen(open === s.id ? null : s.id)} aria-label="Show evidence">{open === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
              <td className="td"><div className="font-medium">{s.skill.name}</div><div className="text-xs muted">{s.skill.category}{s.yearsUsed ? ` · ${s.yearsUsed} yrs` : ''}</div></td>
              <td className="td">{s.claimedLevel ? <LevelPill level={s.claimedLevel} kind="claimed" /> : <span className="text-xs muted">not claimed</span>}</td>
              <td className="td"><div className="flex items-center gap-2"><LevelPill level={s.verifiedLevel} /><LevelBar claimed={s.claimedLevel} verified={s.verifiedLevel || 0} /></div></td>
              <td className="td"><div className="flex flex-wrap gap-1"><StatusBadge status={s.status} />{hidden && <Badge tone="violet">Hidden talent</Badge>}{over && <Badge tone="amber">Over-claimed</Badge>}</div></td>
              <td className="td w-32"><Progress value={s.confidence * 100} tone={s.confidence >= 0.6 ? 'green' : 'amber'} /><div className="mt-0.5 text-xs muted">{Math.round(s.confidence * 100)}%</div></td>
              <td className="td text-sm">{ev.length}</td>
              <td className="td text-right">
                <div className="flex justify-end gap-1">
                  {extraActions?.(s)}
                  {onRemove && !ev.length && <button onClick={() => onRemove(s)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove claim"><Trash2 className="h-4 w-4" /></button>}
                </div>
              </td>
            </tr>,
            open === s.id && (
              <tr key={`${s.id}-ev`} className="bg-slate-50/70 dark:bg-slate-900/60">
                <td />
                <td colSpan={7} className="px-4 py-3">
                  {s.verificationNotes?.breakdown?.length ? (
                    <div className="mb-3 text-xs">
                      <div className="mb-1 font-semibold">How the verified level was computed</div>
                      <div className="flex flex-wrap gap-2">
                        {s.verificationNotes.breakdown.map((b) => <Badge key={b.type} tone="slate">{humanize(b.type)}: L{b.level} × {b.weight}</Badge>)}
                        {s.verificationNotes.rawScore != null && <Badge tone="green">weighted = {s.verificationNotes.rawScore} → L{s.verifiedLevel}</Badge>}
                      </div>
                      {s.verificationNotes.reason && <div className="mt-1 text-amber-600">{s.verificationNotes.reason}</div>}
                    </div>
                  ) : null}
                  {ev.length ? (
                    <ul className="space-y-1.5 text-sm">
                      {ev.map((e) => { const I = EV_ICON[e.type] || ShieldCheck; return (
                        <li key={e.id} className="flex flex-wrap items-center gap-2"><I className="h-4 w-4 text-slate-400" /><span>{e.title}</span>{e.score != null && <Badge>{Math.round(e.score)}%</Badge>}{e.level && <LevelPill level={e.level} />}<span className="text-xs muted">· {e.reviewerName || 'System'} · {fmtDate(e.occurredAt)}</span></li>
                      ); })}
                    </ul>
                  ) : <p className="text-sm muted">No evidence yet — this is a self-reported claim.</p>}
                </td>
              </tr>
            ),
          ];
        })}
      </tbody>
    </Table>
  );
}

export function EvidenceSide({ passport, onVerifyCert }) {
  return (
    <div className="space-y-6">
      <Card title="Certifications" subtitle="Count as evidence once verified by a manager or HR">
        {passport.certifications.length ? (
          <ul className="space-y-3 text-sm">
            {passport.certifications.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2">
                <div><div className="font-medium">{c.name}</div><div className="text-xs muted">{c.issuer} · {fmtDate(c.issueDate)}{c.credentialUrl && <> · <a className="text-brand-600 hover:underline" href={c.credentialUrl} target="_blank" rel="noreferrer">credential</a></>}</div></div>
                {c.isVerified ? <Badge tone="green">Verified</Badge> : onVerifyCert ? <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => onVerifyCert(c)}>Verify</button> : <Badge tone="amber">Pending</Badge>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm muted">No certifications.</p>}
      </Card>
      <Card title="Feedback received">
        {passport.feedback.length ? (
          <ul className="space-y-3 text-sm">
            {passport.feedback.slice(0, 5).map((f) => (
              <li key={f.id}>
                <div className="flex items-center justify-between"><span className="font-medium">{f.reviewer.firstName} {f.reviewer.lastName}</span><span className="text-xs muted">{humanize(f.reviewerRole)} · {'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span></div>
                <p className="mt-0.5 text-xs muted">“{f.comment}”</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm muted">No documented feedback yet.</p>}
      </Card>
      <Card title="Project history">
        {passport.assignments.length ? (
          <ul className="space-y-2.5 text-sm">
            {passport.assignments.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2">
                <div><div className="font-medium">{a.project.title}</div><div className="text-xs muted">{a.role || 'Team member'} · {a.allocationPercent}% · {fmtDate(a.startedAt)}{a.endedAt ? ` – ${fmtDate(a.endedAt)}` : ''}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{(a.skillsUsed || []).map((s) => <Badge key={s.skillId} tone="brand">{s.name} L{s.level}</Badge>)}</div></div>
                <span className={cx(a.status === 'ACTIVE' && 'text-emerald-600')}><StatusBadge status={a.status} /></span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm muted">No internal projects yet.</p>}
      </Card>
    </div>
  );
}

export const levelHelp = Object.entries(LEVELS).filter(([k]) => k > 0).map(([k, v]) => `L${k} ${v}`).join(' · ');
