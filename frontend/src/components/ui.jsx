import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, Inbox, Info } from 'lucide-react';
import { LEVELS, initials, humanize } from '../lib/format';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const BTN = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-400',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
};
export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, ...p }) {
  const sz = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-2.5 text-sm' : 'px-3.5 py-2 text-sm';
  return (
    <button className={cx('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60', sz, BTN[variant], className)} disabled={loading || p.disabled} {...p}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function Card({ className, title, subtitle, actions, children, padded = true }) {
  return (
    <div className={cx('card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};
export function Badge({ tone = 'slate', children, className, icon: Icon }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>{Icon && <Icon className="h-3 w-3" />}{children}</span>;
}

const STATUS_TONE = {
  VERIFIED: 'green', IN_REVIEW: 'amber', CLAIMED: 'slate', AVAILABLE: 'green', PARTIALLY_AVAILABLE: 'amber', ON_PROJECT: 'blue', ON_LEAVE: 'slate',
  OPEN: 'brand', STAFFING: 'violet', ACTIVE: 'green', COMPLETED: 'slate', DRAFT: 'slate', CANCELLED: 'red',
  RECOMMENDED: 'brand', SHORTLISTED: 'violet', APPROVED: 'green', REJECTED: 'red',
  NOT_STARTED: 'slate', IN_PROGRESS: 'blue', READY_FOR_REASSESSMENT: 'violet',
  HIGH: 'amber', CRITICAL: 'red', MEDIUM: 'blue', LOW: 'slate', EMPLOYEE: 'slate', MANAGER: 'violet', HR: 'brand',
  OBSERVED: 'green', DEMO: 'amber', FORECAST: 'violet',
};
export const StatusBadge = ({ status, label }) => <Badge tone={STATUS_TONE[status] || 'slate'}>{label || humanize(status)}</Badge>;

/** Visual tag that tells users where numbers come from. */
export function DataLabel({ kind = 'OBSERVED', title }) {
  const text = { OBSERVED: 'Observed data', DEMO: 'Demo data', FORECAST: 'Forecast' }[kind];
  return <span title={title}><Badge tone={STATUS_TONE[kind]} icon={Info}>{text}</Badge></span>;
}

export function LevelPill({ level, kind = 'verified', required }) {
  const ok = required == null || level >= required;
  if (!level) return <span className="inline-flex items-center rounded-md border border-dashed border-slate-300 px-1.5 py-0.5 text-xs text-slate-400 dark:border-slate-700">—</span>;
  const cls = kind === 'claimed'
    ? 'border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
    : ok ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white';
  return <span title={`${kind === 'claimed' ? 'Claimed' : 'Verified'} L${level} — ${LEVELS[level]}`} className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold', cls)}>L{level}</span>;
}

export function LevelBar({ claimed = 0, verified = 0, required }) {
  return (
    <div className="flex items-center gap-1" aria-label={`claimed ${claimed}, verified ${verified}`}>
      {[1, 2, 3, 4, 5].map((l) => (
        <div key={l} className="relative h-2 w-6 overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800">
          {l <= claimed && <div className="absolute inset-0 bg-slate-300 dark:bg-slate-600" />}
          {l <= verified && <div className="absolute inset-0 bg-emerald-500" />}
          {required === l && <div className="absolute inset-y-0 right-0 w-0.5 bg-rose-500" />}
        </div>
      ))}
    </div>
  );
}

export function Progress({ value = 0, tone = 'brand', className }) {
  const c = { brand: 'bg-brand-600', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500' }[tone];
  return <div className={cx('h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800', className)}><div className={cx('h-full rounded-full transition-all', c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function ScoreRing({ value = 0, size = 56, label }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const tone = value >= 75 ? '#10b981' : value >= 50 ? '#1d4ed8' : value >= 30 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} title={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth="6" className="fill-none stroke-slate-100 dark:stroke-slate-800" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth="6" fill="none" stroke={tone} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * Math.min(value, 100)) / 100} />
      </svg>
      <span className="absolute text-sm font-semibold">{Math.round(value)}</span>
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = 'brand' }) {
  const t = { brand: 'text-brand-600 bg-brand-50 dark:bg-brand-500/15 dark:text-brand-300', green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300', amber: 'text-amber-600 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300', violet: 'text-violet-600 bg-violet-50 dark:bg-violet-500/15 dark:text-violet-300', red: 'text-rose-600 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-300' }[tone];
  return (
    <div className="card flex items-start gap-3 p-4">
      {Icon && <div className={cx('rounded-lg p-2', t)}><Icon className="h-5 w-5" /></div>}
      <div className="min-w-0">
        <div className="text-xs font-medium muted">{label}</div>
        <div className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</div>
        {hint && <div className="mt-0.5 text-xs muted">{hint}</div>}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 'md' }) {
  const s = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-xs';
  const hue = [...(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 5;
  const bg = ['bg-brand-100 text-brand-700', 'bg-violet-100 text-violet-700', 'bg-sky-100 text-sky-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700'][hue];
  return <div className={cx('flex shrink-0 items-center justify-center rounded-full font-semibold', s, bg)}>{initials(name)}</div>;
}

export function Skeleton({ className }) { return <div className={cx('animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800', className)} />; }
export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-800"><Icon className="h-6 w-6 text-slate-400" /></div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry }) {
  return (
    <div className="card p-6 text-sm">
      <div className="font-semibold text-rose-600">Could not load this page</div>
      <p className="mt-1 muted">{error?.response?.data?.message || error?.message}</p>
      {retry && <Button className="mt-3" size="sm" variant="secondary" onClick={retry}>Retry</Button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    if (open) window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 pt-[8vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div role="dialog" aria-modal="true" className={cx('card w-full', wide ? 'max-w-3xl' : 'max-w-lg')} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
              <h3 className="text-sm font-semibold">{title}</h3>
              <button onClick={onClose} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {tabs.map((t) => (
        <button key={t.value} onClick={() => onChange(t.value)} className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition', value === t.value ? 'border-brand-600 text-brand-700 dark:text-brand-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200')}>
          {t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs dark:bg-slate-800">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Table({ children, className }) {
  return <div className={cx('overflow-x-auto', className)}><table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">{children}</table></div>;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx('input max-w-xs', className)} />;
}

export function Callout({ tone = 'brand', icon: Icon = Info, title, children }) {
  const t = { brand: 'border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-100', amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100', green: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100', red: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100' }[tone];
  return (
    <div className={cx('flex gap-3 rounded-lg border px-4 py-3 text-sm', t)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{title && <div className="font-semibold">{title}</div>}<div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div></div>
    </div>
  );
}
