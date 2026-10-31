import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BadgeCheck, Sprout, GitCompareArrows, Rocket, ShieldCheck, BarChart3, Globe2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth, homeFor } from '../../lib/auth';

const STEPS = [
  { icon: Sprout, title: 'Grow', text: 'Personalised learning plans generated from real, verified skill gaps — not guesses.' },
  { icon: BadgeCheck, title: 'Prove', text: 'MCQ and practical assessments, project delivery, certifications and manager feedback become evidence.' },
  { icon: GitCompareArrows, title: 'Match', text: 'Explainable readiness scoring ranks internal candidates and enforces critical-skill thresholds.' },
  { icon: Rocket, title: 'Deploy', text: 'Manager shortlist → HR approval → deployment. Skill Passports and analytics update automatically.' },
];

const FEATURES = [
  { icon: ShieldCheck, title: 'Claimed ≠ verified', text: 'Self-reported levels are stored separately. Only evidence moves a verified level.' },
  { icon: BarChart3, title: 'Workforce intelligence', text: 'Live skill inventory, verification rates and internal-vs-external hiring decisions from your own data.' },
  { icon: Globe2, title: 'Market signal, honestly labelled', text: 'Demand computed from real job-posting counts. Observed, demo and forecast data are always tagged.' },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M7 21 L16 10 L25 21" stroke="currentColor" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <span className="font-semibold">TalentBridge AI</span>
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <Link to={homeFor(user.role)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Open workspace</Link>
          ) : (
            <>
              <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Sign in</Link>
              <Link to="/register" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:pt-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">Skill Gap & Workforce Evolution Predictor</div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Discover. Verify. Reward. <span className="text-brand-600">Deploy.</span></h1>
          <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            TalentBridge AI finds the hidden talent you already employ, proves what people can really do, closes skill gaps with targeted learning, and staffs projects internally — before you recommend an external hire.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-medium text-white hover:bg-brand-700">Try the live demo <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/register" className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">Create an organization</Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            {['Explainable, rule-based ranking', 'Backend RBAC & tenant isolation', 'Full audit trail'].map((t) => <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{t}</li>)}
          </ul>
        </motion.div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.div key={s.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="card p-5">
                <div className="flex items-center gap-2"><s.icon className="h-5 w-5 text-brand-600" /><span className="text-xs font-semibold muted">STEP {i + 1}</span></div>
                <div className="mt-3 text-lg font-semibold">{s.title}</div>
                <p className="mt-1.5 text-sm muted">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <f.icon className="h-6 w-6 text-brand-600" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm muted">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 rounded-2xl bg-slate-900 p-8 text-white dark:bg-slate-900">
          <div className="text-sm text-slate-300">Readiness score</div>
          <div className="mt-2 font-mono text-sm sm:text-base">40% verified skill match + 25% practical assessment + 15% relevant experience + 10% documented feedback + 10% availability</div>
          <div className="mt-2 text-sm text-slate-400">Critical skills have separate mandatory thresholds. No language model ever ranks or deploys a person.</div>
        </div>
      </section>
      <footer className="border-t border-slate-200 py-6 text-center text-xs muted dark:border-slate-800">TalentBridge AI · Built for the HCLTech AI Future Ready FullStack Web Engineer Hackathon</footer>
    </div>
  );
}
