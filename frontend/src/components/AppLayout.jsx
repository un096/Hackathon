import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UserCircle, BadgeCheck, ClipboardCheck, Target, GraduationCap, Briefcase, Award, Users, FolderKanban,
  PlusSquare, CheckSquare, Building2, Globe2, BarChart3, Scale, ShieldCheck, ScrollText, Menu, X, Sun, Moon, LogOut,
  Palette,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { toggleTheme, isDark, PALETTES, getPalette, setPalette } from '../lib/theme';
import { Avatar, cx } from './ui';

export const NAV = {
  EMPLOYEE: {
    label: 'Employee', base: '/employee', accent: 'Grow & prove',
    items: [
      { to: '/employee', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/employee/profile', label: 'My Profile', icon: UserCircle },
      { to: '/employee/passport', label: 'Skill Passport', icon: BadgeCheck },
      { to: '/employee/assessments', label: 'Skill Assessments', icon: ClipboardCheck },
      { to: '/employee/gap', label: 'Skill Gap Analysis', icon: Target },
      { to: '/employee/learning', label: 'Learning Plan', icon: GraduationCap },
      { to: '/employee/opportunities', label: 'Project Opportunities', icon: Briefcase },
      { to: '/employee/badges', label: 'Badges & Achievements', icon: Award },
    ],
  },
  MANAGER: {
    label: 'Manager', base: '/manager', accent: 'Match & approve',
    items: [
      { to: '/manager', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/manager/team', label: 'Team Directory', icon: Users },
      { to: '/manager/projects', label: 'Projects', icon: FolderKanban },
      { to: '/manager/projects/new', label: 'Create Project', icon: PlusSquare },
      { to: '/manager/approvals', label: 'Assignment Approvals', icon: CheckSquare },
    ],
  },
  HR: {
    label: 'HR / Admin', base: '/hr', accent: 'Workforce intelligence',
    items: [
      { to: '/hr', label: 'HR Dashboard', icon: LayoutDashboard, end: true },
      { to: '/hr/employees', label: 'Employee Management', icon: Building2 },
      { to: '/hr/projects', label: 'Project Oversight', icon: FolderKanban },
      { to: '/hr/market', label: 'Market Skill Intelligence', icon: Globe2 },
      { to: '/hr/analytics', label: 'Workforce Analytics', icon: BarChart3 },
      { to: '/hr/hiring', label: 'Internal vs External', icon: Scale },
      { to: '/hr/users', label: 'Users & Roles', icon: ShieldCheck },
      { to: '/hr/audit', label: 'Audit & Settings', icon: ScrollText },
    ],
  },
};

export default function AppLayout({ role }) {
  const { user, logout } = useAuth();
  const nav = NAV[role];
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(isDark());
  const [palette, setCurrentPalette] = useState(getPalette());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const name = `${user.firstName} ${user.lastName}`;

  const changePalette = (id) => {
    setPalette(id);
    setCurrentPalette(id);
    setPaletteOpen(false);
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M7 21 L16 10 L25 21" stroke="currentColor" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        <div>
          <div className="text-sm font-semibold leading-tight">TalentBridge AI</div>
          <div className="text-[11px] muted">{nav.label} · {nav.accent}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {nav.items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpen(false)}
            className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70')}>
            <it.icon className="h-4 w-4" />{it.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3 text-[11px] muted dark:border-slate-800">
        <div className="px-2">{user.organizationName}</div>
        <div className="px-2">Grow → Prove → Match → Deploy</div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-slate-900">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/85">
          <button className="rounded p-1.5 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <div className="flex-1" />
          <div className="relative">
            <button
              onClick={() => setPaletteOpen(!paletteOpen)}
              className="flex items-center gap-1.5 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Change professional color theme"
              aria-label="Change color theme"
            >
              <Palette className="h-4 w-4" />
            </button>
            {paletteOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Color Palette</div>
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => changePalette(p.id)}
                    className={cx(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
                      palette === p.id
                        ? 'bg-slate-100 text-slate-900 font-semibold dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </span>
                    {palette === p.id && <span className="text-xs text-brand-600">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setDark(toggleTheme())} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Toggle theme" title="Toggle light/dark theme">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <div className="flex items-center gap-2.5">
            <Avatar name={name} size="sm" />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{name}</div>
              <div className="text-[11px] muted">{user.role === 'HR' ? 'HR / Admin' : user.role === 'MANAGER' ? 'Manager' : 'Employee'}</div>
            </div>
          </div>
          {user.role !== 'EMPLOYEE' && role !== 'EMPLOYEE' && (
            <button onClick={() => navigate('/employee')} className="hidden rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 md:block dark:text-slate-300 dark:hover:bg-slate-800">My passport</button>
          )}
          {role === 'EMPLOYEE' && user.role !== 'EMPLOYEE' && (
            <button onClick={() => navigate(user.role === 'HR' ? '/hr' : '/manager')} className="hidden rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 md:block dark:text-brand-300">Back to {user.role === 'HR' ? 'HR' : 'Manager'} portal</button>
          )}
          <button onClick={() => { logout(); navigate('/login'); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
    </div>
  );
}
