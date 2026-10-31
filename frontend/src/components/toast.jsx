import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const Ctx = createContext(() => {});

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const remove = (id) => setItems((xs) => xs.filter((x) => x.id !== id));
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((xs) => [...xs.slice(-3), { id, message, type }]);
    setTimeout(() => remove(id), type === 'error' ? 6000 : 3500);
  }, []);
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => {
            const I = Icon[t.type];
            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }} className="card pointer-events-auto flex items-start gap-3 px-4 py-3 text-sm">
                <I className={`mt-0.5 h-4 w-4 shrink-0 ${t.type === 'error' ? 'text-rose-500' : t.type === 'info' ? 'text-brand-500' : 'text-emerald-500'}`} />
                <div className="flex-1">{t.message}</div>
                <button onClick={() => remove(t.id)} aria-label="Dismiss"><X className="h-4 w-4 text-slate-400" /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
