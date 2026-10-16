import { createContext, useContext } from 'react'

export interface ToastInput {
  message: string
  /** e.g. Undo: runs, then the toast closes */
  action?: { label: string; run: () => void }
}

export type Show = (toast: ToastInput) => void

// Outside a provider (unit tests) toasts are silently dropped
export const ToastContext = createContext<Show>(() => {})

export const useToast = () => useContext(ToastContext)

/**
 * Run `then` once a change has saved. Uses the promise rather than mutate()'s onSuccess,
 * which never fires if the row that started it has already disappeared (archived, completed, deleted).
 * Failures are left to the mutation's own error display.
 */
export function afterSave(save: Promise<unknown>, then: () => void) {
  save.then(then, () => {})
}
