"use client"

import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"

type ToastContextValue = {
  setMessage: (message: string | null) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({
  children,
}: {
  children: ReactNode
}) {
  const [message, setMessage] = useState<string | null>(null)

  return (
    <ToastContext.Provider value={{ setMessage }}>
      {children}
      {message && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-[var(--radius-control)] border border-[var(--border)] surface-elevated px-4 py-2 text-sm shadow-[var(--shadow-hard)]">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function Toast({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--border)] surface-elevated px-3 py-2 text-sm">
      {children}
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}
