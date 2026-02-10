"use client"

import { ReactNode } from "react"

export function ModalProvider({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
}

export function Modal({
  title,
  children,
  onConfirm,
  onCancel,
  confirmDisabled,
}: {
  title: string
  children: ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmDisabled?: boolean
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[rgba(7,14,26,0.8)] z-50">
      <div className="w-full max-w-md">
        <div className="p-4 rounded surface-secondary border space-y-3">
          <div className="font-semibold">{title}</div>
          <div className="text-sm">{children}</div>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel}>Cancel</button>
            <button
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
