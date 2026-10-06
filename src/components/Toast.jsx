import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = { success: '✅', error: '⛔', info: 'ℹ️', warning: '⚠️', offline: '📴' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 250);
  }, []);

  const push = useCallback((type, message, duration = 3200) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setDialog({ ...opts, resolve });
  }), []);

  const closeDialog = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  const api = useRef(null);
  api.current = {
    success: (m, d) => push('success', m, d),
    error: (m, d) => push('error', m, d ?? 5000),
    info: (m, d) => push('info', m, d),
    warning: (m, d) => push('warning', m, d ?? 4500),
    offline: (m, d) => push('offline', m, d ?? 4500),
    confirm,
  };

  // objeto estável para os consumidores
  const [stable] = useState(() => ({
    success: (...a) => api.current.success(...a),
    error: (...a) => api.current.error(...a),
    info: (...a) => api.current.info(...a),
    warning: (...a) => api.current.warning(...a),
    offline: (...a) => api.current.offline(...a),
    confirm: (...a) => api.current.confirm(...a),
  }));

  return (
    <ToastContext.Provider value={stable}>
      {children}

      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type} ${t.leaving ? 'leaving' : ''}`} onClick={() => dismiss(t.id)}>
            <span className="toast-icon">{ICONS[t.type]}</span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="dialog-backdrop" onClick={() => closeDialog(false)}>
          <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className={`dialog-icon ${dialog.danger ? 'danger' : ''}`}>{dialog.icon || (dialog.danger ? '🗑️' : '❓')}</div>
            <h3>{dialog.title || 'Confirmar'}</h3>
            {dialog.message && <p>{dialog.message}</p>}
            <div className="dialog-actions">
              <button id="dialog-cancel" className="dialog-btn ghost" onClick={() => closeDialog(false)}>
                {dialog.cancelText || 'Cancelar'}
              </button>
              <button
                id="dialog-confirm"
                className={`dialog-btn ${dialog.danger ? 'danger' : 'primary'}`}
                onClick={() => closeDialog(true)}
                autoFocus
              >
                {dialog.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
