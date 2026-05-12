import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const ICONS = {
    success: <CheckCircle size={16} className="text-success shrink-0" />,
    error:   <XCircle    size={16} className="text-danger  shrink-0" />,
    info:    <AlertCircle size={16} className="text-blue-500 shrink-0" />,
  }

  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="fixed right-3 md:right-4 z-50 flex flex-col gap-2 pointer-events-none safe-bottom bottom-[calc(var(--crm-mobile-nav-height)+0.5rem)] md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 bg-white rounded-xl shadow-panel border border-neutral-200 px-4 py-3 text-sm pointer-events-auto min-w-[220px] max-w-xs toast-enter"
          >
            {ICONS[t.type]}
            <span className="flex-1 text-neutral-700">{t.msg}</span>
            <button
              onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}
              className="mobile-tap inline-flex items-center justify-center rounded-md hover:bg-neutral-100"
            >
              <X size={14} className="text-neutral-400 hover:text-neutral-600" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
