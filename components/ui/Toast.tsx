"use client"

import { createContext, useContext, useState } from "react"

const ToastContext = createContext<any>(null)

export function ToastProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [message, setMessage] =
    useState<string | null>(null)

  return (
    <ToastContext.Provider value={{ setMessage }}>
      {children}
      {message && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 surface-secondary border px-4 py-2 rounded text-sm">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function Toast({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="surface-secondary border px-3 py-2 rounded text-sm">
      {children}
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}