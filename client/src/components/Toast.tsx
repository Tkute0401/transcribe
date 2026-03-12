'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  variant: Variant;
  duration: number;
  exiting?: boolean;
}

interface ToastContextValue {
  addToast: (message: string, variant?: Variant, duration?: number) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG: Record<
  Variant,
  { border: string; icon: React.ReactNode; progressBg: string }
> = {
  success: {
    border: '#34d399',
    progressBg: '#34d399',
    icon: <CheckCircle size={16} style={{ color: '#34d399', flexShrink: 0 }} />,
  },
  error: {
    border: '#f87171',
    progressBg: '#f87171',
    icon: <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0 }} />,
  },
  info: {
    border: '#60a5fa',
    progressBg: '#60a5fa',
    icon: <Info size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />,
  },
  warning: {
    border: '#fb923c',
    progressBg: '#fb923c',
    icon: <AlertTriangle size={16} style={{ color: '#fb923c', flexShrink: 0 }} />,
  },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const cfg = VARIANT_CONFIG[toast.variant];

  return (
    <div
      className={toast.exiting ? 'toast-exit' : 'toast-enter'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 320,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${cfg.border}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        {cfg.icon}
        <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.4 }}>
          {toast.message}
        </span>
        <button
          onClick={() => onRemove(toast.id)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            borderRadius: 4,
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>
      {/* Progress strip */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)' }}>
        <div
          style={{
            height: '100%',
            background: cfg.progressBg,
            animation: `toastProgress ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    // Mark as exiting first for animation, then remove
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 220); // matches toast-exit duration
  }, []);

  const addToast = useCallback(
    (message: string, variant: Variant = 'info', duration = 4000) => {
      const id = Math.random().toString(36).slice(2);
      const toast: Toast = { id, message, variant, duration };
      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss
      timersRef.current[id] = setTimeout(() => {
        removeToast(id);
        delete timersRef.current[id];
      }, duration);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Portal-style fixed container */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
