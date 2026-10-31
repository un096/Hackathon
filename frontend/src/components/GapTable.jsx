import { AlertTriangle } from 'lucide-react';
import { Table, LevelPill, Badge, LevelBar } from './ui';

const STATE = { MET: ['green', 'Met'], BELOW: ['amber', 'Below level'], UNVERIFIED: ['violet', 'Claimed, not verified'], MISSING: ['red', 'Missing'] };

export default function GapTable({ items }) {
  return (
    <Table>
      <thead><tr><th className="th">Requirement</th><th className="th">Required</th><th className="th">Claimed</th><th className="th">Verified</th><th className="th">Gap</th><th className="th">Status</th></tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((g) => (
          <tr key={g.skillId}>
            <td className="td"><div className="flex items-center gap-2 font-medium">{g.skillName}{g.critical && <Badge tone="red" icon={AlertTriangle}>Critical</Badge>}</div></td>
            <td className="td"><LevelPill level={g.required} kind="claimed" /></td>
            <td className="td"><LevelPill level={g.claimed} kind="claimed" /></td>
            <td className="td"><div className="flex items-center gap-2"><LevelPill level={g.verified} required={g.required} /><LevelBar claimed={g.claimed} verified={g.verified} required={g.required} /></div></td>
            <td className="td text-sm">{g.gap > 0 ? <span className="font-semibold text-amber-600">−{g.gap}</span> : <span className="text-emerald-600">0</span>}</td>
            <td className="td"><Badge tone={STATE[g.state][0]}>{STATE[g.state][1]}</Badge></td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
