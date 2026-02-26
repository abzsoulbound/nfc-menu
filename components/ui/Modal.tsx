"use client"

import { ReactNode } from "react"
import { Button } from "@/components/ui/Button"

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
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: {
  title: string
  children: ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmDisabled?: boolean
  confirmLabel?: string
  cancelLabel?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,14,26,0.58)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border)] surface-elevated p-4 shadow-[var(--shadow-hard)]">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <div className="text-sm text-secondary">{children}</div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="quiet" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
