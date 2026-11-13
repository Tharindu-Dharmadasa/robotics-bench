import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useBenchStore } from '../store/benchStore';
import { CodePanel } from './CodePanel';
import { SerialMonitor } from './SerialMonitor';

export function IdeDrawer() {
  const { isIdeOpen, closeIde, ideTab, setIdeTab } = useBenchStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isIdeOpen) {
        closeIde();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isIdeOpen, closeIde]);

  return (
    <AnimatePresence>
      {isIdeOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeIde}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-[var(--line)] bg-[var(--paper)] p-4 shadow-2xl"
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIdeTab('code')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    ideTab === 'code'
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--line)]/30'
                  }`}
                >
                  📄 Code & Sketch
                </button>
                <button
                  type="button"
                  onClick={() => setIdeTab('serial')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    ideTab === 'serial'
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--line)]/30'
                  }`}
                >
                  📡 Serial Monitor
                </button>
              </div>

              <button
                type="button"
                onClick={closeIde}
                className="rounded-lg p-1.5 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface)]"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto">
              {ideTab === 'code' ? <CodePanel /> : <SerialMonitor />}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
