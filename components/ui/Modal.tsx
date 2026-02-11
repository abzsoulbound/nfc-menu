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
    <div className="modal-overlay">
      <div className="w-full max-w-md">
        <div className="card space-y-3">
          <div className="font-semibold text-center">{title}</div>
          <div className="text-sm">{children}</div>
          <div className="flex gap-2 justify-end">
            <button onClick={onCancel} className="px-3 py-2 rounded btn-secondary">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={confirmDisabled} className="px-3 py-2 rounded btn-primary">
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
