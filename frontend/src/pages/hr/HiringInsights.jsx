import { Link } from 'react-router-dom';
import { Scale, Rocket, GraduationCap, UserPlus, Sparkles, CheckCircle2 } from 'lucide-react';
import { useGet } from '../../lib/hooks';
import { Card, PageHeader, PageSkeleton, ErrorState, Stat, Table, Badge, Callout, Button } from '../../components/ui';
import { money } from '../../lib/format';

const DECISION = {
  DEPLOY_INTERNAL: ['green', 'Deploy internal talent', Rocket],
  UPSKILL_INTERNAL: ['amber', 'Upskill close-to-ready staff', GraduationCap],
  EXTERNAL_HIRE: ['red', 'External hire needed', UserPlus],
  RUN_MATCHING: ['slate', 'Run matching first', Sparkles],
  FILLED: ['brand', 'Fully staffed', CheckCircle2],
};

export default function HiringInsights() {
  const { data, isLoading, error, refetch } = useGet('hiring', '/analytics/hiring');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const A = data.assumptions;
  const s = data.summary;

  return (
    <div>
      <PageHeader eyebrow="Internal vs external hiring insights" title="Can we staff this from within?" subtitle="For every open position the engine checks eligible and close-to-ready internal candidates before recommending an external hire." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Rocket} tone="green" label="Positions fillable internally" value={s.internalPositions} hint="Deployed + eligible + close to ready" />
        <Stat icon={UserPlus} tone="red" label="External hires still needed" value={s.externalPositions} />
        <Stat icon={Scale} label="Estimated cost avoided" value={money(s.estimatedSavings, A.currency)} hint="Using HR planning assumptions" />
        <Stat tone="violet" label="Days saved per internal fill" value={s.daysSavedPerHire} hint={`${A.externalTimeToFillDays} vs ${A.internalTimeToDeployDays} days`} />
      </div>
      <div className="mt-4"><Callout tone="amber" title="Planning assumptions, not market statistics">{data.assumptionsNote} External hire {money(A.externalHireCost, A.currency)} · internal redeployment {money(A.internalRedeployCost, A.currency)}. <Link to="/hr/audit" className="underline">Edit in System Settings</Link>.</Callout></div>

      <Card className="mt-6" title="Recommendation per project" padded={false}>
        <Table>
          <thead><tr><th className="th">Project</th><th className="th">Requirements</th><th className="th">Positions</th><th className="th">Eligible</th><th className="th">Close to ready</th><th className="th">Recommendation</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.perProject.map((p) => { const [tone, label, I] = DECISION[p.decision]; return (
              <tr key={p.id}>
                <td className="td font-medium">{p.title}</td>
                <td className="td text-xs muted">{p.requirements.join(' · ')}</td>
                <td className="td text-sm">{p.filled}/{p.openPositions} filled</td>
                <td className="td">{p.matched ? p.eligible : '—'}</td>
                <td className="td">{p.matched ? p.nearlyReady : '—'}</td>
                <td className="td"><Badge tone={tone} icon={I}>{label}{p.externalNeeded ? ` (${p.externalNeeded})` : ''}</Badge></td>
                <td className="td text-right"><Link to={`/hr/projects/${p.id}/matching`}><Button size="sm" variant="secondary">Open</Button></Link></td>
              </tr>
            ); })}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-6" title="Internal supply for required skills" subtitle="Highest level required across open projects vs people verified at that level" padded={false}>
        <Table>
          <thead><tr><th className="th">Skill</th><th className="th">Needed level</th><th className="th">Projects</th><th className="th">Verified at level</th><th className="th">Verified below</th><th className="th">Claimed, unverified</th><th className="th">Signal</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.supply.map((x) => (
              <tr key={x.skill}>
                <td className="td font-medium">{x.skill}</td><td className="td">L{x.maxLevel}</td><td className="td">{x.projects}</td>
                <td className="td font-semibold">{x.verifiedAtLevel}</td><td className="td">{x.verifiedBelow}</td><td className="td">{x.claimedUnverified}</td>
                <td className="td">{x.verifiedAtLevel === 0 ? (x.verifiedBelow + x.claimedUnverified > 0 ? <Badge tone="amber">Upskill / verify</Badge> : <Badge tone="red">Hiring risk</Badge>) : x.verifiedAtLevel < 2 ? <Badge tone="amber">Thin bench</Badge> : <Badge tone="green">Covered</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
