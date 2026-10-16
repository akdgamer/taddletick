import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { CheckIcon, XIcon } from './Icons'
import { ToastContext, type Show, type ToastInput } from './useToast'

interface ToastItem extends ToastInput {
  id: number
}

/** Short confirmations at the bottom of the screen, with an optional Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])
  const show = useCallback<Show>((toast) => {
    const id = nextId.current++
    // At most three on screen; the oldest makes way
    setToasts((all) => [...all.slice(-2), { ...toast, id }])
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const VISIBLE_MS = 5000

function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [paused, setPaused] = useState(false)

  // Hovering keeps it open, so there's time to reach Undo
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(onClose, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [paused, onClose])

  return (
    <div className="toast" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
      <span className="toast-icon" aria-hidden>
        <CheckIcon />
      </span>
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action?.run()
            onClose()
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="toast-close" aria-label="Dismiss" onClick={onClose}>
        <XIcon />
      </button>
    </div>
  )
}
