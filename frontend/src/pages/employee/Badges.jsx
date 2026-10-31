import { ShieldCheck, Trophy, Layers, TrendingUp, GraduationCap, Rocket, Wrench, Award, Lock } from 'lucide-react';
import { useGet } from '../../lib/hooks';
import { Card, PageHeader, PageSkeleton, ErrorState, Stat, Avatar, Badge, cx } from '../../components/ui';
import { fmtDate } from '../../lib/format';

const ICONS = { ShieldCheck, Trophy, Layers, TrendingUp, GraduationCap, Rocket, Wrench };

export default function Badges() {
  const { data, isLoading, error, refetch } = useGet('badges', '/me/badges');
  if (isLoading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const earned = data.badges.filter((b) => b.earned);

  return (
    <div>
      <PageHeader eyebrow="Badges & achievements" title="Rewards for verified growth" subtitle="Points and badges are awarded only for evidence — verified skills, passed assessments, closed gaps and internal deployments. Self-claims never earn rewards." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Award} label="Total points" value={data.points} />
        <Stat icon={Trophy} tone="green" label="Badges earned" value={`${earned.length} / ${data.badges.length}`} />
        <Stat icon={Rocket} tone="violet" label="Next badge" value={data.badges.find((b) => !b.earned)?.name || 'All earned'} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {data.badges.map((b) => {
            const I = ICONS[b.icon] || Award;
            return (
              <div key={b.id} className={cx('card flex gap-4 p-5', !b.earned && 'opacity-70')}>
                <div className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', b.earned ? 'bg-gradient-to-br from-brand-500 to-violet-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800')}>{b.earned ? <I className="h-6 w-6" /> : <Lock className="h-5 w-5" />}</div>
                <div>
                  <div className="flex items-center gap-2 font-semibold">{b.name}<Badge tone="brand">+{b.points}</Badge></div>
                  <p className="mt-0.5 text-sm muted">{b.description}</p>
                  {b.earned && <p className="mt-1.5 text-xs text-emerald-600">Earned {fmtDate(b.awardedAt)}{b.reason ? ` · ${b.reason}` : ''}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <Card title="Leaderboard" subtitle="Top verified growth in your organization">
          <ol className="space-y-3">
            {data.leaderboard.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-5 text-sm font-semibold muted">{i + 1}</span>
                <Avatar name={`${p.user.firstName} ${p.user.lastName}`} size="sm" />
                <span className="flex-1 text-sm font-medium">{p.user.firstName} {p.user.lastName}</span>
                <span className="text-xs muted">{p._count.badges} badges</span>
                <Badge tone="brand">{p.points}</Badge>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
